import {requireBoard, validatePin, validateInteger} from './boards.js';
import {encodeRequest, parseResponse, LineDecoder} from './protocol.js';

export const LIVE_FIRMWARE_URL = new URL('./firmware/DuetBloxLive/DuetBloxLive.ino', import.meta.url).href;
const CAMERA_FIRMWARE_URL = new URL('./firmware/DuetBloxLiveESP32CAM/DuetBloxLiveESP32CAM.ino', import.meta.url).href;
export const getLiveFirmwareURL = boardId => boardId === 'esp32-cam' ? CAMERA_FIRMWARE_URL : LIVE_FIRMWARE_URL;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cancelledConnection = () => Object.assign(new Error('Board connection cancelled.'), {name: 'AbortError'});

/** A real Web Serial client for the supplied DUETBlox Live firmware (not Firmata). */
export class ArduinoSerialService {
  constructor({serial = globalThis.navigator?.serial, boardId = 'arduino-uno', onState, onTelemetry,
    requestTimeout = 1500, heartbeatInterval = 1000, handshakeAttempts = 4} = {}) {
    this.serial = serial;
    this.boardId = boardId;
    this.onTelemetry = onTelemetry;
    this.requestTimeout = requestTimeout;
    this.heartbeatInterval = heartbeatInterval;
    this.handshakeAttempts = handshakeAttempts;
    this.listeners = new Set(onState ? [onState] : []);
    this.state = {status: 'disconnected', boardId, error: null, firmwareVersion: null, supported: Boolean(serial)};
    this.pending = new Map(); this.sequence = 0; this.writeQueue = Promise.resolve();
    this.port = null; this.lastPort = null; this.closing = false;
    this.generation = 0; this.disposed = false; this.opening = null;
    this._onDisconnect = event => { if (event.target === this.port || event.port === this.port) this._fail(new Error('Board disconnected. Reconnect explicitly to resume.')); };
    serial?.addEventListener?.('disconnect', this._onDisconnect);
  }

  getState() { return {...this.state}; }
  subscribe(listener) { this.listeners.add(listener); listener(this.getState()); return () => this.listeners.delete(listener); }
  _state(patch) {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) { try { listener(this.getState()); } catch { /* UI errors cannot break serial cleanup. */ } }
  }
  _telemetry(data) { try { this.onTelemetry?.(data); } catch { /* Consumer-owned callback. */ } }
  _assertGeneration(generation) { if (this.disposed || generation !== this.generation) throw cancelledConnection(); }

  async connect({boardId = this.boardId, port} = {}) {
    if (this.disposed) throw new Error('This board connection has been disposed.');
    if (!this.serial) throw new Error('Web Serial is unavailable. Use a supported desktop browser in a secure context.');
    if (['connecting', 'connected', 'disconnecting'].includes(this.state.status) || this.closing) throw new Error('A board connection is already active or closing.');
    const board = requireBoard(boardId);
    const generation = ++this.generation;
    this.boardId = boardId; this.board = board;
    // Set state before the first await so concurrent clicks cannot open two ports.
    this._state({status: 'connecting', boardId, error: null, firmwareVersion: null});
    try {
      await this.cleanup;
      this._assertGeneration(generation);
      // The browser chooser cannot be dismissed programmatically. A cancelled
      // generation must ignore its eventual selection without opening that port.
      const selectedPort = port || await this.serial.requestPort();
      this._assertGeneration(generation);
      this.port = selectedPort;
      this.opening = selectedPort.open({baudRate: 115200, bufferSize: 1024});
      await this.opening;
      this._assertGeneration(generation);
      this.opening = null;
      this.lastPort = selectedPort;
      if (!selectedPort.readable || !selectedPort.writable) throw new Error('The selected serial port is not readable and writable.');
      this.writer = selectedPort.writable.getWriter();
      this.reader = selectedPort.readable.getReader();
      this.writeQueue = Promise.resolve();
      this.readTask = this._readLoop(this.reader);
      let hello, lastError;
      for (let attempt = 0; attempt < this.handshakeAttempts; attempt++) {
        this._assertGeneration(generation);
        try { hello = await this._request('HELLO'); break; }
        catch (error) {
          this._assertGeneration(generation);
          lastError = error;
          if (this.closing || this.state.status === 'error') throw error;
          if (attempt + 1 < this.handshakeAttempts) await pause(150);
        }
      }
      this._assertGeneration(generation);
      if (!hello) throw new Error(`DUETBlox Live firmware did not respond. Install the supplied firmware for ${board.name}, then reconnect. ${lastError?.message || ''}`);
      const match = /^DUETBLOX 1 (UNO|MEGA|NANO|ESP32|ESP32CAM)$/.exec(hello);
      if (!match) throw new Error('Incompatible firmware. DUETBlox Live protocol version 1 is required.');
      if (match[1] !== board.firmwareId) throw new Error(`Selected ${board.name}, but firmware reports ${match[1]}. Select the matching board.`);
      this._state({status: 'connected', firmwareVersion: 1, error: null});
      this.heartbeat = setInterval(async () => {
        if (this.pinging || this.closing || generation !== this.generation) return;
        this.pinging = true;
        try { await this._request('PING'); }
        catch (error) { if (generation === this.generation) this._fail(error); }
        finally { this.pinging = false; }
      }, this.heartbeatInterval);
      return this.getState();
    } catch (error) {
      if (generation !== this.generation || this.disposed) {
        // The cancelling operation owns resource cleanup. Never overwrite the
        // state or close a port belonging to a later connection attempt.
        await this.cleanup;
        throw cancelledConnection();
      }
      const cancelled = error.name === 'NotFoundError' || error.name === 'AbortError';
      this._state({status: cancelled ? 'disconnected' : 'error', error: cancelled ? null : error.message});
      await this._close(true);
      throw error;
    }
  }

  async reconnect({boardId = this.boardId} = {}) {
    if (!this.lastPort) throw new Error('No previously selected port. Use Connect first.');
    const disconnecting = this.disconnect();
    const generation = this.generation;
    await disconnecting;
    this._assertGeneration(generation);
    this._state({status: 'connecting', error: null});
    try {
      const allowedPorts = await this.serial.getPorts();
      this._assertGeneration(generation);
      if (!allowedPorts.includes(this.lastPort)) throw new Error('Port permission is no longer available. Use Connect to select the board again.');
      this._state({status: 'disconnected'});
      return await this.connect({boardId, port: this.lastPort});
    } catch (error) {
      if (generation === this.generation) this._state({status: 'error', error: error.message});
      throw error;
    }
  }

  async disconnect() {
    const wasConnected = this.state.status === 'connected';
    const generation = ++this.generation;
    if (this.closing) {
      await this.cleanup;
      if (generation === this.generation) this._state({status: 'disconnected', error: null, firmwareVersion: null});
      return this.getState();
    }
    this._state({status: 'disconnecting', error: null, firmwareVersion: null});
    if (wasConnected) {
      try { await this._request('STOP'); } catch { /* Firmware watchdog also resets outputs after link loss. */ }
    }
    if (generation === this.generation) await this._close(false);
    else await this.cleanup;
    return this.getState();
  }
  async dispose() { this.disposed = true; await this.disconnect(); this.serial?.removeEventListener?.('disconnect', this._onDisconnect); this.listeners.clear(); }

  _fail(error) {
    if (this.closing || this.state.status === 'disconnected') return;
    ++this.generation;
    this._state({status: 'error', error: error.message || String(error), firmwareVersion: null});
    this._close(true);
  }
  _close(preserveState) {
    if (this.closing) return this.cleanup;
    this.closing = true;
    const generation = this.generation;
    clearInterval(this.heartbeat);
    for (const {reject, timer} of this.pending.values()) { clearTimeout(timer); reject(new Error('Serial connection closed.')); }
    this.pending.clear();
    const reader = this.reader, writer = this.writer, port = this.port;
    const readTask = this.readTask, writeQueue = this.writeQueue, opening = this.opening;
    this.reader = null; this.writer = null; this.port = null; this.opening = null;
    this.cleanup = (async () => {
      // close() may reject while native open() is pending. Wait for that open
      // to settle, then close it; no handshake or output command can follow.
      try { await opening; } catch { /* An open failure still needs best-effort close. */ }
      try { await reader?.cancel(); } catch { /* Device may already be removed. */ }
      try { await readTask; } catch { /* Reported by read loop. */ }
      try { await writer?.abort(); } catch { /* Cancel native queued writes before releasing the lock. */ }
      try { await writeQueue; } catch { /* Pending writes rejected above. */ }
      try { writer?.releaseLock(); } catch { /* Already released. */ }
      try { await port?.close(); } catch { /* Closing a removed port may fail. */ }
      this.closing = false; this.pinging = false;
      if (!preserveState && generation === this.generation) this._state({status: 'disconnected', error: null, firmwareVersion: null});
    })();
    return this.cleanup;
  }

  async _readLoop(reader) {
    const decoder = new LineDecoder();
    try {
      while (true) {
        const {value, done} = await reader.read();
        if (done) { if (!this.closing && reader === this.reader) this._fail(new Error('Serial stream ended. Reconnect to resume.')); break; }
        if (reader !== this.reader) break;
        for (const line of decoder.push(value)) {
          if (line === '0 EVENT SAFE') { this._telemetry({type: 'watchdog', message: 'Board outputs reset after a communication timeout.'}); continue; }
          const response = parseResponse(line);
          const pending = response && this.pending.get(response.id);
          if (!pending) continue;
          clearTimeout(pending.timer); this.pending.delete(response.id);
          if (response.ok) pending.resolve(response.payload);
          else pending.reject(new Error(`Board rejected command: ${response.payload}`));
        }
      }
    } catch (error) { if (!this.closing && reader === this.reader) this._fail(error); }
    finally { try { reader.releaseLock(); } catch { /* Already cancelled. */ } }
  }

  _request(command, ...args) {
    if (!this.writer || this.closing) return Promise.reject(new Error('Board is not connected.'));
    if (this.pending.size >= 32) return Promise.reject(new Error('Board command queue is full. Add a wait between repeated commands.'));
    let id;
    do { id = this.sequence = this.sequence % 65535 + 1; } while (this.pending.has(id));
    const packet = encodeRequest(id, command, ...args);
    const writer = this.writer, generation = this.generation;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Board command ${command} timed out.`)); }, this.requestTimeout);
      this.pending.set(id, {resolve, reject, timer});
      this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
        if (!this.pending.has(id) || this.closing) return;
        try { await writer.write(packet); }
        catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); if (generation === this.generation) this._fail(error); }
      });
    });
  }
  _connected() { if (this.state.status !== 'connected') throw new Error('Connect a board with DUETBlox Live firmware first.'); }
  async setPinMode(pin, mode) {
    this._connected(); const p = validatePin(this.board, pin, mode === 'OUTPUT' ? 'output' : mode === 'INPUT_PULLUP' ? 'pullup' : 'digital');
    if (!['INPUT', 'INPUT_PULLUP', 'OUTPUT'].includes(mode)) throw new Error('Pin mode must be INPUT, INPUT_PULLUP or OUTPUT.');
    await this._request('MODE', p, mode); return true;
  }
  async digitalWrite(pin, value) {
    this._connected(); const p = validatePin(this.board, pin, 'output'); const v = validateInteger(value, 0, 1, 'Digital value');
    await this._request('WRITE', p, v); this._telemetry({type: 'digital', pin: p, value: v}); return v;
  }
  async analogWrite(pin, value) {
    this._connected(); const p = validatePin(this.board, pin, 'pwm'); const v = validateInteger(value, 0, 255, 'PWM value');
    await this._request('PWM', p, v); this._telemetry({type: 'pwm', pin: p, value: v}); return v;
  }
  async readAnalog(pin) {
    this._connected(); const p = validatePin(this.board, pin, 'analog');
    const value = Number(await this._request('ANALOG', p.startsWith('A') ? p.slice(1) : p));
    if (!Number.isInteger(value) || value < 0 || value > this.board.analogMax) throw new Error('Invalid analog reading from board.');
    this._telemetry({type: 'analog', pin: p, value}); return value;
  }
  async readDigital(pin) {
    this._connected(); const p = validatePin(this.board, pin);
    const value = Number(await this._request('READ', p));
    if (value !== 0 && value !== 1) throw new Error('Invalid digital reading from board.');
    this._telemetry({type: 'digital', pin: p, value}); return value;
  }
  async stop() { this._connected(); await this._request('STOP'); return true; }
  async servoWrite(pin, angle) {
    this._connected(); const p = validatePin(this.board, pin, 'output'); const a = validateInteger(angle, 0, 180, 'Servo angle');
    await this._request('SERVO', p, a); return a;
  }
  async servoDetach(pin) {
    this._connected(); const p = validatePin(this.board, pin, 'output');
    await this._request('DETACH', p); return true;
  }
  async tone(pin, frequency, durationSeconds = 0) {
    this._connected(); const p = validatePin(this.board, pin, 'output'); const hz = validateInteger(frequency, 31, 20000, 'Tone frequency');
    const seconds = Number(durationSeconds);
    if (durationSeconds === null || durationSeconds === '' || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new Error('Tone duration must be from 0 to 3600 seconds; 0 plays until stopped.');
    await this._request('TONE', p, hz, seconds > 0 ? Math.max(1, Math.round(seconds * 1000)) : 0); return true;
  }
  async noTone(pin) {
    this._connected(); const p = validatePin(this.board, pin, 'output');
    await this._request('NOTONE', p); return true;
  }
}

import {requireBoard, validatePin, validateInteger} from './boards.js';

/** Browser-only model of DUETBlox Live I/O commands. Never opens a device.
 * This models logical values and declared firmware resource limits, not circuits,
 * electrical timing, a CPU, camera capture or compiled firmware execution.
 */
export class VirtualBoardService {
  constructor({boardId = 'arduino-uno', timers = globalThis, now = () => Date.now()} = {}) {
    this.board = requireBoard(boardId); this.boardId = boardId;
    this.timers = timers; this.now = now; this.listeners = new Set();
    this.enabled = false; this.disposed = false; this.revision = 0;
    this._clearModel();
  }

  _clearToneTimer() {
    if (this.toneTimer !== undefined) this.timers.clearTimeout(this.toneTimer);
    this.toneTimer = undefined; this.toneToken = (this.toneToken || 0) + 1;
  }
  _clearModel() {
    this._clearToneTimer(); this.servoTimerUsed = false; this.toneTimerUsed = false;
    this.pins = new Map(this.board.digitalPins.map(pin => [pin, {pin, mode: 'INPUT', input: null, kind: null, value: 0}]));
    this.analogInputs = Object.fromEntries(this.board.analogPins.map(pin => [pin, 0]));
    this.lastAction = 'Virtual board reset'; this.commandCount = 0;
  }
  getState() {
    return {
      enabled: this.enabled, status: this.enabled ? 'virtual' : 'disabled', boardId: this.boardId,
      pins: [...this.pins.values()].map(pin => ({...pin})), analogInputs: {...this.analogInputs},
      servoTimerUsed: this.servoTimerUsed, toneTimerUsed: this.toneTimerUsed,
      revision: this.revision, commandCount: this.commandCount, lastAction: this.lastAction
    };
  }
  subscribe(listener) {
    if (this.disposed) throw new Error('This virtual board has been disposed.');
    this.listeners.add(listener);
    try { listener(this.getState()); } catch { /* Consumer errors cannot interrupt model cleanup. */ }
    return () => this.listeners.delete(listener);
  }
  _emit(action, command = true) {
    this.lastAction = action; this.revision++;
    if (command) this.commandCount++;
    for (const listener of this.listeners) {
      try { listener(this.getState()); } catch { /* Consumer-owned callbacks. */ }
    }
    return this.getState();
  }
  _available() { if (this.disposed) throw new Error('This virtual board has been disposed.'); }
  _enabled() {
    this._available();
    if (!this.enabled) throw new Error('Enable the Virtual Board Lab first.');
  }
  enable({boardId = this.boardId} = {}) {
    this._available();
    const board = requireBoard(boardId);
    if (this.enabled && boardId === this.boardId) return this.getState();
    this.board = board; this.boardId = boardId; this._clearModel(); this.enabled = true;
    return this._emit('Virtual Board Lab enabled; no physical board is connected by this lab', false);
  }
  disable() {
    this._clearModel(); this.enabled = false;
    return this._emit('Virtual Board Lab disabled', false);
  }
  setBoard(boardId) {
    this._available(); const board = requireBoard(boardId);
    if (boardId === this.boardId) return this.getState();
    this.board = board; this.boardId = boardId; this._clearModel();
    return this._emit('Virtual board changed; inputs and outputs reset', false);
  }
  reset() {
    this._enabled(); this._clearModel();
    return this._emit('Virtual board reset; inputs, outputs and timer reservations cleared', false);
  }
  dispose() {
    if (this.disposed) return;
    this.disable(); this.listeners.clear(); this.disposed = true;
  }

  _pin(pin, capability = 'digital') { return this.pins.get(validatePin(this.board, pin, capability)); }
  _release(pin) {
    if (pin.kind === 'tone') this._clearToneTimer();
    delete pin.durationSeconds; delete pin.endsAt;
    pin.kind = null; pin.value = 0;
  }
  _kind(kind) { return [...this.pins.values()].filter(pin => pin.kind === kind); }
  _isESP() { return this.board.family === 'Espressif ESP32'; }

  setDigitalInput(pin, value) {
    this._enabled(); const p = this._pin(pin);
    p.input = value === null ? null : validateInteger(value, 0, 1, 'Virtual digital input');
    return this._emit(`Virtual input ${p.pin}: ${p.input === null ? 'default' : p.input}`, false);
  }
  setAnalogInput(pin, value) {
    this._enabled(); const p = validatePin(this.board, pin, 'analog');
    const v = validateInteger(value, 0, this.board.analogMax, 'Virtual analog input');
    this.analogInputs[p] = v;
    return this._emit(`Virtual analog input ${p}: ${v}`, false);
  }
  async setPinMode(pin, mode) {
    this._enabled();
    if (!['INPUT', 'INPUT_PULLUP', 'OUTPUT'].includes(mode)) throw new Error('Pin mode must be INPUT, INPUT_PULLUP or OUTPUT.');
    const p = this._pin(pin, mode === 'OUTPUT' ? 'output' : mode === 'INPUT_PULLUP' ? 'pullup' : 'digital');
    this._release(p); p.mode = mode;
    if (mode === 'OUTPUT') p.kind = 'digital';
    this._emit(`Pin ${p.pin} mode: ${mode}`); return true;
  }
  async digitalWrite(pin, value) {
    this._enabled(); const p = this._pin(pin, 'output'), v = validateInteger(value, 0, 1, 'Digital value');
    this._release(p); Object.assign(p, {mode: 'OUTPUT', kind: 'digital', value: v});
    this._emit(`Pin ${p.pin}: ${v ? 'HIGH' : 'LOW'}`); return v;
  }
  async analogWrite(pin, value) {
    this._enabled(); const p = this._pin(pin, 'pwm'), v = validateInteger(value, 0, 255, 'PWM value');
    if (!this._isESP() && ((this.servoTimerUsed && this.board.pwmServoConflict.includes(p.pin)) || (this.toneTimerUsed && this.board.pwmToneConflict.includes(p.pin)))) {
      throw new Error(`Virtual pin ${p.pin}: PWM timer is reserved by servo or tone. Reset the virtual board to clear the reservation.`);
    }
    if (this._isESP() && p.kind !== 'pwm' && this._kind('pwm').length >= 8) throw new Error('Virtual ESP32 has eight PWM slots. Stop an existing output first.');
    this._release(p); Object.assign(p, {mode: 'OUTPUT', kind: 'pwm', value: v});
    this._emit(`Pin ${p.pin} PWM: ${v}/255`); return v;
  }
  async readDigital(pin) {
    this._enabled(); const p = this._pin(pin);
    if (['pwm', 'servo', 'tone'].includes(p.kind)) throw new Error(`Virtual pin ${p.pin} is producing ${p.kind}. Its instantaneous digital waveform is not simulated. Use an input or digital output pin.`);
    const value = p.mode === 'OUTPUT' ? p.value : (p.input ?? (p.mode === 'INPUT_PULLUP' ? 1 : 0));
    this._emit(`Read virtual pin ${p.pin}: ${value}`); return value;
  }
  async readAnalog(pin) {
    this._enabled(); const p = validatePin(this.board, pin, 'analog'), value = this.analogInputs[p];
    this._emit(`Read virtual analog ${p}: ${value}`); return value;
  }
  async servoWrite(pin, angle) {
    this._enabled(); const p = this._pin(pin, 'output'), value = validateInteger(angle, 0, 180, 'Servo angle');
    if (!this._isESP() && this._kind('pwm').some(output => this.board.pwmServoConflict.includes(output.pin))) throw new Error('Virtual servo timer conflicts with active PWM. Stop that PWM output first.');
    if (p.kind !== 'servo' && this._kind('servo').length >= this.board.servoSlots) throw new Error(`Virtual board has ${this.board.servoSlots} servo slots. Detach a servo first.`);
    this._release(p); Object.assign(p, {mode: 'OUTPUT', kind: 'servo', value});
    if (!this._isESP()) this.servoTimerUsed = true;
    this._emit(`Pin ${p.pin} servo: ${value}°`); return value;
  }
  async servoDetach(pin) {
    this._enabled(); const p = this._pin(pin, 'output');
    if (p.kind === 'servo') this._release(p);
    this._emit(`Detach virtual servo on pin ${p.pin}`); return true;
  }
  async tone(pin, frequency, durationSeconds = 0) {
    this._enabled(); const p = this._pin(pin, 'output'), hz = validateInteger(frequency, 31, 20000, 'Tone frequency');
    const seconds = Number(durationSeconds);
    if (durationSeconds === null || durationSeconds === '' || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new Error('Tone duration must be from 0 to 3600 seconds; 0 plays until stopped.');
    if (!this._isESP() && this._kind('pwm').some(output => this.board.pwmToneConflict.includes(output.pin))) throw new Error('Virtual tone timer conflicts with active PWM. Stop that PWM output first.');
    for (const previous of this._kind('tone')) this._release(previous);
    this._release(p);
    const milliseconds = seconds > 0 ? Math.max(1, Math.round(seconds * 1000)) : 0;
    Object.assign(p, {mode: 'OUTPUT', kind: 'tone', value: hz, durationSeconds: seconds, endsAt: milliseconds ? this.now() + milliseconds : null});
    if (!this._isESP()) this.toneTimerUsed = true;
    if (milliseconds) {
      const token = this.toneToken;
      this.toneTimer = this.timers.setTimeout(() => {
        if (token !== this.toneToken || !this.enabled || this.disposed) return;
        this._release(p); this._emit(`Virtual tone on pin ${p.pin} finished`, false);
      }, milliseconds);
    }
    this._emit(`Pin ${p.pin} tone: ${hz} Hz${seconds ? ` for ${seconds} s` : ' until stopped'} (visual only)`); return true;
  }
  async noTone(pin) {
    this._enabled(); const p = this._pin(pin, 'output');
    if (p.kind === 'tone') this._release(p);
    this._emit(`Stop virtual tone on pin ${p.pin}`); return true;
  }
  async stop() {
    this._enabled();
    this._clearToneTimer();
    for (const p of this.pins.values()) { this._release(p); p.mode = 'INPUT'; }
    this._emit('Virtual outputs stopped; controlled inputs kept'); return true;
  }
}

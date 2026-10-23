export const PROTOCOL_VERSION = 1;
export const MAX_LINE_BYTES = 128;

export function encodeRequest(id, command, ...args) {
  if (!Number.isInteger(id) || id < 1 || id > 65535) throw new Error('Invalid request identifier.');
  if (!/^[A-Z]+$/.test(command)) throw new Error('Invalid protocol command.');
  const tokens = args.map(value => String(value));
  if (tokens.some(token => !/^[A-Z0-9_]+$/.test(token))) throw new Error('Invalid protocol argument.');
  const line = `${id} ${command}${tokens.length ? ` ${tokens.join(' ')}` : ''}\n`;
  if (line.length > MAX_LINE_BYTES) throw new Error('Protocol request too long.');
  return new TextEncoder().encode(line);
}

export function parseResponse(line) {
  const match = /^(\d{1,5}) (OK|ERR)(?: ([A-Za-z0-9_ .-]+))?$/.exec(line.trim());
  if (!match || line.length > MAX_LINE_BYTES) return null;
  const id = Number(match[1]);
  if (id > 65535 || id < 1) return null;
  return {id, ok: match[2] === 'OK', payload: match[3] || ''};
}

export class LineDecoder {
  constructor() { this.buffer = ''; this.discarding = false; }
  push(chunk) {
    const lines = [];
    // Protocol is ASCII. Avoid retaining unbounded data from an unexpected device.
    for (const byte of chunk) {
      if (byte === 10) {
        if (!this.discarding && this.buffer) lines.push(this.buffer);
        this.buffer = ''; this.discarding = false;
      } else if (byte !== 13) {
        if (byte < 32 || byte > 126 || this.buffer.length >= MAX_LINE_BYTES) {
          this.discarding = true; this.buffer = '';
        } else if (!this.discarding) this.buffer += String.fromCharCode(byte);
      }
    }
    return lines;
  }
}

// DUETBlox hardware catalog. "implemented" describes software, never hardware certification.
const range = (from, to) => Array.from({length: to - from + 1}, (_, i) => from + i);
const reference = 'https://ai.thestempedia.com/extension/3d-and-xr-studio-my-blocks/';
const releaseNotes = 'https://thestempedia.com/product/pictoblox/release-notes/';
const avr = (id, name, firmwareId, fqbn, digitalMax, analogCount, pwm, source) => ({
  id, name, family: 'Arduino AVR', stage: 1, firmwareId, fqbn,
  status: 'implemented-unverified', live: true, export: true, physicalVerified: false,
  transport: 'USB serial', firmware: 'DUETBlox Live v1',
  digitalPins: range(2, digitalMax), analogPins: range(0, analogCount - 1).map(i => `A${i}`),
  pwmPins: pwm, outputPins: range(2, digitalMax), pullupPins: range(2, digitalMax), reservedPins: [0, 1], voltage: 5, analogMax: 1023,
  core: 'arduino:avr', servoSlots: 4, pwmServoConflict: firmwareId === 'MEGA' ? [44,45,46] : [9,10], pwmToneConflict: firmwareId === 'MEGA' ? [9,10] : [3,11],
  note: 'Software implemented; physical board validation pending. Pins 0/1 reserved for USB serial.',
  source, catalogSource: reference
});
const espOutputs = [4,13,14,16,17,18,19,21,22,23,25,26,27,32,33];
const esp = (camera = false) => ({
  id: camera ? 'esp32-cam' : 'esp32', name: camera ? 'ESP32-CAM (AI Thinker)' : 'ESP32-WROOM DevKit',
  family: 'Espressif ESP32', stage: 2, firmwareId: camera ? 'ESP32CAM' : 'ESP32',
  fqbn: camera ? 'esp32:esp32:esp32cam' : 'esp32:esp32:esp32', core: 'esp32:esp32',
  status: 'implemented-unverified', live: true, export: true, physicalVerified: false,
  transport: camera ? 'USB-to-UART adapter' : 'USB serial', firmware: 'DUETBlox Live v1', voltage: 3.3,
  digitalPins: camera ? [4,13,14] : [...espOutputs,34,35,36,39],
  outputPins: camera ? [4,13,14] : espOutputs, pullupPins: camera ? [4,13,14] : espOutputs,
  analogPins: camera ? [] : ['32','33','34','35','36','39'], analogMax: 4095,
  pwmPins: camera ? [4,13,14] : espOutputs, servoSlots: 4, pwmServoConflict: [], pwmToneConflict: [],
  reservedPins: camera ? range(0,39).filter(pin => ![4,13,14].includes(pin)) : [0,1,2,3,5,6,7,8,9,10,11,12,15],
  note: camera ? 'AI Thinker ESP32-CAM only. GPIO 4 drives the flash LED; GPIO 4/13/14 share the SD socket, so remove the SD card. Camera/PSRAM/boot/UART pins reserved; camera capture and SD blocks are not implemented. External USB-to-UART adapter/manual BOOT reset may be needed. Physical validation pending.' : 'Classic ESP32-WROOM only, not C3/S3/WROVER. GPIO 34/35/36/39 are input-only without internal pull-ups. ADC1 only (0–4095). Boot/flash/UART pins reserved. Physical validation pending.',
  source: camera ? 'https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h' : 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html', catalogSource: reference
});
const planned = (id, name, family, stage = 2, source = reference, note = 'Adapter, firmware, generator and physical validation pending.') => ({
  id, name, family, stage, status: 'planned', live: false, export: false, physicalVerified: false,
  digitalPins: [], analogPins: [], pwmPins: [], reservedPins: [], note, source, catalogSource: source
});

export const boardRegistry = Object.freeze([
  avr('arduino-uno', 'Arduino Uno R3', 'UNO', 'arduino:avr:uno', 13, 6, [3,5,6,9,10,11], 'https://docs.arduino.cc/hardware/uno-rev3/'),
  avr('arduino-mega', 'Arduino Mega 2560', 'MEGA', 'arduino:avr:mega:cpu=atmega2560', 53, 16, [...range(2,13),44,45,46], 'https://docs.arduino.cc/hardware/mega-2560/'),
  avr('arduino-nano', 'Arduino Nano (classic ATmega328P)', 'NANO', 'arduino:avr:nano:cpu=atmega328', 13, 8, [3,5,6,9,10,11], 'https://docs.arduino.cc/hardware/nano/'),
  esp(), esp(true),
  planned('evive', 'evive', 'Arduino-compatible'),
  planned('t-watch', 'T-Watch', 'Espressif'),
  planned('boffin', 'Boffin', 'Arduino-compatible'),
  planned('tecbits', 'TECbits', 'Arduino-compatible'),
  planned('microbit', 'micro:bit', 'micro:bit'),
  planned('lego-ev3', 'LEGO EV3', 'LEGO'),
  planned('lego-boost', 'LEGO Boost', 'LEGO'),
  planned('lego-wedo', 'LEGO WeDo 2.0', 'LEGO'),
  planned('go-dfa', 'Go DFA', 'Other'),
  planned('quarky', 'Quarky', 'STEMpedia', 3),
  planned('quarky-intellio', 'Quarky Intellio', 'STEMpedia', 3, releaseNotes),
  planned('wizbot', 'Wizbot', 'STEMpedia', 3),
  planned('wizbot-maxx', 'Wizbot Maxx', 'STEMpedia', 3, releaseNotes)
].map(board => Object.freeze({...board,
  inCurrentWebCatalog: !['esp32-cam', 'boffin', 'quarky-intellio', 'wizbot-maxx'].includes(board.id),
  digitalPins: Object.freeze(board.digitalPins), analogPins: Object.freeze(board.analogPins),
  outputPins: Object.freeze(board.outputPins || []), pullupPins: Object.freeze(board.pullupPins || []),
  pwmServoConflict: Object.freeze(board.pwmServoConflict || []), pwmToneConflict: Object.freeze(board.pwmToneConflict || []),
  pwmPins: Object.freeze(board.pwmPins), reservedPins: Object.freeze(board.reservedPins)})));

export function getBoard(id) { return boardRegistry.find(board => board.id === id) ?? null; }

export function requireBoard(id, capability = 'live') {
  const board = getBoard(id);
  if (!board) throw new Error(`Unknown board: ${id}`);
  if (!board[capability]) throw new Error(`${board.name}: ${capability} support is planned and not implemented.`);
  return board;
}

export function validatePin(boardOrId, pin, capability = 'digital') {
  const board = typeof boardOrId === 'string' ? requireBoard(boardOrId) : boardOrId;
  if (!board) throw new Error('Select a board first.');
  if (capability === 'analog') {
    const canonical = String(pin).trim().toUpperCase();
    if (!board.analogPins.includes(canonical)) throw new Error(`${board.name}: analog pin ${pin} is unavailable.`);
    return canonical;
  }
  if (typeof pin === 'string' && !/^\d+$/.test(pin.trim())) throw new Error(`Invalid digital pin: ${pin}`);
  const value = Number(pin);
  if (!Number.isInteger(value) || !board.digitalPins.includes(value)) {
    if (board.reservedPins.includes(value)) throw new Error(`Pin ${value} is reserved for serial, flash, boot or onboard peripherals.`);
    throw new Error(`${board.name}: digital pin ${pin} is unavailable.`);
  }
  if (capability === 'pwm' && !board.pwmPins.includes(value)) throw new Error(`${board.name}: pin ${value} does not support PWM.`);
  if (capability === 'output' && !board.outputPins.includes(value)) throw new Error(`${board.name}: pin ${value} is input-only.`);
  if (capability === 'pullup' && !board.pullupPins.includes(value)) throw new Error(`${board.name}: pin ${value} has no internal pull-up.`);
  return value;
}

export function validateInteger(value, min, max, label) {
  if (typeof value === 'boolean' || value === '' || value === null || value === undefined) throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  return n;
}

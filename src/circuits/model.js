import {requireBoard} from '../hardware/boards.js';

export const CIRCUIT_VERSION = 1;
export const CIRCUIT_LIMITS = Object.freeze({components: 36, wires: 160, width: 1400, height: 900});
export const COMPONENT_TYPES = Object.freeze({
  resistor: {label: 'Resistor', terminals: ['a', 'b'], defaults: {resistance: 220}},
  led: {label: 'LED', terminals: ['anode', 'cathode'], defaults: {color: 'red'}},
  button: {label: 'Push button', terminals: ['a', 'b'], defaults: {pressed: false}},
  potentiometer: {label: 'Potentiometer', terminals: ['a', 'wiper', 'b'], defaults: {resistance: 10000, position: 0.5}},
  servo: {label: 'Servo', terminals: ['power', 'signal', 'ground'], defaults: {}},
  buzzer: {label: 'Piezo buzzer', terminals: ['positive', 'negative'], defaults: {}},
  breadboard: {label: 'Mini breadboard', terminals: [...Array.from({length: 10}, (_, i) => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(letter => `${letter}${i + 1}`)).flat(), '+1', '+2', '+3', '+4', '-1', '-2', '-3', '-4'], defaults: {}}
});

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/;
function finite(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a finite number from ${min} to ${max}.`);
  return value;
}
export function analogPort(pin) { return String(pin).startsWith('A') ? String(pin) : `D${pin}`; }
export function boardTerminals(boardId) {
  const board = requireBoard(boardId);
  return [...new Set(['GND', '5V', '3V3', ...board.digitalPins.map(pin => `D${pin}`), ...board.analogPins.map(analogPort)])];
}
export function emptyCircuit(boardId = 'arduino-uno') {
  requireBoard(boardId);
  return {kind: 'duetblox-circuit', version: CIRCUIT_VERSION, boardId, components: [], wires: []};
}
export function createComponent(type, id, position = {}) {
  const info = Object.hasOwn(COMPONENT_TYPES, type) ? COMPONENT_TYPES[type] : null;
  if (!info || !idPattern.test(id) || id === 'board') throw new Error('Choose a supported component and a unique component ID.');
  return {id, type, x: position.x ?? 480, y: position.y ?? 150, params: {...info.defaults}};
}
export function terminalIds(circuit) {
  return [...boardTerminals(circuit.boardId).map(pin => `board:${pin}`), ...circuit.components.flatMap(component => COMPONENT_TYPES[component.type].terminals.map(pin => `${component.id}:${pin}`))];
}
export function validateCircuit(value, {boardId} = {}) {
  if (!record(value) || value.kind !== 'duetblox-circuit' || value.version !== CIRCUIT_VERSION) throw new Error('This is not a supported DUETBlox circuit file (version 1).');
  requireBoard(value.boardId);
  if (boardId && value.boardId !== boardId) throw new Error('The circuit and selected board must match.');
  if (!Array.isArray(value.components) || value.components.length > CIRCUIT_LIMITS.components) throw new Error(`A circuit can contain at most ${CIRCUIT_LIMITS.components} components.`);
  if (!Array.isArray(value.wires) || value.wires.length > CIRCUIT_LIMITS.wires) throw new Error(`A circuit can contain at most ${CIRCUIT_LIMITS.wires} wires.`);
  const ids = new Set(['board']);
  const components = value.components.map(item => {
    if (!record(item) || typeof item.id !== 'string' || !idPattern.test(item.id) || ids.has(item.id)) throw new Error('Every component needs a unique, valid ID.');
    if (!Object.hasOwn(COMPONENT_TYPES, item.type)) throw new Error(`Unsupported circuit component: ${String(item.type).slice(0, 60)}`);
    ids.add(item.id);
    if (!record(item.params)) throw new Error(`${item.id}: component settings are missing.`);
    const params = {};
    if (item.type === 'resistor' || item.type === 'potentiometer') params.resistance = finite(item.params.resistance, 1, 10000000, 'Resistance (ohms)');
    if (item.type === 'potentiometer') params.position = finite(item.params.position, 0, 1, 'Potentiometer position');
    if (item.type === 'button') { if (typeof item.params.pressed !== 'boolean') throw new Error('Button pressed state must be true or false.'); params.pressed = item.params.pressed; }
    if (item.type === 'led') { if (!['red', 'green', 'blue', 'yellow', 'white'].includes(item.params.color)) throw new Error('Choose a supported LED colour.'); params.color = item.params.color; }
    return {id: item.id, type: item.type, x: finite(item.x, 300, CIRCUIT_LIMITS.width - 220, 'Component horizontal position'), y: finite(item.y, 30, CIRCUIT_LIMITS.height - 280, 'Component vertical position'), params};
  });
  const result = {...emptyCircuit(value.boardId), components};
  const terminals = new Set(terminalIds(result)), wireIds = new Set(), pairs = new Set();
  result.wires = value.wires.map(wire => {
    if (!record(wire) || typeof wire.id !== 'string' || !idPattern.test(wire.id) || wireIds.has(wire.id)) throw new Error('Every wire needs a unique, valid ID.');
    if (!terminals.has(wire.from) || !terminals.has(wire.to)) throw new Error('A wire refers to a pin that does not exist on this board or component.');
    if (wire.from === wire.to) throw new Error('Connect two different terminals.');
    const pair = [wire.from, wire.to].sort().join('|');
    if (pairs.has(pair)) throw new Error('These terminals are already connected by a wire.');
    wireIds.add(wire.id); pairs.add(pair);
    return {id: wire.id, from: wire.from, to: wire.to};
  });
  return result;
}

export const STARTER_CIRCUITS = Object.freeze([
  {id: 'led', label: 'LED + resistor'}, {id: 'sensor', label: 'Sensor → LED'}, {id: 'button', label: 'Button + pull-up'},
  {id: 'pot', label: 'Potentiometer + ADC'}, {id: 'servo', label: 'Servo motor'},
  {id: 'buzzer', label: 'Piezo buzzer'}, {id: 'blank', label: 'Empty workbench'}
]);
export function createStarterCircuit(name, boardId = 'arduino-uno') {
  const circuit = emptyCircuit(boardId), board = requireBoard(boardId);
  if (name === 'blank') return circuit;
  const out = board.outputPins.includes(13) ? 13 : board.outputPins[0];
  if (name === 'sensor') {
    const led = createStarterCircuit('led', boardId), pot = createStarterCircuit('pot', boardId);
    pot.components[0].x = 480; pot.components[0].y = 400;
    return validateCircuit({...led, components: [...led.components, ...pot.components], wires: [...led.wires, ...pot.wires.map((wire, index) => ({...wire, id: `sensorWire${index + 1}`}))]});
  }
  const add = (type, id, x, y, params = {}) => circuit.components.push({...createComponent(type, id, {x, y}), params: {...COMPONENT_TYPES[type].defaults, ...params}});
  const wire = (from, to) => circuit.wires.push({id: `wire${circuit.wires.length + 1}`, from, to});
  if (name === 'led') {
    add('resistor', 'r1', 450, 180); add('led', 'led1', 720, 180);
    wire(`board:D${out}`, 'r1:a'); wire('r1:b', 'led1:anode'); wire('led1:cathode', 'board:GND');
  } else if (name === 'button') {
    add('button', 'button1', 500, 160);
    wire(`board:D${board.pullupPins[0]}`, 'button1:a'); wire('button1:b', 'board:GND');
  } else if (name === 'pot') {
    if (!board.analogPins.length) throw new Error(`${board.name} has no available analog inputs in this profile. Choose Uno or ESP32-WROOM.`);
    add('potentiometer', 'pot1', 500, 160);
    wire(`board:${board.voltage === 5 ? '5V' : '3V3'}`, 'pot1:a'); wire('pot1:b', 'board:GND'); wire('pot1:wiper', `board:${analogPort(board.analogPins[0])}`);
  } else if (name === 'servo') {
    add('servo', 'servo1', 530, 180);
    wire('board:5V', 'servo1:power'); wire('board:GND', 'servo1:ground'); wire(`board:D${board.outputPins.includes(9) ? 9 : out}`, 'servo1:signal');
  } else if (name === 'buzzer') {
    add('buzzer', 'buzzer1', 530, 180);
    wire(`board:D${board.outputPins.includes(8) ? 8 : out}`, 'buzzer1:positive'); wire('board:GND', 'buzzer1:negative');
  } else throw new Error('Unknown starter circuit.');
  return validateCircuit(circuit);
}

export function validateCircuitLibrary(value) {
  if (!record(value) || value.kind !== 'duetblox-circuit-library' || value.version !== 1 || !record(value.circuits)) throw new Error('Invalid circuit library (version 1 required).');
  requireBoard(value.activeBoardId);
  const entries = Object.entries(value.circuits);
  if (!entries.length || entries.length > 5) throw new Error('A circuit library must contain one to five supported board circuits.');
  const circuits = {};
  for (const [boardId, circuit] of entries) { requireBoard(boardId); circuits[boardId] = validateCircuit(circuit, {boardId}); }
  if (!Object.hasOwn(circuits, value.activeBoardId)) throw new Error('The active board must have a circuit in the library.');
  return {kind: 'duetblox-circuit-library', version: 1, activeBoardId: value.activeBoardId, circuits};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCircuit, createComponent, createStarterCircuit, validateCircuit, validateCircuitLibrary} from './model.js';
import {solveCircuit} from './solver.js';
import {CircuitBoardService} from './service.js';

const high = {pins: [{pin: 13, mode: 'OUTPUT', kind: 'digital', value: 1}]};
const near = (actual, expected, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
test('wired LED uses a resistor and actual GPIO voltage; opening the return wire turns it off', () => {
  const circuit = createStarterCircuit('led');
  const result = solveCircuit(circuit, high);
  assert.equal(result.safe, true); assert.equal(result.components.led1.lit, true);
  near(result.components.led1.current, (5 - 1.9) / (25 + 220 + 10), 0.00001);
  assert.equal(solveCircuit(circuit, {pins: [{...high.pins[0], value: 0}]}).components.led1.lit, false);
  circuit.wires.pop();
  const disconnected = solveCircuit(circuit, high);
  assert.equal(disconnected.valid, true); assert.equal(disconnected.components.led1.lit, false);
});
test('LED reverse polarity, absent resistance and GPIO shorts produce distinct diagnostics', () => {
  const reverse = createStarterCircuit('led');
  reverse.wires[1].to = 'led1:cathode'; reverse.wires[2].from = 'led1:anode';
  const result = solveCircuit(reverse, high);
  assert.equal(result.components.led1.lit, false); assert.ok(result.diagnostics.some(d => d.code === 'led-reversed'));
  const direct = createStarterCircuit('led'); direct.wires[0].to = 'led1:anode'; direct.wires.splice(1, 1);
  const unsafe = solveCircuit(direct, high);
  assert.equal(unsafe.safe, false); assert.ok(unsafe.diagnostics.some(d => d.code === 'led-resistor-missing'));
  assert.ok(unsafe.diagnostics.some(d => d.code === 'led-overcurrent'));
  const short = emptyCircuit(); short.wires.push({id: 'short', from: 'board:D13', to: 'board:GND'});
  assert.ok(solveCircuit(short, high).diagnostics.some(d => d.code === 'gpio-overcurrent'));
  short.wires.push({id: 'supplyshort', from: 'board:5V', to: 'board:GND'});
  assert.equal(solveCircuit(short, high).valid, false);
});
test('push button has a real pull-up path, reads HIGH released and LOW pressed', async () => {
  const service = new CircuitBoardService(); service.enable(); service.loadStarter('button');
  await service.setPinMode(2, 'INPUT_PULLUP');
  assert.equal(await service.readDigital(2), 1);
  service.setComponentValue('button1', 'pressed', true);
  assert.equal(await service.readDigital(2), 0);
  service.setComponentValue('button1', 'pressed', false);
  await service.setPinMode(2, 'INPUT');
  await assert.rejects(service.readDigital(2), /floating/);
  service.dispose();
});
test('potentiometer voltage is computed from both resistances and feeds board ADC', async () => {
  for (const boardId of ['arduino-uno', 'arduino-mega', 'arduino-nano', 'esp32']) {
    const service = new CircuitBoardService({boardId}); service.enable(); service.loadStarter('pot');
    const pin = service.board.analogPins[0];
    near(service.circuitResult.components.pot1.voltage, service.board.voltage / 2);
    near(await service.readAnalog(pin), service.board.analogMax / 2, 1);
    service.setComponentValue('pot1', 'position', 1);
    assert.equal(await service.readAnalog(pin), service.board.analogMax);
    service.setComponentValue('pot1', 'position', 0);
    assert.equal(await service.readAnalog(pin), 0);
    service.dispose();
  }
  assert.throws(() => createStarterCircuit('pot', 'esp32-cam'), /no available analog inputs/);
});
test('the sensor starter connects a real potentiometer input and separate current-limited LED', async () => {
  const service = new CircuitBoardService(); service.enable(); service.loadStarter('sensor');
  assert.equal(service.getCircuit().components.length, 3); assert.equal(service.getCircuit().wires.length, 6);
  service.setComponentValue('pot1', 'position', 0.8);
  const reading = await service.readAnalog('A0'); assert.ok(reading > 800);
  await service.digitalWrite(13, reading > 511 ? 1 : 0); assert.equal(service.circuitResult.components.led1.lit, true);
  service.setComponentValue('pot1', 'position', 0.1);
  await service.digitalWrite(13, await service.readAnalog('A0') > 511 ? 1 : 0); assert.equal(service.circuitResult.components.led1.lit, false);
  assert.equal(service.circuitResult.safe, true); service.dispose();
});
test('PWM averages voltage; servo needs wired power/ground/signal; buzzer needs a tone command', async () => {
  const service = new CircuitBoardService(); service.enable();
  const led = createStarterCircuit('led'); led.wires[0].from = 'board:D3'; service.setCircuit(led);
  await service.analogWrite(3, 128);
  near(service.circuitResult.components.led1.current, (5 * 128 / 255 - 1.9) / 255, 0.00001);
  service.reset(); service.loadStarter('servo'); await service.servoWrite(9, 125);
  assert.equal(service.circuitResult.components.servo1.angle, 125);
  assert.equal(service.circuitResult.pins.D9.waveform, 'servo');
  assert.ok(!service.circuitResult.diagnostics.some(d => d.code === 'floating-input' && d.componentId === 'D9'));
  const disconnected = service.getCircuit(); disconnected.wires.pop(); service.setCircuit(disconnected);
  assert.equal(service.circuitResult.components.servo1.active, false);
  service.reset(); service.loadStarter('buzzer'); await service.tone(8, 440);
  assert.equal(service.circuitResult.components.buzzer1.frequency, 440);
  await service.noTone(8); assert.equal(service.circuitResult.components.buzzer1.frequency, 0);
  service.dispose();
});
test('ESP32 rejects overvoltage rather than pretending 5 V input is safe', () => {
  const circuit = emptyCircuit('esp32'); circuit.wires.push({id: 'wire', from: 'board:5V', to: 'board:D32'});
  const result = solveCircuit(circuit);
  assert.equal(result.safe, false); assert.ok(result.diagnostics.some(d => d.code === 'pin-overvoltage'));
});
test('breadboard rows join a-e and f-j separately and rails are connected', () => {
  const circuit = emptyCircuit(); circuit.components.push(createComponent('breadboard', 'bb'));
  circuit.wires.push({id: 'wire1', from: 'board:5V', to: 'bb:a1'}, {id: 'wire2', from: 'bb:e1', to: 'board:A0'});
  const result = solveCircuit(circuit);
  near(result.pins.A0.voltage, 5); assert.equal(result.terminalVoltages['bb:f1'], null);
  assert.equal(result.nets['bb:+1'], result.nets['bb:+4']); assert.notEqual(result.nets['bb:+1'], result.nets['bb:-1']);
});
test('malformed imports, duplicate wires, invalid terminals, nonfinite values and bounds are rejected', () => {
  const base = createStarterCircuit('led');
  for (const mutate of [c => c.version = 99, c => c.components[0].x = NaN, c => c.components[0].params.resistance = Infinity, c => c.components[0].params.resistance = 0, c => c.components[0].type = '__proto__', c => c.wires[0].to = 'board:D999', c => c.wires.push({...c.wires[0], id: 'duplicate'}), c => c.components.push({...c.components[0]})]) {
    const value = structuredClone(base); mutate(value); assert.throws(() => validateCircuit(value));
  }
  assert.throws(() => validateCircuit(base, {boardId: 'esp32'}), /must match/);
  assert.throws(() => validateCircuit({...base, wires: Array(161).fill(base.wires[0])}), /at most 160/);
});
test('circuit snapshots are isolated, reset retains wiring, switching board preserves each board circuit', async () => {
  const service = new CircuitBoardService(); service.enable(); service.loadStarter('led');
  const copy = service.getState(); copy.circuit.wires.length = 0; copy.circuitResult.pins.D13.voltage = 999;
  assert.equal(service.getCircuit().wires.length, 3);
  const revision = service.circuitRevision;
  await service.digitalWrite(13, 1); service.reset(); assert.equal(service.getCircuit().wires.length, 3);
  assert.equal(service.circuitRevision, revision);
  assert.equal(service.circuitResult.components.led1.lit, false);
  service.setBoard('esp32'); assert.equal(service.getCircuit().boardId, 'esp32'); assert.equal(service.getCircuit().wires.length, 0);
  service.setBoard('arduino-uno'); assert.equal(service.getCircuit().wires.length, 3);
  service.dispose();
});
test('a maximum disconnected breadboard workspace remains bounded and does not affect GPIO readings', () => {
  const circuit = emptyCircuit(); for (let i = 0; i < 36; i++) circuit.components.push(createComponent('breadboard', `bb${i}`));
  const started = performance.now(); const result = solveCircuit(circuit);
  assert.equal(result.valid, true); assert.ok(performance.now() - started < 1000);
});
test('the whole per-board circuit library survives a fresh service and rejects malformed board maps', () => {
  const service = new CircuitBoardService(); service.loadStarter('led'); service.setBoard('esp32'); service.loadStarter('pot');
  const library = service.getCircuitLibrary(), restored = new CircuitBoardService(); restored.setCircuitLibrary(library);
  assert.equal(restored.boardId, 'esp32'); assert.equal(restored.getCircuit().components[0].type, 'potentiometer');
  restored.setBoard('arduino-uno'); assert.equal(restored.getCircuit().components[1].type, 'led');
  library.circuits['arduino-uno'].wires.length = 0; assert.equal(restored.getCircuit().wires.length, 3);
  const bad = restored.getCircuitLibrary(); bad.circuits.esp32.boardId = 'arduino-uno'; assert.throws(() => validateCircuitLibrary(bad), /must match/);
  assert.throws(() => validateCircuitLibrary({...restored.getCircuitLibrary(), activeBoardId: 'arduino-mega'}), /active board/);
  service.dispose(); restored.dispose();
});

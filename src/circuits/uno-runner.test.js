import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UnoFirmwareRunner, parseUnoHex} from './uno-runner.js';
import {createStarterCircuit} from './model.js';
const hex = name => readFileSync(new URL(`./fixtures/uno-${name}.hex`, import.meta.url), 'utf8');
const advance = (runner, cycles) => { const target = runner.cpu.cycles + cycles; while (runner.cpu.cycles < target) runner.runCycles(Math.min(target - runner.cpu.cycles, 160000), {timeBudgetMs: 1000}); return runner.getState(); };

test('actual generated Uno blink HEX executes instructions, Timer0 delays and wired LED current', () => {
  const runner = new UnoFirmwareRunner({hex: hex('blink'), circuit: createStarterCircuit('led')});
  const on = advance(runner, 160000); assert.equal(on.circuitResult.components.led1.lit, true); assert.ok(on.cycles >= 160000);
  const off = advance(runner, 320000); assert.equal(off.circuitResult.components.led1.lit, false);
  assert.equal(advance(runner, 320000).circuitResult.components.led1.lit, true);
  const open = createStarterCircuit('led'); open.wires.pop(); runner.setCircuit(open);
  assert.equal(runner.getState().circuitResult.components.led1.lit, false);
});
test('actual generated analog-read firmware receives solved potentiometer voltage through AVR ADC', () => {
  const circuit = createStarterCircuit('pot'); circuit.components[0].params.position = 0.8;
  const runner = new UnoFirmwareRunner({hex: hex('analog'), circuit});
  let state = advance(runner, 320000); assert.equal(state.pins.find(p => p.pin === 13).value, 1);
  circuit.components[0].params.position = 0.1; runner.setCircuit(circuit);
  state = advance(runner, 320000); assert.equal(state.pins.find(p => p.pin === 13).value, 0);
});
test('CPU runner refuses wrong boards, malformed HEX and unbounded steps', () => {
  assert.throws(() => new UnoFirmwareRunner({hex: hex('blink'), circuit: createStarterCircuit('led', 'esp32')}), /must match/);
  assert.throws(() => parseUnoHex(':00000001FE'), /checksum/);
  const runner = new UnoFirmwareRunner({hex: hex('blink'), circuit: createStarterCircuit('led')});
  for (const n of [0, -1, Infinity, 16000001]) assert.throws(() => runner.runCycles(n), /CPU step/);
  assert.throws(() => runner.runCycles(100, {timeBudgetMs: Infinity}), /time budget/);
});
test('compiled button firmware reads the physical net logic through AVR PIN registers', () => {
  const circuit = createStarterCircuit('button'), runner = new UnoFirmwareRunner({hex: hex('button'), circuit});
  assert.equal(advance(runner, 320000).pins.find(p => p.pin === 13).value, 1);
  circuit.components[0].params.pressed = true; runner.setCircuit(circuit);
  assert.equal(advance(runner, 320000).pins.find(p => p.pin === 13).value, 0);
});
test('compiled servo and tone generate measured pulse timings; disconnecting signal stops the component', () => {
  for (const [name, starter, id, value] of [['servo', 'servo', 'servo1', 120], ['tone', 'buzzer', 'buzzer1', 440]]) {
    const circuit = createStarterCircuit(starter), runner = new UnoFirmwareRunner({hex: hex(name), circuit});
    const state = advance(runner, 1920000), component = state.circuitResult.components[id];
    assert.equal(component.active, true); assert.ok(Math.abs((component.angle ?? component.frequency) - value) <= 2);
    circuit.wires.pop(); runner.setCircuit(circuit); assert.equal(runner.getState().circuitResult.components[id].active, false);
  }
});
test('compiled PWM toggles the real AVR timer output rather than an invented brightness trace', () => {
  const circuit = createStarterCircuit('led'); circuit.wires[0].from = 'board:D5';
  const runner = new UnoFirmwareRunner({hex: hex('pwm'), circuit}), levels = new Set();
  for (let sample = 0; sample < 40; sample++) levels.add(advance(runner, 20000).pins.find(p => p.pin === 5).value);
  assert.deepEqual([...levels].sort(), [0, 1]);
});

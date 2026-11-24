import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarterCircuit} from './model.js';
import {circuitToSpiceNetlist} from './spice-export.js';
import {validateNetlist} from '../spice/model.js';

test('wired resistor/LED and potentiometer export real connectivity as valid static SPICE netlists', () => {
  const led = circuitToSpiceNetlist(createStarterCircuit('led'), {pins: [{pin: 13, mode: 'OUTPUT', kind: 'digital', value: 1}]});
  assert.equal(validateNetlist(led).analysis.kind, 'op');
  assert.match(led, /Vgpio13 gpio13 0 5/); assert.match(led, /Rpart1 \w+ \w+ 220/); assert.match(led, /\.model led_red D/);
  const pot = circuitToSpiceNetlist(createStarterCircuit('pot', 'esp32'));
  assert.match(pot, /RpotA1 \w+ \w+ 5000/); assert.match(pot, /RpotB1 \w+ 0 5000/);
});
test('waveforms, servo/buzzer behavioral loads and unsafe circuits are never mislabeled as SPICE', () => {
  assert.throws(() => circuitToSpiceNetlist(createStarterCircuit('servo')), /behavioral/);
  assert.throws(() => circuitToSpiceNetlist(createStarterCircuit('buzzer')), /behavioral/);
  assert.throws(() => circuitToSpiceNetlist(createStarterCircuit('led'), {pins: [{pin: 3, mode: 'OUTPUT', kind: 'pwm', value: 128}]}), /timed waveforms/);
  const short = createStarterCircuit('pot'); short.wires.push({id: 'short', from: 'board:5V', to: 'board:GND'});
  assert.throws(() => circuitToSpiceNetlist(short), /Fix the circuit errors/);
});

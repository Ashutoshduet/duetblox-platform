import test from 'node:test';
import assert from 'node:assert/strict';
import {getCircuitLesson, inspectLessonWiring, measureLesson} from './lessons.js';
import {createComponent} from './model.js';
import {CircuitBoardService} from './service.js';
import {replaceCircuitSafely, readCircuitRecovery, circuitRecoveryKey} from './recovery.js';

test('guided lesson signal evidence requires correct wiring and real output changes', async () => {
  const service = new CircuitBoardService();
  const lesson = getCircuitLesson('led', 'arduino-uno');
  service.setCircuit(lesson.expected);
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), []);
  service.enable();
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), []);
  await service.digitalWrite(13, 1);
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), ['ledOn']);
  await service.digitalWrite(13, 0);
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), ['ledOff']);
  const circuit = service.getCircuit(); circuit.wires.pop(); service.setCircuit(circuit);
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), []);
  service.dispose();
});

test('guided wiring accepts equivalent breadboard paths and rejects missing component types', () => {
  const service = new CircuitBoardService(), lesson = getCircuitLesson('led', 'arduino-uno');
  const circuit = structuredClone(lesson.expected); circuit.components.push(createComponent('breadboard', 'bb'));
  circuit.wires[0].to = 'bb:a1'; circuit.wires.push({id:'bridge', from:'bb:e1', to:'r1:a'});
  service.setCircuit(circuit);
  assert.equal(inspectLessonWiring(lesson, service.getCircuit(), service.getState().circuitResult).every(wire => wire.connected), true);
  const mismatched = service.getCircuit(); mismatched.components[0].type = 'button';
  assert.equal(inspectLessonWiring(lesson, mismatched, service.getState().circuitResult).some(wire => wire.connected), false);
  service.dispose();
});

test('button observations need a pull-up and both measured button states', async () => {
  const service = new CircuitBoardService(), lesson = getCircuitLesson('button', 'arduino-uno');
  service.setCircuit(lesson.expected); service.enable();
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), []);
  await service.setPinMode(lesson.input, 'INPUT_PULLUP');
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), ['buttonHigh']);
  service.setComponentValue('button1', 'pressed', true);
  assert.deepEqual(measureLesson(lesson, service.getCircuit(), service.getState()), ['buttonLow']);
  service.dispose();
});

test('ADC lessons use the board range and sensor evidence requires the matching LED output', async () => {
  for(const boardId of ['arduino-uno', 'esp32']) {
    const service = new CircuitBoardService({boardId}), pot = getCircuitLesson('pot', boardId);
    service.setCircuit(pot.expected); service.enable(); service.setComponentValue('pot1', 'position', .1);
    assert.deepEqual(measureLesson(pot, service.getCircuit(), service.getState()), ['analogLow']);
    service.setComponentValue('pot1', 'position', .9);
    assert.deepEqual(measureLesson(pot, service.getCircuit(), service.getState()), ['analogHigh']);
    const sensor = getCircuitLesson('sensor', boardId); service.setCircuit(sensor.expected); service.setComponentValue('pot1', 'position', .9);
    assert.deepEqual(measureLesson(sensor, service.getCircuit(), service.getState()), []);
    await service.digitalWrite(sensor.output, 1);
    assert.deepEqual(measureLesson(sensor, service.getCircuit(), service.getState()), ['sensorOn']);
    service.setComponentValue('pot1', 'position', .1);
    assert.deepEqual(measureLesson(sensor, service.getCircuit(), service.getState()), []);
    await service.digitalWrite(sensor.output, 0);
    assert.deepEqual(measureLesson(sensor, service.getCircuit(), service.getState()), ['sensorOff']);
    service.dispose();
  }
  assert.equal(getCircuitLesson('pot','esp32-cam'), null);
  assert.equal(getCircuitLesson('sensor','esp32-cam'), null);
});

test('circuit replacement persists a validated recovery before changing the circuit', async () => {
  const service = new CircuitBoardService(); service.loadStarter('pot');
  const original = service.getCircuit(), next = getCircuitLesson('led', 'arduino-uno').expected;
  let backup;
  const result = await replaceCircuitSafely({service, next, persist:async(key, value) => {assert.equal(key,circuitRecoveryKey('arduino-uno')); assert.deepEqual(service.getCircuit(), original); backup=value;}, apply:value=>service.setCircuit(value)});
  assert.deepEqual(result,original); assert.deepEqual(readCircuitRecovery(backup,'arduino-uno'),original); assert.deepEqual(service.getCircuit(),next);
  service.dispose();
});

test('storage failure and concurrent workspace changes cannot replace the current circuit', async () => {
  const service = new CircuitBoardService(); service.loadStarter('pot');
  const original = service.getCircuit(), next = getCircuitLesson('led', 'arduino-uno').expected;
  await assert.rejects(replaceCircuitSafely({service, next, persist:async()=>{throw new Error('Storage full');}, apply:()=>assert.fail()}),/Storage full/);
  assert.deepEqual(service.getCircuit(),original);
  await assert.rejects(replaceCircuitSafely({service, next, persist:async()=>{service.loadStarter('button');}, apply:()=>assert.fail()}),/circuit changed/);
  assert.equal(service.getCircuit().components[0].type,'button');
  await assert.rejects(replaceCircuitSafely({service, next, persist:async()=>{}, isCurrent:()=>false, apply:()=>assert.fail()}),/circuit changed/);
  service.dispose();
});

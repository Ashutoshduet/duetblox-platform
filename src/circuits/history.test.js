import test from 'node:test';
import assert from 'node:assert/strict';
import {CircuitEditHistory, getCircuitHistory, clearCircuitHistory} from './history.js';
import {emptyCircuit, createStarterCircuit} from './model.js';

test('circuit history survives panel lookup and separates board histories', () => {
  const service = {}, history = getCircuitHistory(service);
  let uno = emptyCircuit(), esp = emptyCircuit('esp32');
  history.commit(uno, createStarterCircuit('led'), value => { uno = value; });
  history.commit(esp, createStarterCircuit('pot', 'esp32'), value => { esp = value; });
  assert.equal(getCircuitHistory(service), history);
  assert.equal(history.canUndo(uno), true);
  assert.equal(history.canUndo(esp), true);
  history.step(uno, false, value => { uno = value; });
  assert.equal(uno.components.length, 0);
  assert.equal(history.canRedo(uno), true);
  assert.equal(history.canUndo(esp), true);
  history.step(uno, true, value => { uno = value; });
  assert.equal(uno.components.length, 2);
});

test('external circuit replacement and whole-workspace replacement discard stale history', () => {
  const service = {}, history = getCircuitHistory(service);
  let circuit = emptyCircuit();
  history.commit(circuit, createStarterCircuit('led'), value => { circuit = value; });
  assert.equal(history.canUndo(createStarterCircuit('servo')), false);
  clearCircuitHistory(service);
  assert.notEqual(getCircuitHistory(service), history);
  assert.equal(getCircuitHistory(service).canUndo(circuit), false);
});

test('failed and unchanged commits do not consume history; new edits discard redo', () => {
  const history = new CircuitEditHistory(2);
  let circuit = emptyCircuit();
  assert.throws(() => history.commit(circuit, createStarterCircuit('led'), () => { throw new Error('locked'); }), /locked/);
  assert.equal(history.canUndo(circuit), false);
  assert.equal(history.commit(circuit, structuredClone(circuit), () => assert.fail()), false);
  history.commit(circuit, createStarterCircuit('led'), value => { circuit = value; });
  history.step(circuit, false, value => { circuit = value; });
  history.commit(circuit, createStarterCircuit('servo'), value => { circuit = value; });
  assert.equal(history.canRedo(circuit), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchHardware} from './hardware-destination.js';
import {VirtualBoardService} from './virtual-board.js';

function setup({enabled = true, status = 'disconnected'} = {}) {
  const calls = [];
  const realService = {getState: () => ({status}), digitalWrite: async (...args) => { calls.push(args); return 17; }};
  const virtualBoard = new VirtualBoardService(); if (enabled) virtualBoard.enable();
  return {virtualBoard, realService, calls};
}

test('normal Blocks routes exclusively to enabled virtual model', async () => {
  const context = setup();
  const result = await dispatchHardware({...context, sourceIsNormal: true, method: 'digitalWrite', args: [13, 1]});
  assert.equal(result, 1); assert.deepEqual(context.calls, []);
  assert.equal(context.virtualBoard.getState().pins.find(p => p.pin === 13).value, 1);
  context.virtualBoard.dispose();
});

test('virtual failure does not fall back to a physical command', async () => {
  const context = setup();
  await assert.rejects(dispatchHardware({...context, sourceIsNormal: true, method: 'digitalWrite', args: [0, 1]}), /reserved/);
  context.virtualBoard.digitalWrite = async () => { throw new Error('virtual internal failure'); };
  await assert.rejects(dispatchHardware({...context, sourceIsNormal: true, method: 'digitalWrite', args: [13, 1]}), /virtual internal failure/);
  assert.deepEqual(context.calls, []); context.virtualBoard.dispose();
});

for (const status of ['connected', 'connecting', 'disconnecting']) test(`virtual dispatch rejects physical state ${status} before invoking either service`, async () => {
  const context = setup({status});
  await assert.rejects(dispatchHardware({...context, sourceIsNormal: true, method: 'digitalWrite', args: [13, 1]}), /Disconnect the physical board/);
  assert.deepEqual(context.calls, []);
  assert.equal(context.virtualBoard.getState().pins.find(p => p.pin === 13).kind, null);
  context.virtualBoard.dispose();
});

test('Junior and missing/ambiguous source flags cannot use an active virtual lab', async () => {
  const context = setup();
  for (const sourceIsNormal of [false, undefined, null, 1, 'true']) {
    await assert.rejects(dispatchHardware({...context, sourceIsNormal, method: 'digitalWrite', args: [13, 1]}), /normal Blocks only/);
  }
  assert.deepEqual(context.calls, []);
  assert.equal(context.virtualBoard.getState().pins.find(p => p.pin === 13).kind, null);
  context.virtualBoard.dispose();
});

test('disabled virtual lab routes normal and Junior commands to physical service', async () => {
  const context = setup({enabled: false, status: 'connected'});
  for (const sourceIsNormal of [true, false]) assert.equal(await dispatchHardware({...context, sourceIsNormal, method: 'digitalWrite', args: [13, 1]}), 17);
  assert.deepEqual(context.calls, [[13, 1], [13, 1]]);
  assert.equal(context.virtualBoard.getState().pins.find(p => p.pin === 13).kind, null);
  context.virtualBoard.dispose();
});

test('missing virtual model allows existing physical behavior and propagates physical failures', async () => {
  const calls = [], realService = {digitalWrite: async (...args) => { calls.push(args); throw new Error('not connected'); }};
  await assert.rejects(dispatchHardware({realService, method: 'digitalWrite', args: [13, 1]}), /not connected/);
  assert.deepEqual(calls, [[13, 1]]);
});

test('allowlist rejects lifecycle, prototype and unknown methods in both destinations', async () => {
  for (const enabled of [true, false]) {
    const context = setup({enabled});
    for (const method of ['connect', 'reconnect', 'disconnect', 'enable', 'stop', 'reset', 'dispose', 'constructor', '__proto__', 'toString', 'getState', 'setDigitalInput', '', null]) {
      await assert.rejects(dispatchHardware({...context, sourceIsNormal: true, method, args: []}), /Unsupported board command/);
    }
    assert.deepEqual(context.calls, []);
    assert.equal(context.virtualBoard.getState().enabled, enabled); context.virtualBoard.dispose();
  }
});

test('only the nine intended extension methods dispatch, with exact positional arguments and receiver', async () => {
  const methods = {setPinMode: [2, 'INPUT'], digitalWrite: [2, 1], analogWrite: [3, 128], readAnalog: ['A0'], readDigital: [2], servoWrite: [4, 90], servoDetach: [4], tone: [4, 440, 0.2], noTone: [4]};
  for (const enabled of [false, true]) {
    const calls = [], virtualBoard = {getState: () => ({enabled})}, realService = {getState: () => ({status: 'disconnected'})};
    for (const method of Object.keys(methods)) for (const service of [virtualBoard, realService]) service[method] = async function (...args) { assert.equal(this, service); calls.push({virtual: service === virtualBoard, method, args}); return method; };
    for (const [method, args] of Object.entries(methods)) assert.equal(await dispatchHardware({virtualBoard, realService, sourceIsNormal: true, method, args}), method);
    assert.deepEqual(calls, Object.entries(methods).map(([method, args]) => ({virtual: enabled, method, args})));
  }
});

test('malformed arguments and unavailable services reject without dispatch', async () => {
  const context = setup();
  for (const args of [null, {}, '13,1', [13, 1, 'unexpected']]) await assert.rejects(dispatchHardware({...context, sourceIsNormal: true, method: 'digitalWrite', args}), /Invalid board command arguments/);
  await assert.rejects(dispatchHardware({...context, realService: undefined, sourceIsNormal: true, method: 'digitalWrite', args: [13, 1]}), /state is unavailable/);
  assert.deepEqual(context.calls, []); context.virtualBoard.dispose();
  await assert.rejects(dispatchHardware({method: 'digitalWrite', args: [13, 1]}), /service is unavailable/);
});

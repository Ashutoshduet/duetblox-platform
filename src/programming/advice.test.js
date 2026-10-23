import test from 'node:test';
import assert from 'node:assert/strict';
import {boardMenus} from './board-menus.js';
import {uploadAdvice} from './advice.js';
import {boardRegistry, validatePin} from '../hardware/boards.js';

test('palette choices and defaults are valid for every implemented profile', () => {
  for (const board of boardRegistry.filter(b => b.live)) {
    const config = boardMenus(board.id);
    for (const [name, capability] of [['digitalPin', 'digital'], ['outputPin', 'output'], ['pwmPin', 'pwm'], ['analog', 'analog']]) {
      if (name === 'analog' && !config.hasAnalog) { assert.equal(board.id, 'esp32-cam'); continue; }
      for (const item of config.menus[name].items) assert.doesNotThrow(() => validatePin(board, item.value, capability));
    }
    for (const [key, capability] of [['digital', 'digital'], ['output', 'output'], ['pwm', 'pwm'], ['servo', 'output'], ['tone', 'output']]) assert.doesNotThrow(() => validatePin(board, config.defaults[key], capability));
    if (config.hasAnalog) assert.doesNotThrow(() => validatePin(board, config.defaults.analog, 'analog'));
  }
  assert.throws(() => boardMenus('quarky'), /implemented/);
  assert.throws(() => boardMenus('invalid'), /implemented/);
});

test('upload advice identifies the offending sprite and distinguishes live ML from embedded ML', () => {
  const project = {targets: [{name: 'Robot', blocks: {predict: {opcode: 'duetPose_predict'}}}]};
  const advice = uploadAdvice({code: 'UNSUPPORTED_BLOCK', blockId: 'predict', message: 'Unsupported'}, project);
  assert.equal(advice.targetName, 'Robot');
  assert.match(advice.next, /not uploaded/);
  assert.match(uploadAdvice({code: 'ENTRY'}, project).next, /one/);
  assert.match(uploadAdvice({code: 'PIN'}, project).next, /never rewrites/);
});

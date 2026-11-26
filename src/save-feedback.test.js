import test from 'node:test';
import assert from 'node:assert/strict';
import {createWriteMonitor} from './save-feedback.js';

test('does not claim a save before a completed browser transaction', () => {
  const m = createWriteMonitor();
  assert.equal(m.snapshot().lastSavedAt, null);
  const token = m.begin(['current-workspace']);
  assert.equal(m.snapshot().pending, 1);
  assert.equal(m.snapshot().lastSavedAt, null);
  m.finish(token);
  assert.equal(m.snapshot().pending, 0);
  assert.ok(m.snapshot().lastSavedAt);
});

test('unrelated writes cannot dismiss a failed project or dataset save', () => {
  const m = createWriteMonitor();
  m.finish(m.begin(['current-workspace', 'projects']), new Error('Storage full'));
  m.finish(m.begin(['image-dataset']));
  assert.equal(m.snapshot().errors.length, 2);
  m.finish(m.begin(['current-workspace']));
  assert.equal(m.snapshot().errors.length, 1);
  m.finish(m.begin(['projects']));
  assert.deepEqual(m.snapshot().errors, []);
});

test('a late old result cannot replace a newer outcome for the same record', () => {
  const m = createWriteMonitor();
  const old = m.begin(['current-workspace']), recent = m.begin(['current-workspace']);
  m.finish(recent, new Error('New save failed'));
  m.finish(old);
  assert.deepEqual(m.snapshot().errors, ['New save failed']);
  const older = m.begin(['current-workspace']), newer = m.begin(['current-workspace']);
  m.finish(newer);
  m.finish(older, new Error('Old save failed'));
  assert.deepEqual(m.snapshot().errors, []);
});

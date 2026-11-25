import test from 'node:test';
import assert from 'node:assert/strict';
import {createJuniorCompletionTracker, JUNIOR_ACTION_TYPES, JUNIOR_CANCEL_VARIABLE, juniorActionVariable} from './completion.js';
import {compileJuniorProject, makeJuniorProject, makeJuniorBlock} from './model.js';

function fixture() {
  const events = [];
  const state = {sceneId: 'scene-1', cancelled: 0, running: false,
    actions: Object.fromEntries(JUNIOR_ACTION_TYPES.map(type => [type, 0])),
    targets: [{id: 'sprite-1', name: 'Fox', isStage: false, x: 0, y: 0, direction: 90, size: 85, visible: true}]};
  const tracker = createJuniorCompletionTracker({readState: () => state, onComplete: value => events.push(value)});
  tracker.configure({version: 1, sceneId: 'scene-1'});
  return {tracker, state, events};
}

test('completion records actual executed action counts and immutable initial/final target values once', () => {
  const {tracker, state, events} = fixture();
  state.running = true; tracker.begin('run-1');
  state.actions.move = 3; state.targets[0].x = 60; state.running = false;
  const completed = tracker.finish();
  assert.equal(completed.runId, 'run-1');
  assert.equal(completed.actionCount, 3); assert.deepEqual(completed.actions, {move: 3});
  assert.equal(completed.initialTargets[0].x, 0); assert.equal(completed.targets[0].x, 60);
  state.targets[0].x = 200; assert.equal(completed.targets[0].x, 60);
  assert.equal(tracker.finish(), null); assert.equal(events.length, 1);
});

test('repeated flag runs count only new actions and retain compiled starting positions', () => {
  const {tracker, state} = fixture();
  state.running = true; tracker.begin('one'); state.actions.move = 2; state.running = false;
  assert.equal(tracker.finish().actionCount, 2);
  state.targets[0].x = 40; state.running = true; tracker.begin('two');
  state.actions.move = 4; state.running = false;
  const second = tracker.finish();
  assert.equal(second.actionCount, 2); assert.equal(second.initialTargets[0].x, 0);
});

test('idle, empty, unstarted and cancelled runs never report success', () => {
  const {tracker, state, events} = fixture();
  state.actions.move = 1; assert.equal(tracker.finish(), null);
  tracker.begin('unstarted'); state.actions.move++; assert.equal(tracker.finish(), null);
  state.running = true; tracker.begin('empty'); state.running = false; assert.equal(tracker.finish(), null);
  state.running = true; tracker.begin('cancelled'); state.actions.move++; tracker.cancel(); state.running = false;
  assert.equal(tracker.finish(), null); assert.deepEqual(events, []);
});

test('running loops, explicit stop blocks and scene interruptions do not complete', () => {
  for (const kind of ['running', 'stop', 'scene']) {
    const {tracker, state, events} = fixture();
    state.running = true; tracker.begin(kind); state.actions.move++;
    if (kind !== 'running') state.running = false;
    if (kind === 'stop') state.cancelled++;
    if (kind === 'scene') state.sceneId = 'scene-2';
    assert.equal(tracker.finish(), null, kind); assert.deepEqual(events, []);
  }
});

test('project replacement and error cancellation invalidate the previous run', () => {
  for (const replacement of [false, true]) {
    const {tracker, state, events} = fixture();
    state.running = true; tracker.begin('old'); state.actions.say++;
    if (replacement) tracker.configure({version: 1, sceneId: 'scene-1'});
    else tracker.cancel();
    state.running = false; assert.equal(tracker.finish(), null); assert.deepEqual(events, []);
  }
});

test('missing, invalid or decreasing counters fail closed', () => {
  for (const value of [undefined, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const {tracker, state} = fixture();
    state.running = true; tracker.begin('invalid'); state.actions.move = value; state.running = false;
    assert.equal(tracker.finish(), null);
  }
  const {tracker, state} = fixture();
  state.actions.move = 2; state.running = true; tracker.begin('decreased'); state.actions.move = 1; state.running = false;
  assert.equal(tracker.finish(), null);
});

test('only explicit valid tracking metadata arms a run', () => {
  for (const value of [null, {}, {version: 2, sceneId: 'scene-1'}, {version: 1, sceneId: ''}]) {
    const {tracker, state, events} = fixture();
    tracker.configure(value); state.running = true; tracker.begin('ignored'); state.actions.move++; state.running = false;
    assert.equal(tracker.finish(), null); assert.deepEqual(events, []);
  }
});

test('optional compiler instrumentation records executed branches and excludes wait/zero/empty actions', () => {
  const project = makeJuniorProject();
  project.scenes[0].sprites[0].scripts[0].blocks = [
    {...makeJuniorBlock('move'), value: 0}, {...makeJuniorBlock('say'), text: ''}, makeJuniorBlock('wait'),
    {...makeJuniorBlock('ifElse'), condition: {kind: 'keyPressed', key: 'space'},
      children: [{...makeJuniorBlock('move'), value: 20}], elseChildren: [{...makeJuniorBlock('turn'), value: 90}]}
  ];
  const plain = compileJuniorProject(project), tracked = compileJuniorProject(project, {trackCompletion: true});
  assert.equal(plain.juniorCompletion, undefined);
  assert.deepEqual(tracked.juniorCompletion, {version: 1, sceneId: project.selectedSceneId});
  assert.equal(Object.keys(plain.project.targets[0].variables).length, 1);
  const blocks = Object.values(tracked.project.targets[1].blocks);
  const counters = blocks.filter(block => block.opcode === 'data_changevariableby');
  assert.deepEqual(counters.map(block => block.fields.VARIABLE[1]).sort(),
    [juniorActionVariable('move'), juniorActionVariable('turn')].sort());
  const decision = blocks.find(block => block.opcode === 'control_if_else' && block.inputs.CONDITION);
  assert.ok(decision);
  assert.deepEqual(tracked.project.monitors, []);
});

test('compiler invalidates an explicit stop before it can terminate its thread', () => {
  const project = makeJuniorProject();
  project.scenes[0].sprites[0].scripts[0].blocks = [makeJuniorBlock('move'), {...makeJuniorBlock('stop'), choice: 'this script'}];
  const blocks = compileJuniorProject(project, {trackCompletion: true}).project.targets[1].blocks;
  const cancel = Object.values(blocks).find(block => block.fields.VARIABLE?.[1] === JUNIOR_CANCEL_VARIABLE);
  assert.equal(cancel.opcode, 'data_changevariableby');
  assert.equal(blocks[cancel.next].opcode, 'control_stop');
});

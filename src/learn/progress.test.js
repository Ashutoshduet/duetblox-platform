import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS} from './lessons.js';
import {createProgressStore, emptyProgress, lessonProgress, normalizeProgress, PROGRESS_KEY, updateProgress} from './progress.js';
import {starterFile} from './examples.js';
import {compileJuniorProject, parseJuniorProject} from '../junior/model.js';
import {validateTextDataset} from '../ml/text/classifier.js';

const first = LESSONS[0], other = LESSONS[1];
test('every lesson has bilingual guidance, a real destination and unique step ids', () => {
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
  for (const lesson of LESSONS) {
    assert.ok(['junior', 'blocks', 'ml', 'boards'].includes(lesson.target));
    assert.equal(new Set(lesson.steps.map(step => step.id)).size, lesson.steps.length);
    for (const text of [lesson.title, lesson.summary, lesson.needs, ...lesson.steps.flatMap(step => [step.title, step.body, step.check, ...(step.hint ? [step.hint] : [])])]) {
      assert.ok(text.en?.length > 5); assert.ok(text.hi?.length > 5);
    }
  }
});
test('untrusted saved progress cannot add lessons, steps, or count duplicate completions', () => {
  const state = normalizeProgress({version: 1, locale: 'xx', selected: 'missing', active: 'bad', steps: {[first.id]: 999, [other.id]: -3}, completed: {[first.id]: [first.steps[0].id, first.steps[0].id, 'bogus']}});
  assert.equal(state.locale, 'en'); assert.equal(state.active, null);
  assert.equal(state.steps[first.id], first.steps.length - 1); assert.equal(state.steps[other.id], 0);
  assert.deepEqual(state.completed[first.id], [first.steps[0].id]);
  assert.equal(normalizeProgress({version: 999}).selected, first.id);
});
test('navigation and opening a lesson never mark its work complete', () => {
  let state = updateProgress(emptyProgress(), {type: 'start', lessonId: first.id});
  state = updateProgress(state, {type: 'step', lessonId: first.id, index: 3});
  assert.equal(state.active, first.id); assert.equal(lessonProgress(state, first.id).completed, 0);
  assert.equal(lessonProgress(state, first.id).finished, false);
  state = updateProgress(state, {type: 'pause'});
  assert.equal(state.active, null); assert.equal(state.steps[first.id], 3);
});
test('manual completion can be undone and reset affects only the chosen lesson', () => {
  let state = emptyProgress();
  for (const lesson of [first, other]) for (const step of lesson.steps) state = updateProgress(state, {type: 'check', lessonId: lesson.id, stepId: step.id, checked: true});
  assert.equal(lessonProgress(state, first.id).finished, true);
  state = updateProgress(state, {type: 'check', lessonId: first.id, stepId: first.steps[0].id, checked: false});
  assert.equal(lessonProgress(state, first.id).finished, false);
  state = updateProgress(state, {type: 'reset', lessonId: first.id});
  assert.equal(lessonProgress(state, first.id).completed, 0);
  assert.equal(lessonProgress(state, other.id).finished, true);
});
test('progress store writes only its own key and restores the same lesson and language', () => {
  const data = new Map([['current-workspace', 'DO NOT CHANGE']]), storage = {getItem:key => data.get(key), setItem:(key, value) => data.set(key, value)};
  const store = createProgressStore(storage), seen = [];
  const unsubscribe = store.subscribe(() => seen.push(store.snapshot()));
  store.dispatch({type: 'locale', locale: 'hi'}); store.dispatch({type: 'start', lessonId: other.id});
  unsubscribe(); store.dispatch({type: 'check', lessonId: other.id, stepId: other.steps[0].id, checked: true});
  const restored = createProgressStore(storage).snapshot();
  assert.equal(restored.progress.locale, 'hi'); assert.equal(restored.progress.active, other.id);
  assert.equal(lessonProgress(restored.progress, other.id).completed, 1);
  assert.equal(data.get('current-workspace'), 'DO NOT CHANGE'); assert.deepEqual([...data.keys()].sort(), [PROGRESS_KEY, 'current-workspace'].sort());
  assert.equal(seen.length, 2);
});
test('blocked storage and corrupt JSON preserve a working in-memory guide', () => {
  const store = createProgressStore({getItem:() => '{bad', setItem:() => {throw new Error('Blocked');}});
  assert.equal(store.snapshot().storageError, true);
  store.dispatch({type: 'check', lessonId: first.id, stepId: first.steps[0].id, checked: true});
  assert.equal(lessonProgress(store.snapshot().progress, first.id).completed, 1);
  store.refresh('{invalid');
  assert.equal(lessonProgress(store.snapshot().progress, first.id).completed, 1);
  store.refresh(null); assert.equal(lessonProgress(store.snapshot().progress, first.id).completed, 0);
});
test('offline Junior starter passes real parser and compiles to Scratch motion and speech', () => {
  const file = starterFile('junior'), project = parseJuniorProject(JSON.stringify(file.data));
  assert.ok(file.name.endsWith('.junior.json'));
  const compiled = compileJuniorProject(project), blocks = compiled.project?.targets?.flatMap(target => Object.values(target.blocks || {}));
  assert.ok(blocks?.some(block => block.opcode === 'motion_glidesecstoxy'));
  assert.ok(blocks?.some(block => block.opcode === 'looks_sayforsecs'));
});
test('offline Text starter passes the real dataset validator and has holdout-ready examples', () => {
  const file = starterFile('text'), data = file.data; validateTextDataset(data);
  assert.equal(data.classes.length, 2); assert.ok(data.classes.every(item => new Set(item.samples).size >= 5));
  assert.throws(() => starterFile('unknown'), /does not have a starter/);
});

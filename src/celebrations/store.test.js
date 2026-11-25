import test from 'node:test';
import assert from 'node:assert/strict';
import {CELEBRATION_KEY, DEFAULT_PREFERENCES, createCelebrationStore, normalizePreferences} from './store.js';
import {checkJuniorChallenge, completedRunMatches} from './junior-milestones.js';
import {createCelebrationAudio} from './audio.js';

const memory = () => {const values = new Map(); return {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};};
const event = {key: 'junior:one:first-story', scope: 'junior:one', title: 'A finished story', message: 'Your story ran to the end.'};

test('preferences default to silent; malformed preferences cannot enable motion or audio accidentally', () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences({sound:'true', reduceMotion:1, mascot:'untrusted', dance:'spin forever', palette:'url(x)'}), DEFAULT_PREFERENCES);
});

test('milestones are once per key across reload, replay is not a new achievement, and no event is restored', () => {
  const storage = memory(), store = createCelebrationStore(storage);
  assert.equal(store.publish(event), true);
  assert.equal(store.publish(event), false);
  store.clear('other'); assert.ok(store.snapshot().event);
  store.clear(event.scope); assert.equal(store.snapshot().event, null);
  const reloaded = createCelebrationStore(storage);
  assert.equal(reloaded.publish(event), false);
  assert.equal(reloaded.snapshot().event, null);
  assert.equal(reloaded.publish({...event, key:'junior:two:first-story'}), true);
});

test('preferences persist; disabling removes a visible event without changing any project records', () => {
  const storage = memory(), store = createCelebrationStore(storage);
  storage.setItem('student-project', 'untouched');
  store.publish(event);
  store.setPreferences({enabled:false, sound:true, reduceMotion:true, mascot:'tiko', dance:'shuffle', palette:'ocean'});
  assert.equal(store.snapshot().event, null);
  assert.equal(store.publish({...event,key:'new'}), false);
  assert.deepEqual(createCelebrationStore(storage).snapshot().preferences, {enabled:false,sound:true,reduceMotion:true,mascot:'tiko',dance:'shuffle',palette:'ocean'});
  assert.equal(storage.getItem('student-project'), 'untouched');
});

test('restricted or malformed storage still supports choices and deduplication in memory', () => {
  const store = createCelebrationStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');}});
  assert.equal(store.snapshot().storageError, true);
  store.setPreferences({mascot:'duvi'});
  assert.equal(store.snapshot().preferences.mascot, 'duvi');
  assert.equal(store.publish(event), true); assert.equal(store.publish(event), false);
  const saved = memory(); saved.setItem(CELEBRATION_KEY, '{');
  assert.equal(createCelebrationStore(saved).snapshot().storageError, true);
});

test('storage refresh never replays old achievements; saved history is bounded', () => {
  const storage = memory(), store = createCelebrationStore(storage);
  for (let i=0;i<520;i++) store.publish({...event,key:`milestone:${i}`});
  const saved = JSON.parse(storage.getItem(CELEBRATION_KEY)); assert.equal(saved.seen.length,500);
  store.refresh(JSON.stringify({...saved,preferences:{...saved.preferences,reduceMotion:true}}));
  assert.equal(store.snapshot().event,null); assert.equal(store.snapshot().preferences.reduceMotion,true);
});

const run = {id:'run-1',sceneId:'scene-1',targetIndex:0,challenge:'right'};
const result = () => ({version:1,outcome:'completed',runId:'run-1',sceneId:'scene-1',actionCount:1,
  initialTargets:[{id:'fox',x:0,y:-38,direction:90,visible:true}],targets:[{id:'fox',x:60,y:-38,direction:180,visible:true}]});

test('actual goals require matching completed run, selected target and exact achieved state', () => {
  assert.equal(checkJuniorChallenge(result(),run),true);
  assert.equal(checkJuniorChallenge(result(),{...run,challenge:'turn'}),true);
  for (const patch of [{runId:'older'}, {sceneId:'elsewhere'}, {outcome:'stopped'}, {actionCount:0}, {actionCount:NaN}]) {
    assert.equal(completedRunMatches({...result(),...patch},run),false);
    assert.equal(checkJuniorChallenge({...result(),...patch},run),false);
  }
  for (const patch of [{x:40},{y:0},{x:NaN},{id:'another'},{visible:false}]) {
    const next=result();Object.assign(next.targets[0],patch);assert.equal(checkJuniorChallenge(next,run),false);
  }
  assert.equal(checkJuniorChallenge(result(),{...run,targetIndex:1}),false);
});

test('quarter-turn goal handles wrapped angles and rejects a wrong turn', () => {
  const next=result();next.initialTargets[0].direction=150;next.targets[0].direction=-120;
  assert.equal(checkJuniorChallenge(next,{...run,challenge:'turn'}),true);
  next.targets[0].direction=60;assert.equal(checkJuniorChallenge(next,{...run,challenge:'turn'}),false);
});

test('sound is silent until explicitly enabled, stops all scheduled notes, and degrades without AudioContext', async () => {
  let starts=0, stops=0, closed=0;
  class Audio {
    state='suspended';currentTime=0;destination={};
    async resume(){this.state='running';}
    async close(){closed++;this.state='closed';}
    createOscillator(){return {frequency:{},connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  }
  const audio=createCelebrationAudio(()=>Audio);
  assert.equal(audio.play(),false);assert.equal(starts,0);
  assert.equal(await audio.enable(),true);assert.equal(audio.play(),true);assert.equal(starts,3);
  audio.disable();assert.equal(audio.play(),false);assert.ok(stops>=6);
  audio.dispose();assert.equal(closed,1);
  const absent=createCelebrationAudio(()=>undefined);assert.equal(await absent.enable(),false);assert.equal(absent.play(),false);
});

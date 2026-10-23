import {appPath, normalizeAppBase} from '../../../src/app-paths.js';
const appBase=normalizeAppBase(process.env.DUETBLOX_BASE_PATH || '/');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {patchFaceSensingAssets, faceSensingSolutionPath, faceSensingAssetNames, faceSensingFailureMessage} from '../scripts/face-sensing-assets.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../public/', import.meta.url);
const files = [
  ['scratch-gui-standalone.js', 'node_modules/@scratch/scratch-gui/dist/scratch-gui-standalone.js'],
  ['vendor/scratch-vm.js', 'node_modules/@scratch/scratch-vm/dist/web/scratch-vm.js']
];

// Execute only the actual, narrowly selected detector initialization chain
// against a fake detector API. Neither the GUI nor MediaPipe is executed here.
function detectorInitializer(source) {
  const facePath=appPath(faceSensingSolutionPath,appBase);
  const marker = `solutionPath:${JSON.stringify(facePath)}`;
  const markerAt = source.indexOf(marker);
  assert.notEqual(markerAt, -1, 'the final bundle must contain the hosted model path');
  const start = source.lastIndexOf(';', markerAt) + 1;
  const end = source.indexOf('}static get INTERVAL()', markerAt);
  assert.ok(end > markerAt, 'the pinned initialization chain must be complete');
  const expression = source.slice(start, end);
  const api = expression.match(/^([$\w]+)\.createDetector\(([$\w]+),/);
  assert.ok(api, 'extract the actual detector API and selected model');
  assert.ok(!expression.includes('https://'), 'a failed local load must not retry on a public CDN');
  return Function(api[1], api[2], `return function(){return ${expression}}`);
}

test('Face Sensing patch rejects upstream drift and duplicate paths', async () => {
  for (const [file, upstream] of files) {
    const source = await fs.readFile(new URL(upstream, root), 'utf8');
    const patched = patchFaceSensingAssets(source, file);
    assert.ok(patched.includes(`solutionPath:${JSON.stringify(faceSensingSolutionPath)}`));
    assert.throws(() => patchFaceSensingAssets(patched, file), /did not match/);
    assert.throws(() => patchFaceSensingAssets(source + source, file), /did not match/);
    assert.throws(() => patchFaceSensingAssets(source.replace('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@', 'https://changed.example/face@'), file), /did not match/);
  }
});

test('final GUI and VM Face Sensing initialize with local assets and do not fall back to a CDN', async () => {
  for (const [file] of files) {
    const source = await fs.readFile(new URL(`scratch/${file}`, publicRoot), 'utf8');
    const initialize = detectorInitializer(source);
    const calls = [];
    const detector = {identity: 'local-fixture'};
    const events = [];
    const context = {runtime: {ioDevices: null, emit: (...args) => events.push(args)}};
    await initialize({createDetector: async (model, config) => {calls.push({model, config}); return detector;}}, 'face-model').call(context);
    assert.equal(context._faceDetector, detector);
    assert.deepEqual(calls, [{model: 'face-model', config: {runtime: 'mediapipe', solutionPath: appPath(faceSensingSolutionPath,appBase), maxFaces: 1}}]);
    const attempts = [];
    await initialize({createDetector: async (model, config) => {attempts.push(config.solutionPath); throw Error('local asset unavailable');}}, 'face-model').call(context);
    assert.deepEqual(attempts, [appPath(faceSensingSolutionPath,appBase)]);
    assert.deepEqual(events, [['EXTENSION_DATA_LOADING', false], ['DUET_EXTENSION_ERROR', {extension: 'faceSensing', message: faceSensingFailureMessage}]]);
  }
});

test('all Face Sensing graph, model and SIMD/non-SIMD runtime assets exist at the effective local URL', async () => {
  for (const name of faceSensingAssetNames) {
    const url = new URL(`${faceSensingSolutionPath}/${name}`, 'https://duetblox.test/scratch/index.html');
    assert.equal(url.origin, 'https://duetblox.test');
    const copied = await fs.readFile(new URL(url.pathname.slice(1), publicRoot));
    const original = await fs.readFile(new URL(`node_modules/@scratch/scratch-gui/dist/chunks/mediapipe/face_detection/${name}`, root));
    // This release's official SIMD data sidecar is an empty packaged file.
    if (!name.endsWith('.data')) assert.ok(copied.length > 0, name);
    assert.equal(createHash('sha256').update(copied).digest('hex'), createHash('sha256').update(original).digest('hex'), `${name} must retain official asset bytes`);
    if (name.endsWith('.wasm')) assert.deepEqual([...copied.subarray(0, 4)], [0, 97, 115, 109], `${name} must be a WASM binary`);
  }
});


test('mounted Face Sensing patches keep both pinned bundles inside the deployment directory',async()=>{
 for(const [file,upstream] of files){
  const source=await fs.readFile(new URL(upstream,root),'utf8');
  const patched=patchFaceSensingAssets(source,file,'/duetblox/');
  assert.equal(patched.split('solutionPath:"/duetblox/scratch/chunks/mediapipe/face_detection"').length,2);
  assert.equal(patched.includes('solutionPath:"/scratch/'),false);
  assert.equal(patched.includes('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@'),false);
 }
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {faceSensingSolutionPath, faceSensingAssetNames} from './face-sensing-assets.mjs';

// Run after the root production build, when the generated offline manifest is
// available. Verify the exact files a disconnected browser will receive.
const dist = new URL('../../../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('offline-manifest.json', dist), 'utf8'));
const files = new Map(manifest.files.map(file => [file.url, file]));
const urls = [
  '/scratch/scratch-gui-standalone.js',
  '/scratch/vendor/scratch-vm.js',
  ...faceSensingAssetNames.map(name => `${faceSensingSolutionPath}/${name}`)
];
let verifiedBytes = 0;
for (const url of urls) {
  const entry = files.get(url);
  assert.ok(entry, `Offline manifest must include ${url}`);
  const bytes = await readFile(new URL(url.slice(1), dist));
  assert.equal(entry.bytes, bytes.length, `Offline length: ${url}`);
  assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'), `Offline checksum: ${url}`);
  if (url.endsWith('scratch-gui-standalone.js') || url.endsWith('scratch-vm.js')) {
    const source = bytes.toString('utf8');
    assert.equal(source.split(`solutionPath:${JSON.stringify(faceSensingSolutionPath)}`).length, 2, `Exactly one local Face Sensing initializer: ${url}`);
    assert.ok(!source.includes('solutionPath:"/chunks/mediapipe/face_detection"'), `No root-level model directory: ${url}`);
    assert.ok(!source.includes('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@'), `No Face Sensing cloud fallback: ${url}`);
  }
  verifiedBytes += bytes.length;
}
console.log(JSON.stringify({offlinePack: manifest.version, verifiedFiles: urls.length, verifiedBytes, solutionPath: faceSensingSolutionPath, cloudFallback: false}, null, 2));

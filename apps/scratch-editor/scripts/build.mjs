import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {patchHullFormat} from './hardening.mjs';
import {patchFaceSensingAssets, faceSensingAssetNames, faceSensingSolutionPath} from './face-sensing-assets.mjs';
import {patchSandboxDelivery} from './sandbox-delivery.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../../public/scratch');
await fs.rm(output, {recursive: true, force: true});
await fs.mkdir(output, {recursive: true});
// These are the official npm distribution files, including lazy-loaded paint,
// extension, storage-worker and media assets. Keep their license notices.
const copy = async (source, dest, extraFilter = () => true) => fs.cp(source, dest, {recursive: true, filter: p => !p.endsWith('.map') && extraFilter(p)});
await copy(path.join(root, 'node_modules/@scratch/scratch-gui/dist'), output,
  p => !p.endsWith('/scratch-gui.js') && !p.includes('/types/'));
for (const name of ['scratch-vm','scratch-render','scratch-storage','scratch-svg-renderer']) {
  await copy(path.join(root, `node_modules/@scratch/${name}/dist/web`), path.join(output, 'vendor'), p => !p.endsWith('/scratch-render.js') && !p.endsWith('/scratch-storage.min.js')); 
}
// Upstream standalone distributions bake their lazy-chunk path as '/'.
// This app intentionally hosts them below /scratch; patch only that verified
// webpack runtime assignment in the copied distributions, never npm sources.
for (const [file, base] of [['scratch-gui-standalone.js', '/scratch/'],
  ...['scratch-vm.js','scratch-render.min.js','scratch-storage.js','scratch-svg-renderer.js'].map(name => [`vendor/${name}`, '/scratch/vendor/'])]) {
  const target = path.join(output, file);
  const text = await fs.readFile(target, 'utf8');
  const pattern = /\.p\s*=\s*"\/"/g;
  const count = [...text.matchAll(pattern)].length;
  if (count < 1 || count > 3) throw new Error(`Unexpected upstream webpack public paths in ${file}: ${count}`);
  let adjusted = text.replace(pattern, `.p=${JSON.stringify(base)}`);
  adjusted = patchSandboxDelivery(adjusted, file);
  if (file === 'scratch-gui-standalone.js') adjusted = adjusted.replaceAll('"Scratch Project"', '"DUETBlox Project"');
  if (file === 'scratch-gui-standalone.js' || file === 'vendor/scratch-render.min.js') adjusted = patchHullFormat(adjusted, file);
  if (file === 'scratch-gui-standalone.js' || file === 'vendor/scratch-vm.js') adjusted = patchFaceSensingAssets(adjusted, file);
  await fs.writeFile(target, adjusted);
}
for (const name of faceSensingAssetNames) {
  const asset = path.join(output, faceSensingSolutionPath.slice('/scratch/'.length), name);
  const info = await fs.stat(asset);
  // The pinned upstream SIMD data sidecar is intentionally empty.
  if (!info.isFile() || (info.size === 0 && !name.endsWith('.data'))) {
    throw new Error(`Face Sensing requires its bundled runtime/model asset: ${asset}`);
  }
}
await fs.mkdir(path.join(output, 'licenses'), {recursive: true});
await fs.copyFile(path.join(root, 'NOTICE.txt'), path.join(output, 'licenses/DUETBlox-NOTICE.txt')); 
for (const name of ['@scratch/scratch-gui','@scratch/scratch-vm','@scratch/scratch-render','@scratch/scratch-storage','@scratch/scratch-svg-renderer','scratch-blocks','scratch-audio']) {
  for (const file of ['LICENSE','TRADEMARK','TRADEMARK.txt']) {
    const source = path.join(root, 'node_modules', name, file);
    try { await fs.copyFile(source, path.join(output, 'licenses', `${name.replaceAll('/','-')}-${file}`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
for (const file of ['editor.css','duetblox-logo.svg']) await fs.copyFile(path.join(root, 'src', file), path.join(output, file));
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DUETBlox · Block editor</title><link rel="stylesheet" href="./editor.css"></head><body><main id="app"><p style="padding:24px;color:#53536b">Opening DUETBlox…</p></main><script src="./duetblox-editor.js"></script></body></html>`);
const webpack = require('webpack');
const config = require('../webpack.config.cjs');
await new Promise((resolve, reject) => webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) reject(error || new Error(stats.toString({all: false, errors: true})));
  else { console.log(stats.toString({all: false, timings: true, assets: true, warnings: true})); resolve(); }
}));
console.log(`Official Scratch editor output: ${output}`);

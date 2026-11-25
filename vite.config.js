import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {normalizeAppBase} from './src/app-paths.js';
const appBase = normalizeAppBase(process.env.DUETBLOX_BASE_PATH ?? '/');
let scratchEntry;
try {scratchEntry = JSON.parse(readFileSync(new URL('./public/scratch/runtime-entry.json', import.meta.url), 'utf8'));}
catch {throw new Error('Build the Scratch runtime before starting DUETBlox: run npm run build:editor with the same DUETBLOX_BASE_PATH.');}
if (scratchEntry.version !== 1 || !/^\/scratch\/index-[a-f0-9]{20}\.html$/.test(scratchEntry.path) || scratchEntry.basePath !== appBase) {
  throw new Error(`The Scratch runtime does not match ${appBase}. Re-run npm run build:editor with the same DUETBLOX_BASE_PATH.`);
}
// Playwright traces contain HTML snapshots. They must not reload a running
// development editor when the test runner writes its evidence.
const qaDirectories=['work','test-results','playwright-report','junior-test-results'].map(name=>fileURLToPath(new URL(`./${name}/`,import.meta.url)).replaceAll('\\','/'));
export default defineConfig({define:{__DUET_SCRATCH_ENTRY_PATH__:JSON.stringify(scratchEntry.path)},resolve:{alias:[{find:/^util$/,replacement:fileURLToPath(new URL('./src/ml/audio/browser-util.js',import.meta.url))}]},plugins:[react()],base:appBase,build:{chunkSizeWarningLimit:1600},server:{host:'127.0.0.1',watch:{ignored:value=>{const path=value.replaceAll('\\','/');return qaDirectories.some(directory=>path===directory.slice(0,-1)||path.startsWith(directory));}}}});

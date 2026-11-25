import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {normalizeAppBase} from './src/app-paths.js';
// Playwright traces contain HTML snapshots. They must not reload a running
// development editor when the test runner writes its evidence.
const qaDirectories=['work','test-results','playwright-report','junior-test-results'].map(name=>fileURLToPath(new URL(`./${name}/`,import.meta.url)).replaceAll('\\','/'));
export default defineConfig({resolve:{alias:[{find:/^util$/,replacement:fileURLToPath(new URL('./src/ml/audio/browser-util.js',import.meta.url))}]},plugins:[react()],base:normalizeAppBase(process.env.DUETBLOX_BASE_PATH ?? '/'),build:{chunkSizeWarningLimit:1600},server:{host:'127.0.0.1',watch:{ignored:value=>{const path=value.replaceAll('\\','/');return qaDirectories.some(directory=>path===directory.slice(0,-1)||path.startsWith(directory));}}}});

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {normalizeAppBase} from './src/app-paths.js';
export default defineConfig({resolve:{alias:[{find:/^util$/,replacement:fileURLToPath(new URL('./src/ml/audio/browser-util.js',import.meta.url))}]},plugins:[react()],base:normalizeAppBase(process.env.DUETBLOX_BASE_PATH ?? '/'),build:{chunkSizeWarningLimit:1600},server:{host:'127.0.0.1'}});

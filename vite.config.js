import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:[{find:/^util$/,replacement:fileURLToPath(new URL('./src/ml/audio/browser-util.js',import.meta.url))}]},plugins:[react()],base:'/',build:{chunkSizeWarningLimit:1600},server:{host:'127.0.0.1'}});

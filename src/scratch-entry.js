import {appPath} from './app-paths.js';

// Vite injects the generated, validated pathname after build:editor. The stable
// fallback exists only for non-Vite consumers such as source-level Node tests.
export const SCRATCH_ENTRY_PATH = typeof __DUET_SCRATCH_ENTRY_PATH__ === 'string' ? __DUET_SCRATCH_ENTRY_PATH__ : '/scratch/index.html';
export const scratchEntryURL = (query = '', base) => appPath(`${SCRATCH_ENTRY_PATH}${query}`, base);

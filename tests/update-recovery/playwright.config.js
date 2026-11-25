import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'update-recovery.spec.js',
  timeout: 45000, expect: {timeout: 10000}, workers: 1, fullyParallel: false,
  reporter: [['list']],
  use: {channel: process.env.DUETBLOX_TEST_CHANNEL || 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure'}
});

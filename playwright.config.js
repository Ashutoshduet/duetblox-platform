import {defineConfig} from '@playwright/test';

// Uses a fresh browser context per test. Never attaches to the user's browser.
export default defineConfig({
  testDir: './tests/e2e', timeout: 90000, expect: {timeout: 15000},
  fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: process.env.DUETBLOX_TEST_URL || 'http://127.0.0.1:5200/duetblox/',
    channel: process.env.DUETBLOX_TEST_CHANNEL || 'chrome',
    viewport: {width: 1440, height: 1000},
    acceptDownloads: true, trace: 'retain-on-failure', screenshot: 'only-on-failure'
  }
});

import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'junior-ui.spec.js', timeout: 90000,
  expect: {timeout: 15000}, workers: 1, retries: 0,
  outputDir: '../../work/validation/junior-output', reporter: [['list']],
  use: {
    baseURL: process.env.DUETBLOX_TEST_URL || 'http://127.0.0.1:5200/duetblox/',
    channel: 'chrome', viewport: {width: 1440, height: 1000},
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
    screenshot: 'only-on-failure', trace: 'retain-on-failure', acceptDownloads: true
  }
});

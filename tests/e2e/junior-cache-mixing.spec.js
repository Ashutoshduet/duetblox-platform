import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {makeJuniorBlock, makeJuniorProject} from '../../src/junior/model.js';

// These routes emulate a retained legacy cache at the two old fixed filenames.
// They are deliberately not an HTTP-cache test: routing disables HTTP cache.
// Blocking service workers makes the injected stale responses deterministic;
// real worker installation and cold-offline operation have their own coverage.
test.use({serviceWorkers: 'block'});

const legacyBridge = `
document.getElementById('app').textContent='Legacy Scratch stage';
parent.postMessage({channel:'duetblox',type:'ready',payload:{mode:'stage',running:false}},location.origin);
// Old bridges can announce ready but have no juniorCompletion capability.
`;
const legacyEntry = '<!doctype html><html><head><title>Legacy cached stage</title></head><body><main id="app">Legacy stage loading</main><script src="./duetblox-editor.js"></script></body></html>';
const staleHeaders = {'Cache-Control': 'max-age=315360000', 'Expires': 'Thu, 31 Dec 2037 23:55:55 GMT'};
const fixedEntry = /\/scratch\/index\.html$/;
const fixedBridge = /\/scratch\/duetblox-editor\.js$/;
const versionedEntry = /\/scratch\/index-[a-f0-9]{20}\.html$/;
const versionedBridge = /\/scratch\/duetblox-editor-[a-f0-9]{20}\.js$/;

async function importStory(page, story) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: 'Open story', exact: true}).click();
  await (await chooser).setFiles({name: 'cached-stage-check.junior.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(story))});
  await expect(page.getByRole('textbox', {name: 'Junior project title', exact: true})).toHaveValue(story.title);
}

async function stagePosition(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const frame = document.querySelector('iframe[data-duet-editor="junior"]');
    const requestId = `cache-mixing-${crypto.randomUUID()}`;
    const timeout = setTimeout(() => {window.removeEventListener('message', receive); reject(new Error('Stage did not answer getProject'));}, 5000);
    function receive(event) {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.channel !== 'duetblox' || event.data.requestId !== requestId) return;
      clearTimeout(timeout); window.removeEventListener('message', receive);
      if (event.data.type === 'error') {reject(new Error(event.data.payload?.message)); return;}
      const data = event.data.payload.project;
      const project = typeof data === 'string' ? JSON.parse(data) : data;
      const target = project.targets.find(item => !item.isStage && item.visible);
      resolve({x: Math.round(target.x), y: Math.round(target.y)});
    }
    window.addEventListener('message', receive);
    frame.contentWindow.postMessage({channel: 'duetblox', requestId, type: 'getProject'}, location.origin);
  }));
}

test('current Junior bypasses retained fixed-name stage files and celebrates an actual goal', async ({page}, info) => {
  const staleRequests = [], scriptRequests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {if (request.resourceType() === 'script') scriptRequests.push(request.url());});
  await page.route('**/scratch/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (fixedEntry.test(pathname)) {
      staleRequests.push(pathname);
      return route.fulfill({contentType: 'text/html', headers: staleHeaders, body: legacyEntry});
    }
    if (fixedBridge.test(pathname)) {
      staleRequests.push(pathname);
      return route.fulfill({contentType: 'application/javascript', headers: staleHeaders, body: legacyBridge});
    }
    await route.continue();
  });
  await page.goto('./?cache-mixing-regression=1#/junior');
  const stage = page.locator('iframe[data-duet-editor="junior"]');
  const source = new URL(await stage.getAttribute('src'), page.url());
  expect(source.pathname, 'Changing only the query cannot bypass a pathname-keyed legacy cache').toMatch(versionedEntry);
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
  expect(scriptRequests.some(url => versionedBridge.test(new URL(url).pathname)), 'The stage must also load a content-versioned bridge').toBe(true);
  expect(staleRequests, 'Neither legacy fixed filename should be requested by the current app').toEqual([]);
  const story = makeJuniorProject();
  story.title = 'Fresh stage, real celebration';
  const sprite = story.scenes[0].sprites[0];
  sprite.x = 0; sprite.y = 0;
  sprite.scripts[0].blocks = [
    {...makeJuniorBlock('right'), value: 3},
    {...makeJuniorBlock('hop'), value: 2},
    {...makeJuniorBlock('say'), value: 1, text: 'I made it!'}
  ];
  await importStory(page, story);
  await page.locator('summary').filter({hasText: /^Try a small challenge$/}).click();
  await page.getByLabel('Story goal', {exact: true}).selectOption('right');
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect.poll(() => stagePosition(page)).toEqual({x: 60, y: 0});
  await expect(page.locator('.junior-challenge [role=status]')).toContainText('exactly 3 squares');
  await expect(page.getByRole('region', {name: 'Mascot celebration', exact: true})).toContainText('You reached your goal!');
  expect(staleRequests).toEqual([]);
  expect(errors).toEqual([]);
  await info.attach('runtime-resource-evidence', {body: JSON.stringify({entry: source.href, bridges: scriptRequests.filter(url => versionedBridge.test(new URL(url).pathname)), staleRequests}, null, 2), contentType: 'application/json'});
  await page.screenshot({path: info.outputPath('junior-current-stage-with-legacy-cache.png'), fullPage: true});
});

test('an incompatible ready message cannot enable Junior Play or lose editable work', async ({page}, info) => {
  const substituted = [];
  await page.route('**/scratch/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (versionedBridge.test(pathname)) {
      substituted.push(pathname);
      return route.fulfill({contentType: 'application/javascript', headers: staleHeaders, body: legacyBridge});
    }
    await route.continue();
  });
  await page.goto('./#/junior');
  await expect.poll(() => substituted.length).toBe(1);
  await expect(page.locator('.junior-status')).toContainText(/older|outdated|out of date/i);
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeDisabled();
  await expect(page.getByRole('region', {name: 'Mascot celebration', exact: true})).toHaveCount(0);
  await page.getByRole('textbox', {name: 'Junior project title', exact: true}).fill('Keep my work while updating');
  await page.getByRole('spinbutton', {name: 'Move pixels', exact: true}).fill('121');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save story', exact: true}).click();
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  expect(saved.title).toBe('Keep my work while updating');
  expect(saved.scenes[0].sprites[0].scripts[0].blocks.find(block => block.type === 'move').value).toBe(121);
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeDisabled();
  await page.screenshot({path: info.outputPath('junior-incompatible-stage-protection.png'), fullPage: true});
});

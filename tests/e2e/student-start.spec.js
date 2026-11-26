import {test, expect} from '@playwright/test';
import JSZip from 'jszip';
import {readFile} from 'node:fs/promises';

const navigate = (page, name) => page.locator('.sidebar').getByRole('button', {name, exact: true}).click();
const read = (page, key) => page.evaluate(key => new Promise((resolve, reject) => {
  const request = indexedDB.open('duetblox-workspace', 1);
  request.onsuccess = () => {const db = request.result, get = db.transaction('records').objectStore('records').get(key); get.onsuccess = () => {resolve(get.result); db.close();}; get.onerror = () => reject(get.error);};
  request.onerror = () => reject(request.error);
}), key);

test('a first story opens in one click, runs, and preserves existing Junior and circuit work', async ({page}) => {
  await page.goto('./#/home');
  await page.getByLabel('Project name', {exact: true}).fill('Keep my classroom work');
  await navigate(page, 'Circuit Lab');
  await page.getByRole('button', {name: 'Load circuit', exact: true}).click();
  await navigate(page, 'Junior Blocks');
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
  await page.getByRole('spinbutton', {name: 'Move pixels', exact: true}).fill('121');
  await page.getByRole('button', {name: 'Workspace', exact: true}).click();
  await page.getByRole('button', {name: 'Start my first story', exact: true}).click();
  await expect(page.getByLabel('Junior project title')).toHaveValue('Hello from Fox');
  await expect(page.getByRole('complementary', {name: 'Lesson guide', exact: true})).toBeVisible();
  await expect.poll(async () => (await read(page, 'workspace-recovery'))?.length).toBe(1);
  const saved = await read(page, 'current-workspace');
  expect(saved.name).toBe('Keep my classroom work');
  expect(saved.circuitLibrary).toBeTruthy();
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Mascot celebration'})).toBeVisible({timeout: 15000});
  await page.getByRole('button', {name: 'Workspace', exact: true}).click();
  await navigate(page, 'My projects');
  await page.getByRole('tab', {name: 'Recovery copies (1)'}).click();
  await page.getByRole('button', {name: 'Restore copy', exact: true}).click();
  await navigate(page, 'Junior Blocks');
  await expect(page.getByRole('spinbutton', {name: 'Move pixels', exact: true})).toHaveValue('121');
  await page.getByRole('button', {name: 'Workspace', exact: true}).click();
  await navigate(page, 'Circuit Lab');
  await expect(page.getByRole('button', {name: 'Wire board:D13 to r1:a', exact: true})).toBeVisible();
});

test('failed recovery blocks a starter and a persistent save warning offers a valid download', async ({page}) => {
  await page.goto('./#/home');
  await page.getByLabel('Project name', {exact: true}).fill('My unsaved idea');
  await expect.poll(async () => (await read(page, 'current-workspace'))?.name).toBe('My unsaved idea');
  const original = (await read(page, 'current-workspace')).junior;
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (['workspace-recovery', 'projects'].includes(key)) throw new DOMException('Storage full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  await page.getByRole('button', {name: 'Start my first story', exact: true}).click();
  await expect(page.locator('.toast')).toContainText('Nothing was opened', {ignoreCase: true});
  expect((await read(page, 'current-workspace')).junior).toEqual(original);
  await expect(page.locator('.workspace-save-warning')).toBeVisible();
  // A subsequent successful workspace write must not hide the failed recovery.
  await page.getByLabel('Project name', {exact: true}).fill('My newer idea');
  await expect.poll(async () => (await read(page, 'current-workspace'))?.name).toBe('My newer idea');
  await expect(page.locator('.workspace-save-warning')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download project backup', exact: true}).click();
  const download = await downloading;
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  expect(JSON.parse(await zip.file('duetblox.json').async('string')).name).toBe('My newer idea');
  await expect(page.locator('.workspace-save-warning')).toBeVisible();
});

test('the lesson page can open the protected starter without a file round trip', async ({page}) => {
  await page.goto('./#/learn');
  await page.getByRole('button', {name: 'Open starter story', exact: true}).click();
  await expect(page.getByLabel('Junior project title')).toHaveValue('Hello from Fox');
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
  expect((await read(page, 'workspace-recovery')).length).toBe(1);
});

for (const viewport of [{width: 1366, height: 768}, {width: 390, height: 844}]) {
  test(`first activities are readable and keyboard reachable at ${viewport.width}px`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.goto('./#/home');
    const first = page.getByRole('button', {name: 'Start my first story', exact: true});
    await expect(first).toBeEnabled();
    if (viewport.width >= 1000) {const initial = await first.boundingBox(); expect(initial.y + initial.height).toBeLessThan(viewport.height);}
    await first.focus();
    await expect(first).toBeFocused();
    const bounds = await first.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({path: info.outputPath('student-start.png'), fullPage: true});
    await page.getByRole('button', {name: 'Open Circuit Lab', exact: true}).click();
    await expect(page.getByLabel('Starter circuit', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Load circuit', exact: true})).toBeEnabled();
  });
}

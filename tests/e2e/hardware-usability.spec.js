import {test, expect} from '@playwright/test';
import JSZip from 'jszip';
import {readFile} from 'node:fs/promises';

const navigate = (page, name) => page.locator('.sidebar').getByRole('button', {name, exact: true}).click();
async function open(page, destination) {
  await page.routeWebSocket('**', () => {});
  await page.goto('./');
  await navigate(page, destination);
}
async function starter(page, value = 'led') {
  await page.getByLabel('Starter circuit', {exact: true}).selectOption(value);
  await page.getByRole('button', {name: 'Load circuit', exact: true}).click();
}
const undo = page => page.getByRole('button', {name: 'Undo circuit change', exact: true});
const redo = page => page.getByRole('button', {name: 'Redo circuit change', exact: true});
const resistance = page => page.getByLabel('Resistance (Ω)', {exact: true});
const selectResistor = page => page.getByRole('button', {name: 'Select Resistor r1', exact: true}).press('Enter');

test('circuit Undo and Redo survive editor navigation and stay separate for each board', async ({page}) => {
  await open(page, 'Circuit Lab'); await starter(page); await selectResistor(page);
  await resistance(page).fill('1000'); await resistance(page).press('Enter');
  await navigate(page, 'Blocks'); await navigate(page, 'Circuit Lab');
  await expect(undo(page)).toBeEnabled(); await undo(page).click();
  await expect(page.locator('.circuit-canvas')).toContainText('220 Ω');
  await page.getByLabel('Circuit board', {exact: true}).selectOption('esp32'); await starter(page, 'pot');
  await expect(undo(page)).toBeEnabled();
  await page.getByLabel('Circuit board', {exact: true}).selectOption('arduino-uno');
  await expect(redo(page)).toBeEnabled(); await redo(page).click();
  await expect(page.locator('.circuit-canvas')).toContainText('1000 Ω');
  await page.getByLabel('Circuit board', {exact: true}).selectOption('esp32');
  await undo(page).click(); await expect(page.locator('.circuit-empty')).toBeVisible();
});

test('resistance drafts allow clearing, commit once on Enter or blur, and reject invalid values', async ({page}) => {
  await open(page, 'Circuit Lab'); await starter(page); await selectResistor(page);
  await resistance(page).fill(''); await expect(resistance(page)).toHaveValue('');
  await expect(page.locator('.circuit-canvas')).toContainText('220 Ω');
  await expect(page.locator('.circuit-field-error')).toHaveCount(0);
  await resistance(page).fill('1000'); await resistance(page).press('Enter');
  await expect(page.locator('.circuit-canvas')).toContainText('1000 Ω');
  await undo(page).click(); await expect(page.locator('.circuit-canvas')).toContainText('220 Ω');
  await selectResistor(page); await resistance(page).fill('470'); await resistance(page).press('Tab');
  await expect(page.locator('.circuit-canvas')).toContainText('470 Ω');
  await resistance(page).fill('0'); await resistance(page).press('Enter');
  await expect(resistance(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.circuit-canvas')).toContainText('470 Ω');
  await resistance(page).press('Escape'); await expect(resistance(page)).toHaveValue('470');
  await expect(page.locator('.circuit-field-error')).toHaveCount(0);
  await undo(page).click(); await expect(page.locator('.circuit-canvas')).toContainText('220 Ω');
});

test('Escape cancels a pending wire when focus has moved outside the SVG', async ({page}) => {
  await open(page, 'Circuit Lab'); await starter(page);
  await page.getByRole('button', {name: 'Connect board:D13', exact: true}).press('Enter');
  await expect(page.getByRole('button', {name: 'Cancel wire', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Fit width', exact: true}).focus(); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: 'Cancel wire', exact: true})).toHaveCount(0);
  await expect(page.locator('.circuit-instructions')).not.toContainText('Connecting');
});

for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
  test(`hardware mode actions are reachable at ${viewport.width}px and compiler setup is explicit`, async ({page}, info) => {
    await page.setViewportSize(viewport); await open(page, 'Boards & robots');
    await expect(page.getByLabel('Choose your board', {exact: true})).toBeVisible();
    const connect = page.getByRole('button', {name: 'Connect board', exact: true});
    await expect(connect).toBeEnabled();
    const bounds = await connect.boundingBox(); expect(bounds.y).toBeGreaterThan(0); expect(bounds.y + bounds.height).toBeLessThan(viewport.height);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); expect(overflow).toBe(false);
    await page.screenshot({path: info.outputPath('hardware-live.png')});
    await page.getByRole('button', {name: 'Run after unplugging', exact: false}).click();
    await expect(page.getByRole('button', {name: 'Compile current blocks', exact: true})).toBeDisabled();
    await page.getByRole('button', {name: 'Set up local compiler', exact: true}).click();
    await expect(page.getByLabel('Compiler session token', {exact: true})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Local compiler setup instructions', exact: true})).toHaveAttribute('href', /\/duetblox\/WINDOWS_HELPER.txt$/);
    await expect(page.getByRole('button', {name: 'Connect local compiler', exact: true})).toBeDisabled();
    await expect(page.getByRole('button', {name: 'Select port & upload', exact: true})).toHaveCount(0);
  });
}

test('Other boards stay collapsed and matching planned devices can be revealed explicitly', async ({page}) => {
  await open(page, 'Boards & robots');
  await expect(page.locator('.other-boards')).not.toHaveAttribute('open', '');
  await page.getByLabel('Find a board', {exact: true}).fill('Quarky');
  await expect(page.locator('.board-search-results')).toContainText('0 available');
  await expect(page.locator('.other-boards')).not.toHaveAttribute('open', '');
  await expect(page.locator('.other-boards .board-option').first()).not.toBeVisible();
  await page.getByRole('button', {name: /Show \d+ matches? in Other boards/}).click();
  await expect(page.locator('.other-boards .board-option').first()).toBeVisible();
  await expect(page.locator('.other-boards .board-option').first()).toContainText('Planned');
  await page.getByLabel('Find a board', {exact: true}).fill('not-a-real-board');
  await expect(page.locator('.board-search-results')).toContainText('0 available and 0 planned matches');
});

test('verified firmware preparation keeps upload explicit and board changes clear the artifact', async ({page}) => {
  await open(page, 'Boards & robots');
  await page.getByRole('button', {name: 'Prepare live firmware', exact: true}).click();
  await expect(page.locator('.firmware-ready')).toContainText('Live firmware ready for Arduino Uno R3');
  await expect(page.getByRole('button', {name: 'Select port & upload', exact: true})).toBeEnabled();
  await expect(page.locator('.firmware-ready')).toContainText('Uploading replaces the program');
  await page.getByLabel('Choose your board', {exact: true}).selectOption('esp32');
  await expect(page.getByRole('button', {name: 'Select port & upload', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Prepare live firmware', exact: true}).click();
  await expect(page.locator('.firmware-ready')).toContainText('Uploading replaces all 4 MB of flash');
  await page.getByRole('button', {name: 'Run after unplugging', exact: false}).click();
  await expect(page.getByRole('button', {name: 'Select port & upload', exact: true})).toHaveCount(0);
});

test('cancelling a mocked serial chooser restores controls and ignores a late selection', async ({page}) => {
  await page.addInitScript(() => {
    window.serialOpenCalls = 0;
    Object.defineProperty(navigator, 'serial', {configurable: true, value: {
      addEventListener() {}, removeEventListener() {},
      requestPort: () => new Promise(resolve => { window.chooseMockPort = () => resolve({open: async () => { window.serialOpenCalls++; }}); })
    }});
  });
  await open(page, 'Boards & robots');
  await page.getByRole('button', {name: 'Connect board', exact: true}).click();
  await expect(page.getByLabel('Choose your board', {exact: true})).toBeDisabled();
  await expect(page.getByRole('button', {name: 'Run after unplugging', exact: false})).toBeDisabled();
  await page.getByRole('button', {name: 'Cancel connection', exact: true}).click();
  await expect(page.getByLabel('Choose your board', {exact: true})).toBeEnabled();
  await page.evaluate(() => window.chooseMockPort());
  await expect(page.getByRole('button', {name: 'Connect board', exact: true})).toBeEnabled();
  expect(await page.evaluate(() => window.serialOpenCalls)).toBe(0);
});


test('opening another project with identical circuit values cannot Undo into the previous project', async ({page}) => {
  await open(page, 'Circuit Lab'); await starter(page); await selectResistor(page);
  await resistance(page).fill('1000'); await resistance(page).press('Enter');
  await expect(undo(page)).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save project', exact: true}).click();
  const archive = await JSZip.loadAsync(await readFile(await (await downloaded).path()));
  const metadata = JSON.parse(await archive.file('duetblox.json').async('string'));
  metadata.name = 'Same circuit, different project'; archive.file('duetblox.json', JSON.stringify(metadata));
  const buffer = await archive.generateAsync({type: 'nodebuffer'});
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: 'Open', exact: true}).click();
  await (await chooser).setFiles({name: 'another.duet', mimeType: 'application/zip', buffer});
  await expect(page.getByRole('textbox', {name: 'Project name', exact: true})).toHaveValue(metadata.name);
  await navigate(page, 'Circuit Lab');
  await expect(page.locator('.circuit-canvas')).toContainText('1000 Ω');
  await expect(undo(page)).toBeDisabled(); await expect(redo(page)).toBeDisabled();
});

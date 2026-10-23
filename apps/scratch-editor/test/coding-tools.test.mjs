import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const publicRoot = path.resolve(fileURLToPath(new URL('../../../public/', import.meta.url)));
const editorOverlay = process.env.DUET_EDITOR_OVERLAY && path.resolve(process.env.DUET_EDITOR_OVERLAY);
const evidence = fileURLToPath(new URL('../../../work/release-050/', import.meta.url));
const mime = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm'};
let server, browser, origin;
const delayedCostumeId = '00000000000000000000000000000071';
const harness = `<!doctype html><html><body style="margin:0"><iframe title="DUETBlox editor" src="/scratch/index.html" style="border:0;width:100vw;height:100vh"></iframe><script>
window.messages=[];addEventListener('message',event=>{if(event.source===document.querySelector('iframe').contentWindow&&event.origin===location.origin&&event.data?.channel==='duetblox')messages.push(event.data)});
window.send=(type,payload={})=>new Promise((resolve,reject)=>{const requestId='coding-'+crypto.randomUUID();const listener=event=>{if(event.source!==document.querySelector('iframe').contentWindow||event.origin!==location.origin||event.data?.channel!=='duetblox'||event.data.requestId!==requestId||!['result','error'].includes(event.data.type))return;clearTimeout(timeout);removeEventListener('message',listener);event.data.type==='error'?reject(Error(event.data.payload.message)):resolve(event.data.payload)};const timeout=setTimeout(()=>{removeEventListener('message',listener);reject(Error('Command timed out: '+type))},15000);addEventListener('message',listener);document.querySelector('iframe').contentWindow.postMessage({channel:'duetblox',type,requestId,payload},location.origin)});
</script></body></html>`;

before(async () => {
  await fs.mkdir(evidence, {recursive: true});
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/harness') {res.writeHead(200, {'Content-Type': 'text/html'}); res.end(url.searchParams.get('mode') === 'stage' ? harness.replace('/scratch/index.html', '/scratch/index.html?mode=stage') : harness); return;}
    if (url.pathname === `/scratch-media/${delayedCostumeId}.svg`) {
      setTimeout(() => {res.writeHead(200, {'Content-Type': 'image/svg+xml'}); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>');}, 3200);
      return;
    }
    let file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(publicRoot + path.sep)) {res.writeHead(403); res.end(); return;}
    // An adapter-only build can be verified without replacing public assets
    // while another browser test is using the packaged editor.
    if (editorOverlay && /^\/scratch\/duetblox-[\w.-]+\.js$/.test(url.pathname)) file = path.join(editorOverlay, path.basename(url.pathname));
    if (editorOverlay && url.pathname === '/scratch/editor.css') file = path.join(editorOverlay, 'editor.css');
    try {const data = await fs.readFile(file); res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(data);}
    catch {res.writeHead(404); res.end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
});
after(async () => {await browser?.close(); await new Promise(resolve => server?.close(resolve));});
const command = (page, type, payload = {}) => page.evaluate(({type, payload}) => window.send(type, payload), {type, payload});
async function open(mode = 'editor') {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/harness?mode=${mode}`);
  await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'), null, {timeout: 30000});
  return {page, frame: page.frames().find(f => f.url().includes('/scratch/index.html')), errors};
}

function hardwareFixture(project) {
  const sprite = project.targets.find(t => !t.isStage);
  sprite.blocks = {
    flag: {opcode: 'event_whenflagclicked', next: 'write', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40, y: 40},
    write: {opcode: 'duetHardware_digitalWrite', next: null, parent: 'flag', inputs: {PIN: [1, 'pin'], VALUE: [1, [4, '1']]}, fields: {}, topLevel: false, shadow: false},
    pin: {opcode: 'duetHardware_menu_outputPin', next: null, parent: 'write', inputs: {}, fields: {outputPin: ['3', null]}, topLevel: false, shadow: true},
    analogRead: {opcode: 'duetHardware_readAnalog', next: null, parent: null, inputs: {PIN: [1, 'analogPin']}, fields: {}, topLevel: true, shadow: false, x: 40, y: 160},
    analogPin: {opcode: 'duetHardware_menu_analog', next: null, parent: 'analogRead', inputs: {}, fields: {analog: ['A0', null]}, topLevel: false, shadow: true}
  };
  project.extensions = ['duetHardware'];
  return project;
}

async function paletteText(frame) {
  await frame.locator('#duetHardware.blocklyToolboxCategory').click();
  return frame.locator('.blocklyFlyout').first().textContent();
}

test('board changes refresh real pin menus while preserving existing Uno pin and analog blocks', {timeout: 90000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const fixture = hardwareFixture((await command(page, 'getProject')).project);
    await command(page, 'loadProject', {project: fixture});
    const initial = (await command(page, 'getProject')).project.targets.find(t => !t.isStage).blocks;
    assert.equal(initial.pin.fields.outputPin[0], '3');
    assert.equal(initial.analogPin.fields.analog[0], 'A0');
    const unoPalette = await paletteText(frame);
    assert.match(unoPalette, /analog\s+pin/);

    const observations = [];
    for (const boardId of ['esp32', 'esp32-cam', 'arduino-uno']) {
      const result = await command(page, 'setBoard', {boardId});
      assert.equal(result.boardId, boardId);
      const actual = (await command(page, 'getProject')).project.targets.find(t => !t.isStage).blocks;
      assert.deepEqual(actual, initial, `Changing to ${boardId} must not rewrite the program`);
      const palette = await paletteText(frame);
      if (boardId === 'esp32-cam') assert.doesNotMatch(palette, /analog\s+pin/);
      else assert.match(palette, /analog\s+pin/);
      const flyout = frame.locator('.blocklyFlyout').first();
      const block = flyout.locator('g.blocklyDraggable').filter({hasText: /set\s+digital\s+pin/}).first();
      await block.locator('.duetHardware_menu_outputPin').click();
      const choices = await frame.locator('.blocklyDropdownMenu .blocklyMenuItemContent').allTextContents();
      observations.push({boardId, outputPinChoices: choices});
      await fs.writeFile(path.join(evidence, 'offline-board-menu-observation.json'), JSON.stringify(observations, null, 2));
      if (boardId === 'esp32') {assert.ok(choices.includes('32')); assert.ok(!choices.includes('3')); assert.ok(!choices.includes('34'));}
      if (boardId === 'esp32-cam') assert.deepEqual(choices, ['4', '13', '14']);
      if (boardId === 'arduino-uno') {assert.ok(choices.includes('3')); assert.ok(!choices.includes('32'));}
      await frame.locator('body').press('Escape');
      const afterOpening = (await command(page, 'getProject')).project.targets.find(t => !t.isStage).blocks;
      assert.deepEqual(afterOpening, initial, `Opening the ${boardId} menu must not rewrite the program`);
    }
    await assert.rejects(command(page, 'setBoard', {boardId: 'invalid-board'}), /implemented Arduino or ESP32/);
    await assert.rejects(command(page, 'setBoard', {boardId: 'quarky'}), /implemented Arduino or ESP32/);
    assert.deepEqual(errors, []);
    await page.screenshot({path: path.join(evidence, 'offline-coding-board-menus.png')});
  } finally {await page.close();}
});

test('watch values reads executed variables and bounded lists, excluding broadcasts and limiting the result', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const project = (await command(page, 'getProject')).project;
    const stage = project.targets.find(t => t.isStage), sprite = project.targets.find(t => !t.isStage);
    stage.variables = {global: ['global value', 7], long: ['long text', 'x'.repeat(400)]};
    stage.lists = {}; stage.broadcasts = {secretMessage: 'broadcast is not a value'};
    sprite.variables = {counter: ['counter', 0]}; sprite.lists = {items: ['items', Array.from({length: 15}, (_, i) => `${i}:` + 'z'.repeat(150))]};
    sprite.blocks = {
      flag: {opcode: 'event_whenflagclicked', next: 'set', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40, y: 40},
      set: {opcode: 'data_setvariableto', next: null, parent: 'flag', inputs: {VALUE: [1, [4, '42']]}, fields: {VARIABLE: ['counter', 'counter']}, topLevel: false, shadow: false}
    };
    await command(page, 'loadProject', {project}); await command(page, 'greenFlag');
    let values;
    for (let i = 0; i < 30; i++) {values = await command(page, 'watchValues'); if (values.values.some(v => v.name === 'counter' && v.value === '42')) break; await page.waitForTimeout(50);}
    assert.equal(values.total, 4); assert.equal(values.values.length, 4);
    assert.equal(values.values.find(v => v.name === 'counter').value, '42');
    assert.equal(values.values.find(v => v.name === 'long text').value.length, 240);
    const list = values.values.find(v => v.name === 'items');
    assert.equal(list.type, 'list'); assert.equal(list.length, 15); assert.equal(list.value.length, 10);
    assert.ok(list.value.every(v => v.length === 120));
    assert.ok(!values.values.some(v => v.name.includes('broadcast')));
    for (let i = 0; i < 210; i++) stage.variables[`extra${i}`] = [`extra ${i}`, i];
    await command(page, 'loadProject', {project});
    values = await command(page, 'watchValues');
    assert.equal(values.total, 214); assert.equal(values.values.length, 200);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('showBlock selects the owning sprite and rejects missing or mismatched targets', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const project = (await command(page, 'getProject')).project;
    const first = project.targets.find(t => !t.isStage); first.blocks = {};
    const other = structuredClone(first); other.name = 'Helper'; other.layerOrder = 2;
    other.variables = {}; other.lists = {};
    other.blocks = {
      helperFlag: {opcode: 'event_whenflagclicked', next: 'helperMove', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 70, y: 70},
      helperMove: {opcode: 'motion_movesteps', next: null, parent: 'helperFlag', inputs: {STEPS: [1, [4, '10']]}, fields: {}, topLevel: false, shadow: false}
    };
    project.targets.push(other);
    await command(page, 'loadProject', {project});
    await frame.locator(`input[value="${first.name}"]`).waitFor();
    await frame.getByRole('tab', {name: 'Costumes'}).click();
    await frame.getByText('Convert to Bitmap', {exact: true}).waitFor();
    const result = await command(page, 'showBlock', {blockId: 'helperMove', targetName: 'Helper'});
    assert.deepEqual(result, {targetName: 'Helper', blockId: 'helperMove'});
    await frame.locator('input[value="Helper"]').waitFor();
    assert.equal(await frame.getByRole('tab', {name: 'Code', exact: true}).getAttribute('aria-selected'), 'true');
    await assert.rejects(command(page, 'showBlock', {blockId: 'gone', targetName: 'Helper'}), /changed/);
    await assert.rejects(command(page, 'showBlock', {blockId: 'helperMove', targetName: first.name}), /changed/);
    assert.equal(await frame.locator('input[value="Helper"]').count(), 1);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('showBlock highlight cleanup tolerates switching sprites and resetting the project', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const project = (await command(page, 'getProject')).project;
    const first = project.targets.find(t => !t.isStage);
    first.blocks = {
      firstFlag: {opcode: 'event_whenflagclicked', next: null, parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40, y: 40}
    };
    const other = structuredClone(first); other.name = 'Highlight helper'; other.layerOrder = 2;
    other.variables = {}; other.lists = {};
    other.blocks = {
      helperFlag: {opcode: 'event_whenflagclicked', next: null, parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 70, y: 70}
    };
    project.targets.push(other);
    await command(page, 'loadProject', {project});
    await command(page, 'showBlock', {blockId: 'helperFlag', targetName: other.name});
    await command(page, 'showBlock', {blockId: 'firstFlag', targetName: first.name});
    await frame.locator(`input[value="${first.name}"]`).waitFor();
    // Exercise the real 1.8-second cleanup, after the previous sprite's
    // Blockly workspace has been removed. Fake timers miss GUI lifecycle bugs.
    await page.waitForTimeout(2100);
    assert.deepEqual(errors, [], 'Changing sprite during a highlight must not raise an asynchronous GUI error');

    await command(page, 'showBlock', {blockId: 'helperFlag', targetName: other.name});
    await command(page, 'resetProject');
    await page.waitForTimeout(2100);
    const reset = (await command(page, 'getProject')).project;
    assert.ok(!reset.targets.some(target => target.name === other.name));
    assert.deepEqual(errors, [], 'Removing the highlighted target through reset must not raise an asynchronous GUI error');
  } finally {await page.close();}
});

test('block categories expose the full official palette and navigate from Sounds without editing the program', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const before = (await command(page, 'getProject')).project;
    const catalog = await command(page, 'getBlockCategories');
    assert.deepEqual(catalog.categories.slice(0, 9).map(category => category.id),
      ['motion', 'looks', 'sound', 'events', 'control', 'sensing', 'operators', 'variables', 'myBlocks']);
    assert.equal(catalog.targetName, 'Duet'); assert.equal(catalog.isStage, false);
    for (const category of catalog.categories.slice(0, 7)) assert.ok(category.blockCount > 0, `${category.name} has real blocks`);
    for (const id of ['variables', 'myBlocks']) {
      assert.equal(catalog.categories.find(category => category.id === id).dynamic, true);
      assert.equal(catalog.categories.find(category => category.id === id).blockCount, null);
    }
    await command(page, 'setEditorTab', {tab: 'sounds'});
    for (const categoryId of ['events', 'control', 'sensing', 'operators', 'variables', 'myBlocks', 'duetData', 'duetHardware', 'motion']) {
      const selected = await command(page, 'selectBlockCategory', {categoryId});
      assert.equal(selected.categoryId, categoryId);
      assert.equal(await frame.getByRole('tab', {name: 'Code', exact: true}).getAttribute('aria-selected'), 'true');
      assert.equal(await frame.locator('.blocklyToolboxSelected').getAttribute('id'), categoryId);
    }
    await assert.rejects(command(page, 'selectBlockCategory', {categoryId: 'missing'}), /available block menu/);
    await assert.rejects(command(page, 'selectBlockCategory', {categoryId: '#motion'}), /available block menu/);
    assert.deepEqual((await command(page, 'getProject')).project, before);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('adding an extension reveals its actual palette and remains reachable after a board refresh', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const before = (await command(page, 'getProject')).project;
    await command(page, 'setEditorTab', {tab: 'costumes'});
    await command(page, 'addExtension', {id: 'music'});
    assert.equal(await frame.getByRole('tab', {name: 'Code', exact: true}).getAttribute('aria-selected'), 'true');
    assert.equal(await frame.locator('.blocklyToolboxSelected').getAttribute('id'), 'music');
    assert.ok((await command(page, 'getBlockCategories')).categories.some(category => category.id === 'music' && category.blockCount > 0));
    await command(page, 'selectBlockCategory', {categoryId: 'motion'});
    await command(page, 'addExtension', {id: 'music'});
    assert.equal(await frame.locator('.blocklyToolboxSelected').getAttribute('id'), 'music', 'An already loaded extension must still open its blocks');
    await command(page, 'setBoard', {boardId: 'esp32'});
    await command(page, 'selectBlockCategory', {categoryId: 'duetHardware'});
    assert.equal(await frame.locator('.blocklyToolboxSelected').getAttribute('id'), 'duetHardware');
    const after = (await command(page, 'getProject')).project;
    assert.deepEqual(after.targets, before.targets, 'Browsing categories must preserve every sprite, script and asset');
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('embedded laptop layout keeps stage and backdrop controls visible and preserves a manual stage-size choice', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    await page.locator('iframe').evaluate(element => {element.style.width = 'calc(100vw - 82px)';});
    await page.setViewportSize({width: 1024, height: 900});
    const stage = frame.locator('[class*="stage_stage_"] canvas').first();
    await page.waitForTimeout(200);
    const measurements = [];
    for (const width of [1024, 850, 1280]) {
      await page.setViewportSize({width, height: 900});
      await page.waitForTimeout(200);
      const rects = await frame.evaluate(() => {
        const bounds = selector => {const r = document.querySelector(selector).getBoundingClientRect(); return {left: r.left, right: r.right, width: r.width};};
        return {viewport: innerWidth, stage: bounds('[class*="stage-selector_stage-selector_"]'), column: bounds('[class*="gui_stage-and-target-wrapper_"]'), code: bounds('[class*="gui_editor-wrapper_"]')};
      });
      assert.ok(rects.stage.right <= rects.viewport + 1, `Backdrop controls must fit ${JSON.stringify(rects)}`);
      assert.ok(rects.column.right <= rects.viewport + 1, `Stage controls must fit ${rects.viewport}px iframe`);
      assert.ok(rects.code.width >= 300, 'Keep a useful editable block area');
      measurements.push(rects);
    }
    await frame.getByRole('button', {name: 'Switch to small stage', exact: true}).click();
    await page.setViewportSize({width: 1400, height: 900});
    await page.waitForTimeout(200);
    assert.equal(Math.round((await stage.boundingBox()).width), 240, 'Widening must preserve the student’s small-stage choice');
    await frame.getByRole('button', {name: 'Switch to large stage', exact: true}).click();
    await page.setViewportSize({width: 850, height: 900});
    await page.waitForTimeout(200);
    assert.equal(Math.round((await stage.boundingBox()).width), 240, 'Very narrow viewports temporarily use small stage');
    await page.setViewportSize({width: 1400, height: 900});
    await page.waitForTimeout(200);
    assert.equal(Math.round((await stage.boundingBox()).width), 480, 'Restore the chosen large stage when it fits again');
    await fs.mkdir(path.resolve(evidence, '../block-usability'), {recursive: true});
    await fs.writeFile(path.resolve(evidence, '../block-usability/responsive-editor-measurements.json'), JSON.stringify(measurements, null, 2));
    await page.setViewportSize({width: 1024, height: 900});
    await page.waitForTimeout(200);
    await page.screenshot({path: path.resolve(evidence, '../block-usability/responsive-editor-1024.png')});
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

for (const mode of ['editor', 'stage']) test(`${mode}: Stop and status bypass a slow asset load and cancel a Run already waiting behind it`, {timeout: 60000}, async () => {
  const {page, errors} = await open(mode);
  try {
    const project = (await command(page, 'getProject')).project;
    const sprite = project.targets.find(target => !target.isStage);
    sprite.variables = {counter: ['counter', 0]};
    sprite.blocks = {
      flag: {opcode: 'event_whenflagclicked', next: 'set', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40, y: 40},
      set: {opcode: 'data_setvariableto', next: null, parent: 'flag', inputs: {VALUE: [1, [4, '99']]}, fields: {VARIABLE: ['counter', 'counter']}, topLevel: false, shadow: false}
    };
    sprite.costumes = [{assetId: delayedCostumeId, md5ext: `${delayedCostumeId}.svg`, name: 'Delayed fixture', dataFormat: 'svg', rotationCenterX: 10, rotationCenterY: 10}];
    const assetRequest = page.waitForRequest(request => request.url().endsWith(`${delayedCostumeId}.svg`));
    await page.evaluate(project => {
      window.slowLoad = window.send('loadProject', {project});
      window.queuedRun = window.send('greenFlag').then(value => ({value}), error => ({error: error.message}));
    }, project);
    await assetRequest;
    const started = Date.now();
    await command(page, 'stopAll');
    assert.equal((await command(page, 'status')).running, false);
    await command(page, 'ping');
    assert.ok(Date.now() - started < 1600, 'Stop/status cannot wait for the 3.2 second asset load');
    await page.evaluate(() => window.slowLoad);
    const queued = await page.evaluate(() => window.queuedRun);
    assert.match(queued.error, /Run cancelled because Stop was pressed/);
    assert.equal((await command(page, 'watchValues')).values.find(value => value.name === 'counter').value, '0');
    await command(page, 'greenFlag');
    await page.waitForTimeout(100);
    assert.equal((await command(page, 'watchValues')).values.find(value => value.name === 'counter').value, '99', 'A fresh Run still works after cancellation');
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('multiple forever scripts stop promptly through repeated editor tab navigation', {timeout: 60000}, async () => {
  const {page, errors} = await open();
  try {
    const project = (await command(page, 'getProject')).project;
    const sprite = project.targets.find(target => !target.isStage);
    sprite.variables = {counter: ['counter', 0]}; sprite.blocks = {};
    for (let index = 0; index < 20; index++) {
      sprite.blocks[`flag${index}`] = {opcode: 'event_whenflagclicked', next: `loop${index}`, parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40 + index * 30, y: 40};
      sprite.blocks[`loop${index}`] = {opcode: 'control_forever', next: null, parent: `flag${index}`, inputs: {SUBSTACK: [2, `change${index}`]}, fields: {}, topLevel: false, shadow: false};
      sprite.blocks[`change${index}`] = {opcode: 'data_changevariableby', next: null, parent: `loop${index}`, inputs: {VALUE: [1, [4, '1']]}, fields: {VARIABLE: ['counter', 'counter']}, topLevel: false, shadow: false};
    }
    await command(page, 'loadProject', {project});
    const durations = [];
    for (let iteration = 0; iteration < 3; iteration++) {
      await command(page, 'greenFlag');
      for (const tab of ['costumes', 'sounds', 'code']) await command(page, 'setEditorTab', {tab});
      await page.waitForTimeout(150);
      assert.equal((await command(page, 'status')).running, true);
      const started = Date.now();
      await command(page, 'stopAll'); durations.push(Date.now() - started);
      assert.equal((await command(page, 'status')).running, false);
      const stopped = (await command(page, 'watchValues')).values.find(value => value.name === 'counter').value;
      assert.ok(Number(stopped) > 0);
      await page.waitForTimeout(100);
      assert.equal((await command(page, 'watchValues')).values.find(value => value.name === 'counter').value, stopped);
    }
    assert.ok(durations.every(duration => duration < 1500), `Stop times: ${durations.join(', ')}ms`);
    await fs.mkdir(path.resolve(evidence, '../block-usability'), {recursive: true});
    await fs.writeFile(path.resolve(evidence, '../block-usability/forever-stop-latency.json'), JSON.stringify({scripts: 20, durations}, null, 2));
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('Run explains upload-only board hats while executing ordinary browser scripts unchanged', {timeout: 60000}, async () => {
  const {page, frame, errors} = await open();
  try {
    await command(page, 'selectBlockCategory', {categoryId: 'duetHardware'});
    assert.match(await frame.locator('.blocklyFlyout').first().textContent(), /when\s+board\s+starts\s+\(upload\s+only\)/);
    const project = (await command(page, 'getProject')).project;
    const sprite = project.targets.find(target => !target.isStage);
    sprite.variables = {browser: ['browser', 0], uploaded: ['uploaded', 0]};
    sprite.blocks = {
      flag: {opcode: 'event_whenflagclicked', next: 'browser', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 40, y: 40},
      browser: {opcode: 'data_setvariableto', next: null, parent: 'flag', inputs: {VALUE: [1, [4, '1']]}, fields: {VARIABLE: ['browser', 'browser']}, topLevel: false, shadow: false},
      board: {opcode: 'duetHardware_whenBoardStarts', next: 'upload', parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 400, y: 40},
      upload: {opcode: 'data_setvariableto', next: null, parent: 'board', inputs: {VALUE: [1, [4, '1']]}, fields: {VARIABLE: ['uploaded', 'uploaded']}, topLevel: false, shadow: false}
    };
    await command(page, 'loadProject', {project});
    await page.evaluate(() => {window.messages = [];});
    await command(page, 'greenFlag');
    await page.waitForTimeout(100);
    const warning = await page.evaluate(() => window.messages.find(message => message.type === 'warning'));
    assert.equal(warning.payload.code, 'board-start-upload-only');
    assert.match(warning.payload.message, /compilation\/upload/);
    const values = (await command(page, 'watchValues')).values;
    assert.equal(values.find(value => value.name === 'browser').value, '1');
    assert.equal(values.find(value => value.name === 'uploaded').value, '0');
    const after = (await command(page, 'getProject')).project;
    assert.deepEqual(after.targets.find(target => !target.isStage).blocks, sprite.blocks, 'The notice must not rewrite or reattach board scripts');
    await page.evaluate(() => {window.messages = [];});
    await frame.getByRole('button', {name: 'Start project', exact: true}).click();
    await page.waitForFunction(() => window.messages.some(message => message.type === 'warning' && message.payload.code === 'board-start-upload-only'));
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

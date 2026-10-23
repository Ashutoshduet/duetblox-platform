import {normalizeAppBase} from '../../../src/app-paths.js';
const appBase=normalizeAppBase(process.env.DUETBLOX_BASE_PATH || '/');
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';

const publicRoot = path.resolve(fileURLToPath(new URL('../../../public/', import.meta.url)));
const editorOverlay = process.env.DUET_EDITOR_OVERLAY && path.resolve(process.env.DUET_EDITOR_OVERLAY);
const evidence = fileURLToPath(new URL('../../../work/release-060/', import.meta.url));
const mime = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm'};
let server, browser, origin;
const harness = `<!doctype html><html><body style="margin:0"><iframe title="DUETBlox editor" src="${appBase}scratch/index.html" style="border:0;width:100vw;height:100vh"></iframe><script>
window.messages=[];addEventListener('message',event=>{if(event.source===document.querySelector('iframe').contentWindow&&event.origin===location.origin&&event.data?.channel==='duetblox')messages.push(event.data)});
window.send=(type,payload={})=>new Promise((resolve,reject)=>{const requestId='execution-'+crypto.randomUUID();const listener=event=>{if(event.source!==document.querySelector('iframe').contentWindow||event.origin!==location.origin||event.data?.channel!=='duetblox'||event.data.requestId!==requestId||!['result','error'].includes(event.data.type))return;clearTimeout(timeout);removeEventListener('message',listener);event.data.type==='error'?reject(Error(event.data.payload.message)):resolve(event.data.payload)};const timeout=setTimeout(()=>{removeEventListener('message',listener);reject(Error('Command timed out: '+type))},15000);addEventListener('message',listener);document.querySelector('iframe').contentWindow.postMessage({channel:'duetblox',type,requestId,payload},location.origin)});
</script></body></html>`;

before(async () => {
  await fs.mkdir(evidence, {recursive: true});
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/harness') {res.writeHead(200, {'Content-Type': 'text/html'}); res.end(harness); return;}
    if(!url.pathname.startsWith(appBase)){res.writeHead(404);res.end();return;}
    url.pathname='/'+url.pathname.slice(appBase.length);
    let file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(publicRoot + path.sep)) {res.writeHead(403); res.end(); return;}
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
async function open() {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/harness`);
  await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'), null, {timeout: 30000});
  return {page, frame: page.frames().find(f => f.url().includes('/scratch/index.html')), errors};
}

test('learning adapter is checked against the exact pinned upstream interpreter contract', async () => {
  for (const [name, expected] of Object.entries({
    execute: '70ca1fbae772408701ed4810effeeb8303e2b151f86db7d23e50b953cb2a12f1',
    sequencer: 'ac159bd18ee3836d446fcf62c62ce21f0b0951b90778f31c65458fb6b0700434',
    thread: 'a6b7d6742705abdbf5bd4672035bafa996624f6cc26b5382e53c56c264521621'
  })) {
    const bytes = await fs.readFile(new URL(`../node_modules/@scratch/scratch-vm/src/engine/${name}.js`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `Re-review Learning steps before changing ${name}.js`);
  }
});

const block = (opcode, next, parent, inputs = {}, fields = {}, extra = {}) => ({opcode, next, parent, inputs, fields, shadow: false, topLevel: parent === null, ...(parent === null ? {x: 50, y: 50} : {}), ...extra});
const num = value => [1, [4, String(value)]];
const input = id => [2, id];
const field = ['counter', 'counter'];
const valueOf = async page => (await command(page, 'watchValues')).values.find(v => v.name === 'counter')?.value;
async function fixture(page) {
  const project = (await command(page, 'getProject')).project;
  for (const target of project.targets) {target.blocks = {}; target.variables = {}; target.lists = {}; target.broadcasts = {};}
  project.extensions = []; project.monitors = [];
  const sprite = project.targets.find(t => !t.isStage); sprite.name = 'Learner'; sprite.x = 0; sprite.y = 0;
  sprite.variables = {counter: ['counter', 0]};
  return {project, sprite};
}
async function finish(page, limit = 100) {
  const trace = [];
  let state = await command(page, 'learningStatus');
  while (state.active && trace.length < limit) {state = await command(page, 'learningStep'); trace.push(state);}
  assert.equal(state.status, 'completed');
  return trace;
}

test('real VM executes exactly one synchronous stack block per click, including reporter inputs', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {
      flag: block('event_whenflagclicked', 'set', null),
      set: block('data_setvariableto', 'move', 'flag', {VALUE: input('sum')}, {VARIABLE: field}),
      sum: block('operator_add', null, 'set', {NUM1: num(2), NUM2: num(3)}),
      move: block('motion_changexby', 'increment', 'set', {DX: num(10)}),
      increment: block('data_changevariableby', null, 'move', {VALUE: num(2)}, {VARIABLE: field})
    };
    await command(page, 'loadProject', {project});
    await fs.writeFile(path.join(evidence, 'execution-learning.sb3'), Buffer.from((await command(page, 'saveProject')).base64, 'base64'));
    assert.equal((await command(page, 'learningCheck')).ok, true);
    const start = await command(page, 'learningStart');
    assert.equal(start.status, 'paused'); assert.equal(start.next.blockId, 'set'); assert.equal(start.next.opcode, 'data_setvariableto'); assert.equal(start.stepCount, 0);
    await page.waitForTimeout(250);
    assert.equal(await valueOf(page), '0', 'Automatic VM ticks cannot run a held script');
    let state = await command(page, 'learningStep');
    assert.equal(state.stepCount, 1); assert.equal(state.last.blockId, 'set'); assert.equal(state.next.blockId, 'move');
    assert.equal(state.last.opcode, 'data_setvariableto'); assert.equal(state.next.opcode, 'motion_changexby');
    assert.equal(await valueOf(page), '5', 'Reporter inputs execute as part of the parent command');
    assert.equal((await command(page, 'status')).targets.find(t => t.name === 'Learner').x, 0);
    state = await command(page, 'learningStep');
    assert.equal(state.next.blockId, 'increment');
    assert.equal((await command(page, 'status')).targets.find(t => t.name === 'Learner').x, 10);
    assert.equal(await valueOf(page), '5');
    state = await command(page, 'learningStep');
    assert.equal(state.status, 'completed'); assert.equal(state.stepCount, 3); assert.equal(await valueOf(page), '7');
    await assert.rejects(command(page, 'learningStep'), /Start Learning steps/);
    await fs.writeFile(path.join(evidence, 'execution-sequential.json'), JSON.stringify(state, null, 2));
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('repeat, if/else and non-warp My Blocks match normal official VM execution', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {
      flag: block('event_whenflagclicked', 'set', null),
      set: block('data_setvariableto', 'repeat', 'flag', {VALUE: num(0)}, {VARIABLE: field}),
      repeat: block('control_repeat', 'branch', 'set', {TIMES: num(3), SUBSTACK: input('call')}),
      call: block('procedures_call', null, 'repeat', {arg: num(2)}, {}, {mutation: {tagName: 'mutation', children: [], proccode: 'add %s', argumentids: '["arg"]', warp: 'false'}}),
      def: block('procedures_definition', 'add', null, {custom_block: [1, 'proto']}),
      proto: block('procedures_prototype', null, 'def', {arg: [1, 'arg']}, {}, {shadow: true, mutation: {tagName: 'mutation', children: [], proccode: 'add %s', argumentids: '["arg"]', argumentnames: '["amount"]', argumentdefaults: '[""]', warp: 'false'}}),
      arg: block('argument_reporter_string_number', null, 'proto', {}, {VALUE: ['amount', null]}, {shadow: true}),
      add: block('data_changevariableby', null, 'def', {VALUE: input('value')}, {VARIABLE: field}),
      value: block('argument_reporter_string_number', null, 'add', {}, {VALUE: ['amount', null]}),
      branch: block('control_if_else', null, 'repeat', {CONDITION: input('eq'), SUBSTACK: input('yes'), SUBSTACK2: input('no')}),
      eq: block('operator_equals', null, 'branch', {OPERAND1: [3, [12, 'counter', 'counter'], [10, '']], OPERAND2: num(6)}),
      yes: block('data_changevariableby', null, 'branch', {VALUE: num(100)}, {VARIABLE: field}),
      no: block('data_changevariableby', null, 'branch', {VALUE: num(-100)}, {VARIABLE: field})
    };
    await command(page, 'loadProject', {project});
    await fs.writeFile(path.join(evidence, 'execution-myblocks.sb3'), Buffer.from((await command(page, 'saveProject')).base64, 'base64'));
    await command(page, 'learningStart');
    const trace = await finish(page);
    assert.equal(await valueOf(page), '106');
    assert.equal(trace.filter(s => s.last.blockId === 'add').length, 3);
    assert.equal(trace.filter(s => s.last.blockId === 'yes').length, 1);
    assert.equal(trace.filter(s => s.last.blockId === 'no').length, 0);
    await command(page, 'loadProject', {project}); await command(page, 'greenFlag');
    for (let i = 0; i < 60 && await valueOf(page) !== '106'; i++) await page.waitForTimeout(25);
    assert.equal(await valueOf(page), '106');
    await fs.writeFile(path.join(evidence, 'execution-control-flow-trace.json'), JSON.stringify(trace, null, 2));
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('two green-flag scripts alternate visits; resume uses the remaining official VM stack', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {
      a: block('event_whenflagclicked', 'a1', null), a1: block('data_changevariableby', 'a2', 'a', {VALUE: num(1)}, {VARIABLE: field}), a2: block('data_changevariableby', null, 'a1', {VALUE: num(2)}, {VARIABLE: field}),
      b: block('event_whenflagclicked', 'b1', null, {}, {}, {x: 350, y: 50}), b1: block('data_changevariableby', 'b2', 'b', {VALUE: num(10)}, {VARIABLE: field}), b2: block('data_changevariableby', null, 'b1', {VALUE: num(20)}, {VARIABLE: field})
    };
    await command(page, 'loadProject', {project});
    assert.equal((await command(page, 'learningStart')).threadCount, 2);
    assert.equal((await command(page, 'learningStep')).last.blockId, 'a1'); assert.equal(await valueOf(page), '1');
    assert.equal((await command(page, 'learningStep')).last.blockId, 'b1'); assert.equal(await valueOf(page), '11');
    assert.equal((await command(page, 'learningStep')).last.blockId, 'a2'); assert.equal(await valueOf(page), '13');
    assert.equal((await command(page, 'learningResume')).active, false);
    for (let i = 0; i < 30 && await valueOf(page) !== '33'; i++) await page.waitForTimeout(30);
    assert.equal(await valueOf(page), '33');
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('async, side-effecting, other-hat and warp programs are rejected before their first command', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    for (const opcode of ['control_wait', 'motion_glidesecstoxy', 'looks_sayforsecs', 'sound_play', 'sensing_askandwait', 'duetHardware_digitalWrite', 'duetML_classify', 'event_whenkeypressed', 'control_create_clone_of']) {
      const {project, sprite} = await fixture(page);
      sprite.blocks = {flag: block('event_whenflagclicked', 'set', null), set: block('data_setvariableto', null, 'flag', {VALUE: num(99)}, {VARIABLE: field}), unsupported: block(opcode, null, null)};
      // Unknown extension opcodes do not require a connected board or model.
      await command(page, 'loadProject', {project});
      const check = await command(page, 'learningCheck');
      assert.equal(check.ok, false, opcode); assert.ok(check.issues.some(i => i.opcode === opcode));
      await assert.rejects(command(page, 'learningStart'), /normal Run/);
      await page.waitForTimeout(50); assert.equal(await valueOf(page), '0');
    }
    const {project, sprite} = await fixture(page);
    sprite.blocks = {flag: block('event_whenflagclicked', null, null), proto: block('procedures_prototype', null, null, {}, {}, {shadow: true, mutation: {tagName: 'mutation', children: [], proccode: 'warp', argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'true'}})};
    await command(page, 'loadProject', {project});
    await assert.rejects(command(page, 'learningStart'), /Run without screen refresh/);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('stop, loading and native green flag leave learning mode cleanly; ordinary execution remains usable', {timeout: 90000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {flag: block('event_whenflagclicked', 'set', null), set: block('data_setvariableto', null, 'flag', {VALUE: num(42)}, {VARIABLE: field})};
    await command(page, 'loadProject', {project}); await command(page, 'learningStart');
    await frame.getByRole('button', {name: 'Stop project', exact: true}).click();
    assert.equal((await command(page, 'learningStatus')).active, false);
    await page.waitForTimeout(100); assert.equal(await valueOf(page), '0');
    await command(page, 'learningStart'); await command(page, 'resetProject');
    assert.equal((await command(page, 'learningStatus')).active, false);
    await command(page, 'loadProject', {project}); await command(page, 'learningStart');
    await frame.getByTitle('Go').click();
    for (let i = 0; i < 30 && await valueOf(page) !== '42'; i++) await page.waitForTimeout(30);
    assert.equal(await valueOf(page), '42'); assert.equal((await command(page, 'learningStatus')).active, false);
    await command(page, 'loadProject', {project}); await command(page, 'learningStart');
    const nameInput = frame.locator('input[value="Learner"]');
    await nameInput.fill('Renamed learner');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 20 && (await command(page, 'learningStatus')).active; i++) await page.waitForTimeout(30);
    const edited = await command(page, 'learningStatus');
    assert.equal(edited.active, false); assert.match(edited.reason, /changed/);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('empty branches, a forever loop and stop-all remain bounded and clean', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {
      flag: block('event_whenflagclicked', 'empty', null),
      empty: block('control_if', 'forever', 'flag', {CONDITION: input('true')}),
      true: block('operator_equals', null, 'empty', {OPERAND1: num(1), OPERAND2: num(1)}),
      forever: block('control_forever', null, 'empty', {SUBSTACK: input('add')}),
      add: block('data_changevariableby', null, 'forever', {VALUE: num(1)}, {VARIABLE: field})
    };
    await command(page, 'loadProject', {project}); await command(page, 'learningStart');
    assert.equal((await command(page, 'learningStep')).next.blockId, 'forever');
    assert.equal((await command(page, 'learningStep')).next.blockId, 'add'); assert.equal(await valueOf(page), '0');
    assert.equal((await command(page, 'learningStep')).next.blockId, 'forever'); assert.equal(await valueOf(page), '1');
    await page.waitForTimeout(200); assert.equal(await valueOf(page), '1');
    await command(page, 'learningStop');
    sprite.blocks = {flag: block('event_whenflagclicked', 'stop', null), stop: block('control_stop', 'never', 'flag', {}, {STOP_OPTION: ['all', null]}), never: block('data_changevariableby', null, 'stop', {VALUE: num(1)}, {VARIABLE: field})};
    await command(page, 'loadProject', {project}); await command(page, 'learningStart');
    const stopped = await command(page, 'learningStep');
    assert.equal(stopped.active, false); assert.equal(stopped.status, 'stopped'); assert.equal(await valueOf(page), '0');
    await command(page, 'greenFlag'); await page.waitForTimeout(150); assert.equal(await valueOf(page), '0');
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('multiple sprites are selected and their supported whole-script highlights tolerate project removal', {timeout: 90000}, async () => {
  const {page, frame, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {flag: block('event_whenflagclicked', 'set', null), set: block('data_setvariableto', null, 'flag', {VALUE: num(1)}, {VARIABLE: field})};
    const helper = structuredClone(sprite); helper.name = 'Other learner'; helper.layerOrder = 2;
    helper.blocks = {otherFlag: block('event_whenflagclicked', 'otherSet', null), otherSet: block('data_setvariableto', null, 'otherFlag', {VALUE: num(2)}, {VARIABLE: field})};
    project.targets.push(helper);
    await command(page, 'loadProject', {project});
    let state = await command(page, 'learningStart');
    await frame.locator(`input[value="${state.next.targetName}"]`).waitFor();
    const firstName = state.next.targetName;
    state = await command(page, 'learningStep'); assert.notEqual(state.next.targetName, firstName);
    await frame.locator(`input[value="${state.next.targetName}"]`).waitFor();
    await page.waitForTimeout(100);
    await command(page, 'resetProject'); await page.waitForTimeout(100);
    assert.equal((await command(page, 'learningStatus')).active, false);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});

test('execution revision fences reject stale starts and stale learning cleanup cannot stop a newer normal run', {timeout: 90000}, async () => {
  const {page, errors} = await open();
  try {
    const {project, sprite} = await fixture(page);
    sprite.blocks = {flag: block('event_whenflagclicked', 'loop', null), loop: block('control_forever', null, 'flag', {SUBSTACK: input('add')}), add: block('data_changevariableby', null, 'loop', {VALUE: num(1)}, {VARIABLE: field})};
    await command(page, 'loadProject', {project});
    let checked = await command(page, 'learningCheck');
    assert.equal(Number.isSafeInteger(checked.revision), true);
    for (const invalid of [null, true, '1', -1, 1.25]) await assert.rejects(command(page, 'learningStart', {expectedRevision: invalid}), /revision must be/);
    await command(page, 'stopAll');
    await assert.rejects(command(page, 'learningStart', {expectedRevision: checked.revision}), /changed after this learning check/);
    checked = await command(page, 'learningCheck');
    await command(page, 'greenFlag');
    await assert.rejects(command(page, 'learningStart', {expectedRevision: checked.revision}), /changed after this learning check/);
    await page.waitForTimeout(80);
    const before = Number(await valueOf(page)); assert.ok(before > 0);
    await command(page, 'learningStop'); // Delayed cleanup from an old panel.
    await page.waitForTimeout(100);
    assert.ok(Number(await valueOf(page)) > before, 'Cleanup must not stop the newer normal loop');
    assert.equal((await command(page, 'status')).running, true);
    await command(page, 'stopAll');
    checked = await command(page, 'learningCheck');
    const started = await command(page, 'learningStart', {expectedRevision: checked.revision});
    assert.equal(started.active, true); assert.ok(started.revision > checked.revision);
    assert.equal((await command(page, 'learningStop')).active, false);
    assert.deepEqual(errors, []);
  } finally {await page.close();}
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeVersionedScratchEntry} from '../scripts/versioned-entry.mjs';
import {supportsJuniorCompletion, SCRATCH_BRIDGE_CAPABILITIES} from '../../../src/scratch-protocol.js';
import {scratchEntryURL} from '../../../src/scratch-entry.js';

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);

test('Scratch entry pins both bridge and CSS bytes to new pathnames and retains stable integrations', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'duet-scratch-entry-'));
  try {
    const script = '/* bridge fixture */ window.bridgeVersion = 1;', style = 'body{margin:0}';
    await writeFile(path.join(dir, 'duetblox-editor.js'), script);
    await writeFile(path.join(dir, 'editor.css'), style);
    const entry = await writeVersionedScratchEntry(dir, '/duetblox/');
    assert.equal(entry.script, `/scratch/duetblox-editor-${hash(script)}.js`);
    assert.equal(entry.style, `/scratch/editor-${hash(style)}.css`);
    const html = await readFile(path.join(dir, path.basename(entry.path)), 'utf8');
    assert.equal(entry.path, `/scratch/index-${hash(html)}.html`);
    assert.ok(html.includes(`src="./${path.basename(entry.script)}"`));
    assert.ok(html.includes(`href="./${path.basename(entry.style)}"`));
    assert.ok(!html.includes('src="./duetblox-editor.js"'));
    assert.equal(await readFile(path.join(dir, 'index.html'), 'utf8'), html);
    assert.equal(await readFile(path.join(dir, 'duetblox-editor.js'), 'utf8'), script);
    assert.equal(await readFile(path.join(dir, path.basename(entry.script)), 'utf8'), script);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'runtime-entry.json'), 'utf8')), entry);
    assert.deepEqual(await writeVersionedScratchEntry(dir, '/duetblox/'), entry, 'identical input is reproducible');
    await writeFile(path.join(dir, 'duetblox-editor.js'), `${script}\nwindow.newCompletion = true;`);
    const changed = await writeVersionedScratchEntry(dir, '/duetblox/');
    assert.notEqual(changed.path, entry.path); assert.notEqual(changed.script, entry.script);
    assert.equal(changed.style, entry.style);
    await writeFile(path.join(dir, 'editor.css'), `${style}\ncanvas{display:block}`);
    const restyled = await writeVersionedScratchEntry(dir, '/duetblox/');
    assert.notEqual(restyled.path, changed.path); assert.notEqual(restyled.style, changed.style);
    assert.equal(restyled.script, changed.script);
  } finally {await rm(dir, {recursive: true, force: true});}
});

test('legacy or incompatible stage readiness cannot claim support for verified Junior completion', () => {
  assert.equal(supportsJuniorCompletion({capabilities: SCRATCH_BRIDGE_CAPABILITIES}), true);
  for (const payload of [null, {}, {mode: 'stage', running: false}, {capabilities: {}},
    {capabilities: {juniorCompletion: '1'}}, {capabilities: {juniorCompletion: 0}}, {capabilities: {juniorCompletion: 2}}]) {
    assert.equal(supportsJuniorCompletion(payload), false);
  }
});

test('Scratch entry helper preserves mounted app scope and mode query for non-Vite consumers', () => {
  assert.equal(scratchEntryURL('?mode=stage', '/duetblox/'), '/duetblox/scratch/index.html?mode=stage');
  assert.equal(scratchEntryURL('?studio=1', '/'), '/scratch/index.html?studio=1');
});

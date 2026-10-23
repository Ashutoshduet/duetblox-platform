import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {inlineSandboxDelivery, patchSandboxDelivery} from '../scripts/sandbox-delivery.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../public/', import.meta.url);
const distributions = [
  ['scratch-gui-standalone.js', '@scratch/scratch-gui/dist/scratch-gui-standalone.js'],
  ['vendor/scratch-vm.js', '@scratch/scratch-vm/dist/web/scratch-vm.js'],
  ['vendor/scratch-render.min.js', '@scratch/scratch-render/dist/web/scratch-render.min.js'],
  ['vendor/scratch-svg-renderer.js', '@scratch/scratch-svg-renderer/dist/web/scratch-svg-renderer.js']
];

test('sandbox delivery patch rejects changed, missing, duplicate and already patched predicates', async () => {
  for (const [file, upstream] of distributions) {
    const source = await fs.readFile(new URL(`node_modules/${upstream}`, root), 'utf8');
    const patched = patchSandboxDelivery(source, file);
    assert.equal(patched.split(inlineSandboxDelivery).length - 1, 1);
    assert.throws(() => patchSandboxDelivery(patched, file), /did not match/);
    assert.throws(() => patchSandboxDelivery(source + source, file), /did not match/);
    assert.throws(() => patchSandboxDelivery(source.replace('"http:"===window.location.protocol', '"file:"===window.location.protocol'), file), /did not match/);
  }
  const storage = await fs.readFile(new URL('node_modules/@scratch/scratch-storage/dist/web/scratch-storage.js', root), 'utf8');
  assert.equal(patchSandboxDelivery(storage, 'vendor/scratch-storage.js'), storage);
  assert.throws(() => patchSandboxDelivery(storage, 'unrecognized.js'), /did not match/);
});

test('shipped sandbox selectors use bundled source delivery on HTTPS, HTTP and local hosts', async () => {
  for (const [file] of distributions) {
    const source = await fs.readFile(new URL(`scratch/${file}`, publicRoot), 'utf8');
    const selector = source.match(/(?:\(\)=>\(false\/\* DUETBlox offline sandbox delivery \*\/\)|function\(\)\{return\(false\/\* DUETBlox offline sandbox delivery \*\/\)\})/);
    assert.ok(selector, `${file} must contain the patched real delivery selector`);
    const select = Function('window', `return (${selector[0]})()`);
    for (const url of ['https://duetblox.test/', 'http://classroom.test/', 'http://localhost/', 'http://127.0.0.1/', 'file:///offline/']) {
      assert.equal(select({location: new URL(url)}), false, `${file} at ${url}`);
    }
    assert.ok(source.includes('"sandbox","allow-scripts"'), `${file} retains an opaque iframe`);
    assert.ok(!source.includes('"sandbox","allow-scripts allow-same-origin"'));
  }
});

test('HTTPS costume editor loads source chunks into opaque sandboxes without resource script requests', {timeout: 60000}, async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  const requests = [], errors = [], failed = [];
  const fixtureOrigin = 'https://duetblox.test';
  const directory = fileURLToPath(publicRoot);
  const mime = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm'};
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failed.push(request.url()));
  try {
    // An HTTPS hostname is intentional: the former localhost-only patch hid
    // this regression in the existing local development/browser tests.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixtureOrigin) return route.abort();
      if (url.pathname === '/harness') return route.fulfill({contentType: 'text/html', body: '<!doctype html><iframe title="Editor" src="/scratch/index.html" style="width:100%;height:850px"></iframe><script>window.ready=false;window.addEventListener("message",event=>{if(event.origin===location.origin&&event.data.type==="ready")window.ready=true})</script>'});
      const file = path.resolve(directory, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(directory)) return route.abort();
      try { return await route.fulfill({contentType: mime[path.extname(file)] || 'application/octet-stream', body: await fs.readFile(file)}); }
      catch { return route.fulfill({status: 404, body: 'Missing test fixture asset'}); }
    });
    await page.goto(`${fixtureOrigin}/harness`);
    await page.waitForFunction(() => window.ready, null, {timeout: 30000});
    const editor = page.frames().find(frame => frame.url().includes('/scratch/index.html'));
    await editor.getByRole('tab', {name: 'Costumes'}).click();
    await editor.getByText('Convert to Bitmap', {exact: true}).waitFor({timeout: 15000});
    await editor.waitForFunction(() => [...document.querySelectorAll('iframe[sandbox]')].some(frame => frame.srcdoc.includes('Paper.js')));
    const sandboxes = await editor.locator('iframe[sandbox]').evaluateAll(frames => frames.map(frame => ({sandbox: frame.getAttribute('sandbox'), external: /<script[^>]+src\s*=/.test(frame.srcdoc), csp: frame.srcdoc.includes('Content-Security-Policy')})));
    assert.ok(sandboxes.length > 0);
    for (const sandbox of sandboxes) assert.deepEqual(sandbox, {sandbox: 'allow-scripts', external: false, csp: true});
    assert.ok(requests.some(url => /\/paper-source\.[^/]+\.js$/.test(url)), 'Paper source chunk loads in the controlled parent');
    assert.deepEqual(requests.filter(url => /(?:paper-core|paper-import|runner|measure-svg).*\?resource/.test(url)), [], 'opaque frames never request external resource scripts');
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
  } finally { await browser.close(); }
});

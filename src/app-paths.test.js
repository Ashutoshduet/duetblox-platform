import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {appPath,normalizeAppBase} from './app-paths.js';

test('deployment base accepts root and nested directories, never URLs or traversal', () => {
  assert.equal(normalizeAppBase('/'), '/');
  assert.equal(normalizeAppBase('/duetblox'), '/duetblox/');
  assert.equal(normalizeAppBase('/school/apps/'), '/school/apps/');
  for (const invalid of ['', 'duetblox/', '//duetblox/', '/a//b/', '/a/../b/', '/./', '/%2e%2e/', '/a?x', '/a#x', 'https://duetpower.in/duetblox/', '/a\\b/']) {
    assert.throws(() => normalizeAppBase(invalid), /DUETBLOX_BASE_PATH/);
  }
});

test('all bundled resource families stay under the configured deployment directory', () => {
  const paths = ['/scratch/index.html?studio=1', '/scratch/index.html?mode=stage', '/scratch-media/costume.svg',
    '/models/image/model.json', '/models/sound/metadata.json', '/models/pose/model.json', '/python/runtime/pyodide.asm.wasm',
    '/firmware/arduino-uno.json', '/examples/learning-steps.sb3', '/source/duetblox-source.zip',
    '/THIRD_PARTY_NOTICES.txt', '/fonts/fonts.css', '/manifest.webmanifest', '/sw.js'];
  for (const path of paths) {
    const resolved = new URL(appPath(path, '/duetblox/'), 'https://duetpower.in/');
    assert.equal(resolved.origin, 'https://duetpower.in');
    assert.ok(resolved.pathname.startsWith('/duetblox/'), resolved.href);
    assert.equal(appPath(path, '/'), path);
  }
});

test('app paths preserve directory, query and fragment semantics without double prefixing', () => {
  assert.equal(appPath('/', '/duetblox/'), '/duetblox/');
  assert.equal(appPath('', '/duetblox/'), '/duetblox/');
  assert.equal(appPath('/duetblox', '/duetblox/'), '/duetblox/');
  assert.equal(appPath('source/', '/duetblox/'), '/duetblox/source/');
  assert.equal(appPath('/duetblox/scratch/index.html?studio=1#stage', '/duetblox/'), '/duetblox/scratch/index.html?studio=1#stage');
  assert.equal(appPath('/duetblox-other/file', '/duetblox/'), '/duetblox/duetblox-other/file');
  assert.equal(appPath('/source/?download=1#build', '/school/apps/'), '/school/apps/source/?download=1#build');
  assert.equal(appPath('/source/'), '/source/');
});

test('app paths cannot turn a bundled request into another origin or escape the base', () => {
  for (const path of ['https://example.org/model.json', '//example.org/model.json', 'data:text/plain,x',
    '../model.json', '/a/../model.json', '/%2e%2e/model.json', '/%2fexample.org/file', '/a\\b', '/%5cb', '/%00', '/bad%zz']) {
    assert.throws(() => appPath(path, '/duetblox/'));
  }
});

test('Vite uses the build environment base and rejects unsafe deployment values', () => {
  const cwd = new URL('../', import.meta.url);
  const configBase = value => execFileSync(process.execPath,
    ['--input-type=module', '-e', "import config from './vite.config.js';process.stdout.write(config.base);"],
    {cwd, env:{...process.env, DUETBLOX_BASE_PATH:value}, encoding:'utf8', stdio:['ignore','pipe','pipe']});
  assert.equal(configBase('/'), '/');
  assert.equal(configBase('/duetblox/'), '/duetblox/');
  assert.throws(() => configBase('https://example.org/'));
});

test('HTML shell and font stylesheet resolve within both root and subpath deployments', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/fonts/fonts.css', import.meta.url), 'utf8');
  for (const base of ['/', '/duetblox/']) {
    const resolved = html.replaceAll('%BASE_URL%', base);
    for (const suffix of ['favicon.svg', 'manifest.webmanifest', 'fonts/fonts.css']) {
      assert.ok(resolved.includes(`href="${base}${suffix}"`), suffix);
    }
    const fontURLs = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => new URL(match[1], `https://duetpower.in${base}fonts/fonts.css`));
    assert.equal(fontURLs.length, 9);
    assert.ok(fontURLs.every(url => url.pathname.startsWith(`${base}fonts/`)));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, copyFile, mkdir, mkdtemp, writeFile, symlink, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
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

test('Vite uses a matching generated runtime and rejects unsafe or mismatched deployment values', async () => {
  // Import the real config in an isolated checkout-shaped fixture. Do not
  // rewrite the active build's entry metadata while other tests use its files.
  const cwd = await mkdtemp(path.join(tmpdir(), 'duet-vite-base-'));
  const entryPath = '/scratch/index-0123456789abcdef0123.html';
  const metadata = path.join(cwd, 'public/scratch/runtime-entry.json');
  const config = value => JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', "import config from './vite.config.js';process.stdout.write(JSON.stringify({base:config.base,entry:config.define.__DUET_SCRATCH_ENTRY_PATH__}));"],
    {cwd, env:{...process.env, DUETBLOX_BASE_PATH:value}, encoding:'utf8', stdio:['ignore','pipe','pipe']}));
  const failsWith = pattern => error => Boolean(error.stderr?.toString().match(pattern));
  try {
    await mkdir(path.join(cwd, 'src'), {recursive: true});
    await mkdir(path.dirname(metadata), {recursive: true});
    await writeFile(path.join(cwd, 'package.json'), '{"type":"module"}\n');
    await copyFile(new URL('../vite.config.js', import.meta.url), path.join(cwd, 'vite.config.js'));
    await copyFile(new URL('./app-paths.js', import.meta.url), path.join(cwd, 'src/app-paths.js'));
    await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(cwd, 'node_modules'), 'dir');
    for (const basePath of ['/', '/duetblox/', '/school/apps/']) {
      await writeFile(metadata, JSON.stringify({version: 1, basePath, path: entryPath}));
      assert.deepEqual(config(basePath), {base: basePath, entry: JSON.stringify(entryPath)});
    }
    assert.throws(() => config('https://example.org/'), failsWith(/DUETBLOX_BASE_PATH must be/));
    assert.throws(() => config('/'), failsWith(/Scratch runtime does not match/));
    for (const invalid of ['/scratch/index.html', '/outside/index-0123456789abcdef0123.html', '//example.org/index-0123456789abcdef0123.html']) {
      await writeFile(metadata, JSON.stringify({version: 1, basePath: '/', path: invalid}));
      assert.throws(() => config('/'), failsWith(/Scratch runtime does not match/));
    }
    await rm(metadata);
    assert.throws(() => config('/'), failsWith(/Build the Scratch runtime before starting/));
  } finally {await rm(cwd, {recursive: true, force: true});}
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

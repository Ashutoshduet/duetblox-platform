import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

for (const base of ['/', '/duetblox/']) {
  test(`Python worker loads only its pinned runtime under ${base}`, async () => {
    // Bundle the real worker without writing any release output, as Vite does.
    const result = await build({entryPoints:[fileURLToPath(new URL('./worker.js', import.meta.url))],
      bundle:true, write:false, format:'iife', platform:'browser',
      define:{'import.meta.env':JSON.stringify({BASE_URL:base})}});
    const fetched = [];
    const self = {location:{origin:'https://duetpower.in', href:`https://duetpower.in${base}assets/python-worker.js`},
      fetch:async url => {fetched.push(String(url));return {ok:true};}};
    runInNewContext(result.outputFiles[0].text, {self, URL});
    const runtime = `https://duetpower.in${base}python/runtime/`;
    await self.fetch(`${runtime}pyodide.asm.wasm`);
    await self.fetch(`${runtime}python_stdlib.zip`);
    assert.deepEqual(fetched, [`${runtime}pyodide.asm.wasm`, `${runtime}python_stdlib.zip`]);
    for (const disallowed of ['https://example.org/python/runtime/file', `${runtime}../outside.json`,
      'https://duetpower.in/source/duetblox-source.zip', `https://duetpower.in${base}python/runtime-other/file`]) {
      await assert.rejects(self.fetch(disallowed), /Network access is disabled/);
    }
    if (base !== '/') await assert.rejects(self.fetch('https://duetpower.in/python/runtime/pyodide.asm.wasm'), /Network access is disabled/);
    assert.equal(fetched.length, 2);
  });
}

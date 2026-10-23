import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {safeHullFormatSource} from '../scripts/hardening.mjs';

test('deployed hull converters preserve point arrays and reject executable format strings',async()=>{
  const safe = Function(`return ({${safeHullFormatSource}})`)();
  const points=[[1,2],[5,8],[3,4]];
  assert.deepEqual(safe.toXy(points),points);assert.notEqual(safe.toXy(points),points);
  assert.deepEqual(safe.fromXy(points),points);
  globalThis.duetHullSentinel=false;
  assert.throws(()=>safe.toXy(points,['.x];globalThis.duetHullSentinel=true;//','.y']),/does not support/);
  assert.equal(globalThis.duetHullSentinel,false);delete globalThis.duetHullSentinel;
  for(const file of ['scratch-gui-standalone.js','vendor/scratch-render.min.js']){
    const source=await fs.readFile(new URL(`../../../public/scratch/${file}`,import.meta.url),'utf8');
    assert.ok(source.includes(safeHullFormatSource));assert.ok(!source.includes('new Function("pt"'));
  }
});

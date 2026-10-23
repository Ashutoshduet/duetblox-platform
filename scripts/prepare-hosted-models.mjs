// Hosting has a 256 MiB expanded-artifact limit. The full laptop build keeps
// every checkpoint. Hosted ResNet shards are fetched from pinned official
// mirrors, verified and cached by the same-origin offline worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {appPath} from '../src/app-paths.js';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
const lock=JSON.parse(await fs.readFile(path.join(root,'scripts/ml-models.lock.json'),'utf8'));
const pack=JSON.parse(await fs.readFile(path.join(dist,'offline-manifest.json'),'utf8'));
const worker=await fs.readFile(path.join(dist,'sw.js'),'utf8');
const shards=lock.files.filter(file=>/^pose\/resnet50\/group1-shard\d+of23\.bin$/.test(file.path));
assert.equal(shards.length,23);
for(const shard of shards){
  const url=appPath(`models/${shard.path}`,pack.basePath || '/'),entry=pack.files.find(file=>file.url===url);
  assert.ok(entry,url);assert.equal(entry.bytes,shard.bytes);assert.equal(entry.sha256,shard.sha256);
  assert.ok(worker.includes(shard.source)&&worker.includes(shard.sha256),'Build the verified offline mirror worker before packaging.');
  const bytes=await fs.readFile(path.join(dist,'models',shard.path));
  assert.equal(bytes.length,shard.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),shard.sha256);
}
for(const shard of shards)await fs.unlink(path.join(dist,'models',shard.path));
await fs.writeFile(path.join(dist,'source/hosting-models.json'),JSON.stringify({
  format:1,offlinePack:pack.version,
  note:'These exact ResNet weight shards are available through the offline worker: local first, then a pinned official HTTPS mirror, with byte count and SHA-256 verified before cache storage. Make available offline prepares them for disconnected use. Full laptop builds retain these files locally.',
  shards
},null,2)+'\n');
console.log(`Hosting models: ${shards.length} ResNet shards use verified mirrors; ${(shards.reduce((total,file)=>total+file.bytes,0)/1048576).toFixed(2)} MiB moved out of the hosting input. All architectures and the complete offline manifest remain.`);

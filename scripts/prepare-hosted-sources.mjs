// Keep the full offline runtime; use pinned official downloads for unchanged sources.
// Run only in the hosting checkout, after build. The laptop build keeps its mirrors.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {appPath} from '../src/app-paths.js';
const root=path.resolve(import.meta.dirname,'..');
const dist=path.join(root,'dist');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const upstream=JSON.parse(await fs.readFile(path.join(dist,'source/upstream/manifest.json'),'utf8'));
const hardware=JSON.parse(await fs.readFile(path.join(dist,'source/hardware/manifest.json'),'utf8'));
const offline=JSON.parse(await fs.readFile(path.join(dist,'offline-manifest.json'),'utf8'));
const pages=await fs.readFile(path.join(dist,'source/index.html'),'utf8')+await fs.readFile(path.join(dist,'source/hardware/index.html'),'utf8');
const omitted=[];
function safeName(name){assert.match(name,/^[A-Za-z0-9_.-]+$/);assert.ok(name!=='.'&&name!=='..');return name;}
async function check(group,part,url){
  assert.equal(new URL(url).protocol,'https:');
  assert.ok(pages.includes(`href="${url}"`),`Source download is not linked: ${url}`);
  const relative=`source/${group}/${safeName(part.file)}`;
  assert.ok(!offline.files.some(file=>file.url===appPath(relative,offline.basePath || '/')),'Cannot omit an offline runtime asset');
  const bytes=await fs.readFile(path.join(dist,relative));
  assert.equal(bytes.length,part.bytes,relative);assert.equal(hash(bytes),part.sha256,relative);
  omitted.push({file:relative,bytes:bytes.length,sha256:part.sha256,download:url});
}
for(const archive of upstream.archives)for(const part of archive.parts)await check('upstream',part,archive.url);
for(const name of hardware.splitArchive.parts){
  const part=hardware.files.find(file=>file.name===name);assert.ok(part,name);
  await check('hardware',{file:part.name,bytes:part.size,sha256:part.sha256},hardware.splitArchive.upstream);
}
// Validate all packets and links before deleting any generated mirror.
for(const file of omitted)await fs.unlink(path.join(dist,file.file));
await fs.writeFile(path.join(dist,'source/hosting-packaging.json'),JSON.stringify({
  format:1,offlinePackUnchanged:offline.version,
  note:'Only unchanged upstream source mirrors are omitted here. Exact official full archives are linked on the application’s source/ page. The complete laptop handoff retains every packet. Restore scripts verify full and split checksums.',
  omitted
},null,2)+'\n');
console.log(`Hosting sources: ${omitted.length} verified mirrors replaced by pinned official links; ${(omitted.reduce((n,file)=>n+file.bytes,0)/1048576).toFixed(2)} MiB removed. Offline pack ${offline.version} unchanged.`);

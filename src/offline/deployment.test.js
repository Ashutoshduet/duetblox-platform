import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {restoreSourcePackets} from '../../scripts/restore-source-packets.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');

for(const base of ['/','/duetblox/'])test(`built preview serves only its ${base} application directory`,async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'duet-preview-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const name of ['scripts','src','dist/scratch'])await mkdir(path.join(root,name),{recursive:true});
 for(const name of ['scripts/serve-built.mjs','src/app-paths.js'])await writeFile(path.join(root,name),await readFile(new URL('../../'+name,import.meta.url)));
 await writeFile(path.join(root,'package.json'),' {"type":"module"}');
 await writeFile(path.join(root,'dist/offline-manifest.json'),JSON.stringify({basePath:base}));
 await writeFile(path.join(root,'dist/index.html'),'mounted studio');
 await writeFile(path.join(root,'dist/scratch/index.html'),'mounted editor');
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
 const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const child=spawn(process.execPath,[path.join(root,'scripts/serve-built.mjs')],{env:{...process.env,DUETBLOX_PORT:String(port),DUETBLOX_BASE_PATH:base},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Preview did not start')),5000);child.stdout.on('data',data=>{if(String(data).includes('DUETBlox:')){clearTimeout(timeout);resolve();}});child.once('error',reject);child.once('exit',code=>{if(code){clearTimeout(timeout);reject(Error('Preview exited: '+code));}});});
 const origin=`http://127.0.0.1:${port}`;
 assert.equal(await (await fetch(origin+base)).text(),'mounted studio');
 assert.equal(await (await fetch(origin+base+'scratch/')).text(),'mounted editor');
 assert.equal((await fetch(origin+base+'scratch/index.html',{method:'HEAD'})).status,200);
 if(base!=='/'){
  for(const pathname of ['/','/index.html','/scratch/index.html','/duetblox-other/'])assert.equal((await fetch(origin+pathname)).status,404,pathname);
  const response=await fetch(origin+base.slice(0,-1),{redirect:'manual'});assert.equal(response.status,308);assert.equal(response.headers.get('location'),base);
 }
});

test('source restoration preserves a configured subdirectory instead of requesting website-root packets',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'duet-source-path-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const body='archive',digest=hash(body),readme='build instructions';
 const upstream={archives:[{archive:'official.tar.gz',bytes:body.length,sha256:digest,url:'https://official.example/source.tar.gz',parts:[{file:'official.tar.gz',bytes:body.length,sha256:digest}]}]};
 const hardware={files:[{name:'board.tar.gz',size:body.length,sha256:digest}],splitArchive:{name:'board.tar.gz',size:body.length,sha256:digest,upstream:'https://official.example/board.tar.gz',parts:['board.tar.gz']}};
 for(const [group,manifest,file] of [['upstream',upstream,'official.tar.gz'],['hardware',hardware,'board.tar.gz']]){
  const dir=path.join(root,'public/source',group);await mkdir(dir,{recursive:true});
  const text=JSON.stringify(manifest);await writeFile(path.join(dir,'manifest.json'),text);await writeFile(path.join(dir,file),body);
  await writeFile(path.join(dir,'SHA256SUMS'),`${hash(text)}  manifest.json\n${digest}  ${file}\n${hash(readme)}  BUILDING.txt\n`);
 }
 const requests=[];const result=await restoreSourcePackets({root,host:'https://website.example/duetblox',fetchImpl:async url=>{requests.push(url);return new Response(readme);}});
 assert.equal(result.restored,2);assert.equal(result.archivesFetched,0);
 assert.deepEqual(requests,['https://website.example/duetblox/source/upstream/BUILDING.txt','https://website.example/duetblox/source/hardware/BUILDING.txt']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const workerSource=await readFile(new URL('./worker.js',import.meta.url),'utf8');
const origin='https://duetblox.test';
const hash=data=>createHash('sha256').update(data).digest('hex');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function tickUntil(check){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setImmediate(resolve));}throw new Error('Worker test condition did not settle');}
function harness({responses={'/':'studio','/scratch/index.html':'scratch studio','/models/weights.bin':'weights'},mirrors={},fetchHook,openHook,scheduleTimeout=setTimeout}={}){
  const files=Object.entries(responses).map(([url,body])=>({url,bytes:Buffer.byteLength(body),sha256:hash(body),shell:url==='/'}));
  const pack={version:'test-pack',files,bytes:files.reduce((n,f)=>n+f.bytes,0)};
  const stored=new Map(),listeners=new Map(),requests=[];
  const key=value=>new URL(typeof value==='string'?value:value.url,origin).href;
  const cache={
    async match(request){return stored.get(key(request))?.clone();},
    async put(request,response){stored.set(key(request),response.clone());},
    async delete(request){return stored.delete(key(request));},
    async keys(){return [...stored.keys()].map(url=>new Request(url));}
  };
  const context={URL,Response,Request,Headers,crypto:webcrypto,setTimeout:scheduleTimeout,clearTimeout,AbortController,AbortSignal,Date,
    caches:{async open(){await openHook?.();return cache;}},
    fetch:async(input,options)=>{const url=key(input);requests.push({url,options});const hooked=await fetchHook?.(url,options);if(hooked)return hooked;const body=responses[new URL(url).pathname];return new Response(body??'not found',{status:body===undefined?404:200});},
    self:{location:{origin},clients:{claim:async()=>{}},addEventListener:(name,fn)=>listeners.set(name,fn)}
  };
  vm.runInNewContext(workerSource.replace('__DUET_OFFLINE_MANIFEST__',JSON.stringify(pack)).replace('__DUET_OFFLINE_MIRRORS__',JSON.stringify(mirrors)),context);
  const command=(type,data={})=>{const messages=[],pending=[];listeners.get('message')({data:{type,...data},ports:[{postMessage:message=>messages.push(message)}],waitUntil:promise=>pending.push(promise)});return {messages,done:Promise.all(pending)};};
  const finished=async(type,data={})=>{const run=command(type,data);await run.done;return run.messages.at(-1);};
  const request=async(url,method='GET')=>{let answer;listeners.get('fetch')({request:new Request(new URL(url,origin),{method}),respondWith:promise=>{answer=promise;}});return answer?await answer:null;};
  const install=()=>{let result;listeners.get('install')({waitUntil:promise=>{result=promise;}});return result;};
  return {pack,cache,requests,command,finished,request,install,stored};
}

test('offline pack remains unready until every file has been verified and stored',async()=>{
  const gate=deferred();let started=false;
  const h=harness({fetchHook:async url=>{if(url.endsWith('/models/weights.bin')){started=true;await gate.promise;}}});
  const pending=h.command('PREPARE');await tickUntil(()=>started);
  assert.equal((await h.finished('STATUS')).ready,false);
  assert.equal(pending.messages.some(m=>m.type==='complete'),false);
  assert.equal((await h.finished('SET_OFFLINE',{enabled:true})).type,'error');
  gate.resolve();await pending.done;
  assert.equal(pending.messages.at(-1).type,'complete');
  assert.equal((await h.finished('STATUS')).ready,true);
  assert.equal((await h.finished('SET_OFFLINE',{enabled:true})).offline,true);
});

test('a bad checksum never caches the broken asset or marks the pack ready',async()=>{
  const h=harness({fetchHook:async url=>url.endsWith('weights.bin')?new Response('changed'):null});
  const result=await h.finished('PREPARE');
  assert.equal(result.type,'error');assert.match(result.message,/verification/);
  assert.equal(await h.cache.match('/models/weights.bin'),undefined);
  assert.equal((await h.finished('STATUS')).ready,false);
});

test('cancellation cannot complete or cache a late network response, and preparation can resume',async()=>{
  const gate=deferred();let started=false,wait=true;
  const h=harness({fetchHook:async(url,options)=>{if(url.endsWith('weights.bin')&&wait){started=true;await Promise.race([gate.promise,new Promise((_,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))]);}}});
  const pending=h.command('PREPARE');await tickUntil(()=>started);
  assert.equal((await h.finished('CANCEL')).type,'cancelled');gate.resolve();await pending.done;
  assert.equal(pending.messages.some(m=>m.type==='complete'),false);
  assert.equal(await h.cache.match('/models/weights.bin'),undefined);
  assert.equal((await h.finished('STATUS')).ready,false);
  wait=false;assert.equal((await h.finished('PREPARE')).type,'complete');
});

test('offline mode serves cached Scratch query URLs and blocks external GET and POST',async()=>{
  const h=harness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
  const count=h.requests.length;
  const cached=await h.request('/scratch/index.html?stage=duet&locale=hi');
  assert.equal(await cached.text(),'scratch studio');
  for(const method of ['GET','POST','PUT','DELETE']){
    const blocked=await h.request('https://remote.example/api',method);
    assert.ok(blocked,`Offline ${method} must be intercepted`);assert.equal(blocked.status,503);
  }
  assert.equal(h.requests.length,count,'Offline requests must not invoke fetch');
});

test('local Arduino compiler stays reachable in offline mode without opening other hosts or ports',async()=>{
  const h=harness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
  for(const host of ['127.0.0.1','localhost','[::1]'])for(const method of ['GET','POST'])assert.equal(await h.request(`http://${host}:8765/compile`,method),null);
  assert.equal((await h.request('http://127.0.0.1:8766/compile')).status,503);
  assert.equal((await h.request('https://remote.example:8765/compile')).status,503);
});

test('status detects a partially evicted cache and stops claiming readiness',async()=>{
  const h=harness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
  await h.cache.delete('/models/weights.bin');const status=await h.finished('STATUS');
  assert.equal(status.ready,false);assert.equal(status.offline,true);
  assert.equal((await h.request('https://remote.example/api','POST')).status,503);
  assert.equal((await h.finished('SET_OFFLINE',{enabled:true})).type,'error');
});

test('storage-open failure releases preparation ownership so a later retry can run',async()=>{
  let fail=true;const h=harness({openHook:async()=>{if(fail){fail=false;throw new Error('Storage unavailable');}}});
  assert.equal((await h.finished('PREPARE')).type,'error');
  assert.equal((await h.finished('STATUS')).busy,false);
  assert.equal((await h.finished('PREPARE')).type,'complete');
});

test('another tab cannot start a competing preparation job',async()=>{
  const gate=deferred();let started=false;
  const h=harness({fetchHook:async url=>{if(url.endsWith('weights.bin')){started=true;await gate.promise;}}});
  const first=h.command('PREPARE');await tickUntil(()=>started);
  const second=await h.finished('PREPARE');assert.equal(second.type,'error');assert.match(second.message,/already running/);
  gate.resolve();await first.done;assert.equal(first.messages.at(-1).type,'complete');
});

test('enabling offline mode validates the pack even when status was not checked after eviction',async()=>{
  const h=harness();await h.finished('PREPARE');await h.cache.delete('/models/weights.bin');
  const result=await h.finished('SET_OFFLINE',{enabled:true});
  assert.equal(result.type,'error');
  assert.equal((await h.finished('STATUS')).ready,false);
});

test('explicit check and repair replaces a changed cached response using its pinned hash',async()=>{
  const h=harness();await h.finished('PREPARE');
  await h.cache.put('/models/weights.bin',new Response('WEIGHTS'));
  const count=h.requests.length;
  assert.equal((await h.finished('PREPARE')).type,'complete');
  assert.equal(await (await h.cache.match('/models/weights.bin')).text(),'weights');
  assert.ok(h.requests.length>count,'Changed cache entry must be fetched and verified again');
});


test('repair preserves the explicit offline network policy',async()=>{
  const h=harness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
  const repaired=await h.finished('PREPARE');assert.equal(repaired.type,'complete');assert.equal(repaired.offline,true);
  assert.equal((await h.request('https://remote.example/api')).status,503);
});


test('private classroom API bypasses caches and remains LAN reachable in offline mode',async()=>{
 const h=harness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
 for(const host of ['localhost','127.0.0.1','[::1]','10.1.2.3','192.168.1.10','172.16.1.2','172.31.255.9'])for(const method of ['GET','POST'])assert.equal(await h.request(`http://${host}:5191/api/classroom/rooms/test/variables`,method),null);
 for(const host of ['remote.example','192.169.1.2','172.32.1.2','11.1.2.3'])assert.equal((await h.request(`https://${host}/api/classroom/rooms/test/variables`)).status,503);
 assert.equal((await h.request('http://192.168.1.10/other-api')).status,503);
 assert.equal([...h.stored.keys()].some(k=>k.includes('/api/classroom/')),false);
});

const mirroredFile='/models/pose/resnet50/group1-shard1of23.bin';
const officialMirror='https://storage.googleapis.com/tfjs-models/savedmodel/posenet/resnet50/float/group1-shard1of23.bin';
function mirrorHarness({local='missing',remote='weights',remoteHook}={}){
 return harness({responses:{'/':'studio',[mirroredFile]:'weights'},mirrors:{[mirroredFile]:{url:officialMirror,bytes:7,sha256:hash('weights')}},fetchHook:async(url,options)=>{
  if(url===new URL(mirroredFile,origin).href)return local==='missing'?new Response('missing',{status:404}):new Response(local);
  if(url===officialMirror)return remoteHook?remoteHook(url,options):new Response(remote,{headers:{'Content-Type':'application/octet-stream','content-length':'7','content-encoding':'gzip'}});
 }});
}

test('online mirrored model GET restores missing local bytes from the exact CORS mirror and caches verified bytes',async()=>{
 const h=mirrorHarness();const result=await h.request(mirroredFile+'?model=pose');
 assert.equal(result.status,200);assert.equal(await result.text(),'weights');
 assert.equal(result.headers.has('content-encoding'),false);assert.equal(result.headers.has('content-length'),false);
 assert.deepEqual(h.requests.map(request=>request.url),[new URL(mirroredFile,origin).href,officialMirror]);
 assert.equal(h.requests[1].options.mode,'cors');assert.equal(h.requests[1].options.credentials,'omit');assert.equal(h.requests[1].options.redirect,'error');
 assert.equal(await (await h.cache.match(mirroredFile)).text(),'weights');
 await h.request(mirroredFile);assert.equal(h.requests.length,2,'Cached weights should not fetch again');
});

test('a valid local model never requests the external mirror',async()=>{
 const h=mirrorHarness({local:'weights'});assert.equal(await (await h.request(mirroredFile)).text(),'weights');
 assert.deepEqual(h.requests.map(request=>request.url),[new URL(mirroredFile,origin).href]);
});

test('preparation repairs invalid local model bytes from the pinned mirror without shrinking the complete pack',async()=>{
 const h=mirrorHarness({local:'WEIGHTS'});const result=await h.finished('PREPARE');
 assert.equal(result.type,'complete');assert.equal(result.files,2);assert.equal(result.bytes,13);
 assert.equal(await (await h.cache.match(mirroredFile)).text(),'weights');assert.equal((await h.finished('STATUS')).ready,true);
});

test('corrupt remote model cannot be returned or cached and preparation stays unready',async()=>{
 const h=mirrorHarness({remote:'WEIGHTS'});const result=await h.request(mirroredFile);
 assert.equal(result.status,503);assert.match(await result.text(),/verification/);assert.equal(await h.cache.match(mirroredFile),undefined);
 const preparation=await h.finished('PREPARE');assert.equal(preparation.type,'error');assert.equal((await h.finished('STATUS')).ready,false);
});

test('a denied CORS mirror fails closed without caching a response',async()=>{
 const h=mirrorHarness({remoteHook:()=>{throw new TypeError('Failed to fetch');}});
 assert.equal((await h.request(mirroredFile)).status,503);assert.equal(await h.cache.match(mirroredFile),undefined);
});

test('offline mode serves the restored mirrored model and never fetches an evicted model or external URL',async()=>{
 const h=mirrorHarness();await h.finished('PREPARE');await h.finished('SET_OFFLINE',{enabled:true});
 const count=h.requests.length;assert.equal(await (await h.request(mirroredFile)).text(),'weights');
 await h.cache.delete(mirroredFile);
 assert.equal((await h.request(mirroredFile)).status,503);assert.equal((await h.request(officialMirror)).status,503);
 assert.equal(h.requests.length,count);
 assert.equal((await h.finished('PREPARE')).type,'complete','Explicit repair is allowed to fetch even in offline mode');
 assert.equal((await h.finished('STATUS')).offline,true);assert.ok(h.requests.length>count);
});

test('turning offline mode on during a local miss prevents an external fallback',async()=>{
 const gate=deferred();let started=false;
 const h=harness({responses:{'/':'studio',[mirroredFile]:'weights'},mirrors:{[mirroredFile]:{url:officialMirror,bytes:7,sha256:hash('weights')}},fetchHook:async url=>{
  if(url===new URL(mirroredFile,origin).href){started=true;await gate.promise;return new Response('missing',{status:404});}
 }});
 const pending=h.request(mirroredFile);await tickUntil(()=>started);
 await h.cache.put('/__duetblox_offline_state__',new Response(JSON.stringify({ready:false,offline:true})));
 gate.resolve();assert.equal((await pending).status,503);assert.equal(h.requests.length,1);
});

test('offline build injects exactly the 23 pinned official shards and refuses changed or arbitrary mirror sources',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'duet-offline-build-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const directory of ['scripts','src/offline','dist/models/pose/resnet50'])await mkdir(path.join(root,directory),{recursive:true});
 await writeFile(path.join(root,'scripts/build-offline.mjs'),await readFile(new URL('../../scripts/build-offline.mjs',import.meta.url)));
 await writeFile(path.join(root,'src/offline/worker.js'),workerSource);await writeFile(path.join(root,'dist/index.html'),'studio');
 const files=Array.from({length:23},(_,index)=>({path:`pose/resnet50/group1-shard${index+1}of23.bin`,source:`https://storage.googleapis.com/tfjs-models/savedmodel/posenet/resnet50/float/group1-shard${index+1}of23.bin`,bytes:7,sha256:hash('weights')}));
 for(const file of files)await writeFile(path.join(root,'dist/models',file.path),'weights');
 const lock=path.join(root,'scripts/ml-models.lock.json');await writeFile(lock,JSON.stringify({files}));
 const build=()=>spawnSync(process.execPath,[path.join(root,'scripts/build-offline.mjs')],{encoding:'utf8'});
 let result=build();assert.equal(result.status,0,result.stderr);
 const generated=await readFile(path.join(root,'dist/sw.js'),'utf8');
 const mirrors=JSON.parse(generated.match(/const MIRRORS = (.+);/)[1]);assert.equal(Object.keys(mirrors).length,23);
 const pack=JSON.parse(await readFile(path.join(root,'dist/offline-manifest.json'),'utf8'));assert.equal(pack.files.length,25);assert.equal(pack.bytes,173);
 for(const file of files){const entry=mirrors[`/models/${file.path}`];assert.equal(entry.url,file.source);assert.equal(entry.bytes,7);assert.equal(entry.sha256,file.sha256);}
 files[0].source='https://untrusted.example/arbitrary';await writeFile(lock,JSON.stringify({files}));
 result=build();assert.notEqual(result.status,0);assert.match(result.stderr,/mirror differs from the verified build/);
 files[0].source=officialMirror;await writeFile(lock,JSON.stringify({files}));await writeFile(path.join(root,'dist/models',files[0].path),'changed');
 result=build();assert.notEqual(result.status,0);assert.match(result.stderr,/mirror differs from the verified build/);
});

test('offline preparation retries a transient HTTP 500 and stores only verified recovery bytes',async()=>{
 let attempts=0;const delays=[];
 const h=harness({scheduleTimeout:(fn,delay)=>{delays.push(delay);return setTimeout(fn,0);},fetchHook:async url=>{
  if(url.endsWith('/models/weights.bin')&&++attempts===1)return new Response('temporarily unavailable',{status:500});
 }});
 assert.equal((await h.finished('PREPARE')).type,'complete');assert.equal(attempts,2);assert.deepEqual(delays,[250]);
 assert.equal(await (await h.cache.match('/models/weights.bin')).text(),'weights');
 assert.ok(h.requests.filter(request=>request.url.endsWith('/models/weights.bin')).every(request=>request.options.signal instanceof AbortSignal));
});

test('transient HTTP failures stop after three attempts with bounded backoff and cannot mark the pack ready',async()=>{
 let attempts=0;const delays=[];
 const h=harness({scheduleTimeout:(fn,delay)=>{delays.push(delay);return setTimeout(fn,0);},fetchHook:async url=>{
  if(url.endsWith('/models/weights.bin')){attempts++;return new Response('temporarily unavailable',{status:503});}
 }});
 const result=await h.finished('PREPARE');assert.equal(result.type,'error');assert.match(result.message,/HTTP 503/);
 assert.equal(attempts,3);assert.deepEqual(delays,[250,750]);assert.equal(await h.cache.match('/models/weights.bin'),undefined);
 assert.equal((await h.finished('STATUS')).ready,false);
});

test('fetch network errors retry while 404 and integrity failures do not',async()=>{
 for(const kind of ['network','missing','integrity']){
  let attempts=0;
  const h=harness({scheduleTimeout:fn=>setTimeout(fn,0),fetchHook:async url=>{
   if(!url.endsWith('/models/weights.bin'))return;
   attempts++;if(kind==='network'&&attempts===1)throw new TypeError('Failed to fetch');
   if(kind==='missing')return new Response('missing',{status:404});
   if(kind==='integrity')return new Response('WEIGHTS');
  }});
  assert.equal((await h.finished('PREPARE')).type,kind==='network'?'complete':'error');
  assert.equal(attempts,kind==='network'?2:1);
 }
});

test('explicit offline policy is checked again before retrying an online mirrored request',async()=>{
 let retry;
 const h=harness({responses:{'/':'studio',[mirroredFile]:'weights'},mirrors:{[mirroredFile]:{url:officialMirror,bytes:7,sha256:hash('weights')}},
  scheduleTimeout:fn=>{retry=fn;},fetchHook:async()=>new Response('temporary failure',{status:500})});
 const pending=h.request(mirroredFile);await tickUntil(()=>retry);
 await h.cache.put('/__duetblox_offline_state__',new Response(JSON.stringify({ready:false,offline:true})));
 retry();assert.equal((await pending).status,503);assert.equal(h.requests.length,1);
 assert.equal(await h.cache.match(mirroredFile),undefined);
});

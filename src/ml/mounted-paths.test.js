import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// Exercise the same build-time import.meta.env substitution used by Vite.
// No application build or network requests are needed for these URL contracts.
async function mountedModule(relative,base){
 const result=await build({entryPoints:[fileURLToPath(new URL(relative,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify({BASE_URL:base,DEV:false})}});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const origin='https://duetpower.in';

test('all bundled ML checkpoints and relative weight files remain inside the root or mounted app',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../public/models/manifest.json',import.meta.url)));
 for(const base of ['/','/duetblox/']){
  const local=await mountedModule('./local-models.js',base);
  const paths=new Set(manifest.files.map(file=>`${base}models/${file.path}`));
  const checkpoints=[local.IMAGE_MODEL_OPTIONS.checkpointUrl,local.SOUND_MODEL_URL];
  assert.equal(local.IMAGE_MODEL_OPTIONS.checkpointUrl,`${base}models/image/mobilenet-v2-035/model.json`);
  assert.equal(local.SOUND_METADATA_URL,`${base}models/sound/speech-18w/metadata.json`);
  for(const multiplier of [.5,.75,1])for(const outputStride of [8,16])checkpoints.push(local.localPoseConfig({architecture:'MobileNetV1',multiplier,outputStride,inputResolution:257,modelUrl:'https://external.invalid/model.json'}).modelUrl);
  for(const outputStride of [16,32])checkpoints.push(local.localPoseConfig({architecture:'ResNet50',outputStride,inputResolution:513}).modelUrl);
  for(const path of checkpoints){
   assert.ok(paths.has(path),`Unbundled checkpoint: ${path}`);
   const relative=path.slice(`${base}models/`.length);
   const model=JSON.parse(await readFile(new URL(`../../public/models/${relative}`,import.meta.url)));
   for(const group of model.weightsManifest)for(const shard of group.paths){
    const resolved=new URL(shard,new URL(path,origin));
    assert.equal(resolved.origin,origin);
    assert.ok(paths.has(resolved.pathname),`Weight escaped its bundled folder: ${resolved.href}`);
   }
  }
 }
});

test('legacy sound metadata loader uses absolute URLs under the mounted app',async t=>{
 const {loadMetadataJson}=await import('@tensorflow-models/speech-commands/dist/browser_fft_utils.js');
 const metadata=JSON.parse(await readFile(new URL('../../public/models/sound/speech-18w/metadata.json',import.meta.url)));
 const requested=[];
 t.mock.method(globalThis,'fetch',async url=>{requested.push(url);return new Response(JSON.stringify(metadata));});
 for(const base of ['/','/duetblox/']){
  const local=await mountedModule('./local-models.js',base),urls=local.localSoundURLs(origin);
  assert.equal(urls.modelURL,`${origin}${base}models/sound/speech-18w/model.json`);
  assert.equal(urls.metadataURL,`${origin}${base}models/sound/speech-18w/metadata.json`);
  assert.deepEqual(await loadMetadataJson(urls.metadataURL),metadata);
  assert.equal(requested.at(-1),urls.metadataURL);
 }
});

test('external Teachable Machine model links retain their original origin and folder',async()=>{
 const {modelBaseURL}=await mountedModule('./validation.js','/duetblox/');
 assert.equal(modelBaseURL('https://teachablemachine.withgoogle.com/models/abc/model.json'),'https://teachablemachine.withgoogle.com/models/abc/');
 assert.equal(modelBaseURL('https://models.example.edu/classroom/model.json?view=1#example'),'https://models.example.edu/classroom/');
});

test('ResNet waits for this app worker and ignores a parent-site or foreign controller',async()=>{
 for(const base of ['/','/duetblox/']){
  const {ensurePoseAssets}=await mountedModule('./pose/ensure-assets.js',base);
  const sw=new EventTarget();let completed=false,registrations=0;
  sw.controller={scriptURL:`${origin}${base==='/'?'/main-site-worker.js':'/sw.js'}`};
  const pending=ensurePoseAssets({architecture:'ResNet50'},{secure:true,serviceWorker:sw,register:async()=>{registrations++;},origin,timeout:1000}).then(()=>{completed=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(registrations,1);assert.equal(completed,false);
  sw.controller={scriptURL:`https://foreign.example${base}sw.js`};
  sw.dispatchEvent(new Event('controllerchange'));
  await Promise.resolve();assert.equal(completed,false);
  sw.controller={scriptURL:`${origin}${base}sw.js`};
  sw.dispatchEvent(new Event('controllerchange'));
  await pending;assert.equal(completed,true);
 }
});

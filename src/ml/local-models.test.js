import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {IMAGE_MODEL_OPTIONS,SOUND_MODEL_URL,SOUND_METADATA_URL,localPoseConfig,localSoundURLs} from './local-models.js';

test('every supported pose configuration uses a pinned local checkpoint and ignores imported URLs',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../public/models/manifest.json',import.meta.url)));
  const paths=new Set(manifest.files.map(f=>'/models/'+f.path));
  for(const url of [IMAGE_MODEL_OPTIONS.checkpointUrl,SOUND_MODEL_URL,SOUND_METADATA_URL])assert.ok(paths.has(url));
  for(const multiplier of [.5,.75,1])for(const outputStride of [8,16]){
    const config=localPoseConfig({architecture:'MobileNetV1',multiplier,outputStride,inputResolution:257,modelUrl:'https://remote.example/model.json'});
    assert.ok(paths.has(config.modelUrl));assert.equal(config.quantBytes,4);assert.equal(config.multiplier,multiplier);
  }
  for(const outputStride of [16,32])assert.ok(paths.has(localPoseConfig({architecture:'ResNet50',outputStride,inputResolution:513}).modelUrl));
});

test('unsupported pose checkpoints fail explicitly instead of fetching a remote fallback',()=>{
  const valid={architecture:'MobileNetV1',multiplier:.75,outputStride:16,inputResolution:257};
  for(const patch of [{architecture:'../../network'},{multiplier:.25},{outputStride:32},{inputResolution:128},{inputResolution:514},{inputResolution:NaN},{inputResolution:257.5}])assert.throws(()=>localPoseConfig({...valid,...patch}));
  assert.throws(()=>localPoseConfig({...valid,architecture:'ResNet50'}));
  assert.throws(()=>localPoseConfig({...valid,architecture:'ResNet50',multiplier:1,outputStride:8}));
});

test('model manifests only reference included relative shards',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../public/models/manifest.json',import.meta.url)));
  const paths=new Set(manifest.files.map(f=>f.path));
  for(const model of manifest.models){
    const data=JSON.parse(await readFile(new URL('../../public/models/'+model.path,import.meta.url)));
    for(const group of data.weightsManifest)for(const shard of group.paths){
      assert.match(shard,/^[A-Za-z0-9._-]+$/);
      assert.ok(paths.has(model.path.slice(0,model.path.lastIndexOf('/')+1)+shard),`${model.id}: ${shard}`);
    }
  }
});


test('legacy speech metadata loader accepts the same-origin absolute URLs used for local training',async t=>{
  const {loadMetadataJson}=await import('@tensorflow-models/speech-commands/dist/browser_fft_utils.js');
  const metadata=JSON.parse(await readFile(new URL('../../public/models/sound/speech-18w/metadata.json',import.meta.url)));
  let requested;
  t.mock.method(globalThis,'fetch',async url=>{requested=url;return new Response(JSON.stringify(metadata),{headers:{'Content-Type':'application/json'}});});
  // Reproduce the actual 0.4.0 parser failure that browser QA found.
  await assert.rejects(()=>loadMetadataJson(SOUND_METADATA_URL),/Unsupported URL scheme/);
  for(const origin of ['http://127.0.0.1:5173','https://duetblox.test']){
    const urls=localSoundURLs(origin);
    assert.equal(new URL(urls.modelURL).origin,origin);
    assert.equal(new URL(urls.metadataURL).origin,origin);
    assert.deepEqual(await loadMetadataJson(urls.metadataURL),metadata);
    assert.equal(requested,origin+SOUND_METADATA_URL);
  }
});

test('local sound URL resolution rejects non-app schemes, credentials and non-origin input',()=>{
  for(const origin of [undefined,'null','file:///tmp/duetblox','javascript:alert(1)','https://user:secret@example.org','https://example.org/path','https://example.org/?x=1','https://example.org/#fragment'])assert.throws(()=>localSoundURLs(origin));
});

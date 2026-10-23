import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensurePoseAssets} from './pose/ensure-assets.js';
const origin='https://duetblox.test';
const appWorker=()=>({scriptURL:`${origin}/sw.js`});
test('normal pose training does not wait for worker registration',async()=>{
 await ensurePoseAssets({architecture:'MobileNetV1'},{secure:true,serviceWorker:{},register:()=>{throw Error('Unexpected registration');}});
});
test('ResNet waits for worker control before requesting weights',async()=>{
 const sw=new EventTarget();let done=false;
 const pending=ensurePoseAssets({architecture:'ResNet50'},{secure:true,serviceWorker:sw,register:async()=>{},timeout:1000,origin}).then(()=>{done=true;});
 await Promise.resolve();assert.equal(done,false);sw.controller=appWorker();sw.dispatchEvent(new Event('controllerchange'));await pending;assert.equal(done,true);
});
test('a controlled page can load ResNet immediately',async()=>{
 await ensurePoseAssets({architecture:'ResNet50'},{secure:true,serviceWorker:{controller:appWorker()},register:async()=>{},origin});
});
test('missing worker control is bounded and explains how to retry',async()=>{
 await assert.rejects(ensurePoseAssets({architecture:'ResNet50'},{secure:true,serviceWorker:new EventTarget(),register:async()=>{},timeout:2,origin}),/Reload DUETBlox/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceDatasetWithRecovery,importErrorMessage} from './dataset-recovery.js';
const old={kind:'duetblox-text-dataset',version:1,classes:[{id:'a',name:'My class',samples:['my sentence']}]};
function service(){return {dataset:structuredClone(old),epoch:0,operation:null,beginOperation(){if(this.operation)throw Error('Busy');this.operation=Symbol();this.epoch++;return this.operation;},endOperation(token){if(this.operation===token)this.operation=null;}};}
test('replacement writes working and recoverable datasets atomically while locked',async()=>{
  const model=service(),next={...structuredClone(old),classes:[]};let persisted;
  await replaceDatasetWithRecovery({kind:'text',service:model,load:async()=>next,write:async entries=>{assert.throws(()=>model.beginOperation(),/Busy/);assert.deepEqual(model.dataset,old);persisted=entries;},apply:data=>{assert.ok(model.operation);model.dataset=data;}});
  assert.deepEqual(persisted[0],['text-dataset',next]);assert.equal(persisted[1][0],'text-dataset-recovery');assert.deepEqual(persisted[1][1].dataset,old);assert.equal(model.dataset,next);assert.equal(model.operation,null);
});
test('failed validation and failed storage preserve current dataset and prior recovery',async()=>{
  for(const phase of ['load','write']){const model=service();let applied=false,writes=0;
    await assert.rejects(replaceDatasetWithRecovery({kind:'text',service:model,load:async()=>{if(phase==='load')throw new SyntaxError('Bad JSON');return {};},write:async()=>{writes++;throw Error('Quota reached');},apply:()=>{applied=true;}}));
    assert.equal(applied,false);assert.deepEqual(model.dataset,old);assert.equal(model.operation,null);assert.equal(writes,phase==='write'?1:0);
  }
});
test('restore writes previous data and clears recovery in the same transaction',async()=>{
  const model=service();let entries;
  await replaceDatasetWithRecovery({kind:'text',service:model,recover:false,load:async()=>old,write:async value=>{entries=value;},apply:data=>{model.dataset=data;}});
  assert.deepEqual(entries,[['text-dataset',old],['text-dataset-recovery',null]]);
});
test('a loader invalidated by disposal never changes persistent datasets',async()=>{
  const model=service();let current=true,writes=0,applies=0,finish;const pending=new Promise(resolve=>{finish=resolve;});
  const result=replaceDatasetWithRecovery({kind:'text',service:model,isCurrent:()=>current,load:()=>pending,write:async()=>{writes++;},apply:()=>{applies++;}});
  current=false;finish({});assert.equal(await result,false);assert.equal(writes,0);assert.equal(applies,0);assert.equal(model.operation,null);
});
test('malformed JSON has an actionable message without raw syntax details',()=>{
  assert.match(importErrorMessage(new SyntaxError('Unexpected token secret, line 1')),/not valid JSON/);assert.doesNotMatch(importErrorMessage(new SyntaxError('secret')),/secret/);assert.equal(importErrorMessage(new Error('Choose a smaller file.')),'Choose a smaller file.');
});

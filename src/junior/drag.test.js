import test from 'node:test';
import assert from 'node:assert/strict';
import {readJuniorDrag, writeJuniorDrag, moveJuniorBlockToGap, JUNIOR_DRAG_TYPE} from './drag.js';

test('a drag can move to the beginning, middle and end without losing nested blocks', () => {
  const nested = {id:'b', children:[{id:'inside'}]};
  const blocks=[{id:'a'},nested,{id:'c'},{id:'d'}];
  assert.deepEqual(moveJuniorBlockToGap(blocks,'a',3).map(b=>b.id),['b','c','a','d']);
  assert.deepEqual(moveJuniorBlockToGap(blocks,'a',4).map(b=>b.id),['b','c','d','a']);
  const moved=moveJuniorBlockToGap(blocks,'b',0);
  assert.deepEqual(moved.map(b=>b.id),['b','a','c','d']);
  assert.equal(moved[0],nested);
  assert.deepEqual(blocks.map(b=>b.id),['a','b','c','d']);
});

test('adjacent gaps, stale IDs and invalid gaps are harmless', () => {
  const blocks=[{id:'a'},{id:'b'}];
  for(const [id,gap] of [['a',0],['a',1],['missing',2],['a',-1],['a',3],['a',NaN],['a',0.5]])assert.equal(moveJuniorBlockToGap(blocks,id,gap),blocks);
});

test('only validated Junior payloads are accepted; ordinary text and files are ignored', () => {
  const transfer={data:new Map(),setData(type,data){this.data.set(type,data);},getData(type){return this.data.get(type)||'';}};
  transfer.setData('text/plain','move');
  assert.equal(readJuniorDrag(transfer),null);
  writeJuniorDrag(transfer,{kind:'palette',type:'right'});
  assert.deepEqual(readJuniorDrag(transfer),{kind:'palette',type:'right'});
  assert.equal(transfer.effectAllowed,'copy');
  writeJuniorDrag(transfer,{kind:'block',id:'a',scriptId:'s'});
  assert.deepEqual(readJuniorDrag(transfer),{kind:'block',id:'a',scriptId:'s'});
  assert.equal(transfer.effectAllowed,'move');
  for(const bad of ['not JSON','null','{"kind":"palette","type":"__proto__"}','{"kind":"block","id":"a"}',JSON.stringify({kind:'palette',type:'x'.repeat(600)})]){
    transfer.setData(JUNIOR_DRAG_TYPE,bad);assert.equal(readJuniorDrag(transfer),null);
  }
});

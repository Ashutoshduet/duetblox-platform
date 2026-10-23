import test from 'node:test';import assert from 'node:assert/strict';
import {dataListRpc as call,parseDataList} from './data-lists.js';
test('nested data survives independent Scratch-style value operations without mutation',()=>{
 const row=call('pair',[21,22]),table=call('pair',[row,'[23,24]']);assert.equal(table,'[[21,22],[23,24]]');
 assert.equal(call('item',[call('item',[table,2]),1]),23);
 const next=call('replace',[table,1,'[30,31]']);assert.equal(next,'[[30,31],[23,24]]');assert.equal(table,'[[21,22],[23,24]]');
 assert.equal(call('length',[table]),2);assert.equal(call('append',[row,'hello']),'[21,22,"hello"]');assert.equal(call('remove',[row,1]),'[22]');assert.equal(call('slice',['[1,2,3]',2,3]),'[2,3]');
});
test('data lists reject invalid indices, objects, excessive size and depth without eval',()=>{
 for(const text of ['[Infinity]','{"a":1}','[{}]','alert(1)','['.repeat(13)+'0'+']'.repeat(13),JSON.stringify(Array(2001).fill(1))])assert.throws(()=>parseDataList(text));
 for(const index of [0,-1,1.5,3,'x'])assert.throws(()=>call('item',['[1,2]',index]));
 assert.throws(()=>call('slice',['[1,2]',2,1]),/last item/);assert.throws(()=>call('fromJSON',['["'+ 'x'.repeat(24000)+'"]']),/JSON/);
 assert.equal(call('fromJSON',['[true,null,"नमस्ते"]']),'[true,null,"नमस्ते"]');
});

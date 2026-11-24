import test from 'node:test';
import assert from 'node:assert/strict';
import {makeJuniorProject,parseJuniorProject,serializeJuniorProject,compileJuniorProject,copyJuniorScript} from './model.js';
import {normalizeJuniorScriptPosition,moveJuniorScriptPosition,JUNIOR_CANVAS_LIMIT} from './script-layout.js';

test('optional canvas positions survive a v2 project round trip without changing legacy projects',()=>{
  const old=makeJuniorProject();
  assert.equal(parseJuniorProject(serializeJuniorProject(old)).scenes[0].sprites[0].scripts[0].canvas,undefined);
  old.scenes[0].sprites[0].scripts[0].canvas={x:163,y:72};
  assert.deepEqual(parseJuniorProject(serializeJuniorProject(old)).scenes[0].sprites[0].scripts[0].canvas,{x:163,y:72});
});
test('untrusted positions cannot create unbounded, negative or invalid canvas geometry',()=>{
  assert.equal(normalizeJuniorScriptPosition({x:'40',y:3}),null);
  assert.equal(normalizeJuniorScriptPosition({x:Infinity,y:0}),null);
  assert.equal(normalizeJuniorScriptPosition(null),null);
  assert.deepEqual(normalizeJuniorScriptPosition({x:-10,y:1e10}),{x:0,y:JUNIOR_CANVAS_LIMIT});
  assert.deepEqual(moveJuniorScriptPosition({x:4,y:5},-20,2.6),{x:0,y:8});
});
test('moving a stack never changes compiled execution, events or source blocks',()=>{
  const project=makeJuniorProject(),before=compileJuniorProject(project);
  project.scenes[0].sprites[0].scripts[0].canvas={x:290,y:105};
  assert.deepEqual(compileJuniorProject(project),before);
});
test('a copied stack receives independent IDs and a visible offset',()=>{
  const script=makeJuniorProject().scenes[0].sprites[0].scripts[0];script.canvas={x:70,y:30};
  const copy=copyJuniorScript(script);
  assert.deepEqual(copy.canvas,{x:94,y:54});assert.deepEqual(script.canvas,{x:70,y:30});
  assert.notEqual(copy.id,script.id);assert.notEqual(copy.blocks[0].id,script.blocks[0].id);
});

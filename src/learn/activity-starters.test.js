import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonScratch, timesTableStarter, ACTIVITY_STARTERS,trafficCircuit,decisionStory} from './activity-starters.js';
import {solveCircuit} from '../circuits/solver.js';
import {compileJuniorProject} from '../junior/model.js';
import {LESSONS} from './lessons.js';
import {exportArduino} from '../hardware/generator.js';
const base={targets:[{isStage:true,name:'Stage',variables:{old:['old',8]},blocks:{old:{opcode:'event_whenflagclicked'}},costumes:[]},{isStage:false,name:'Old hardware',blocks:{old:{opcode:'duetHardware_digitalWrite'}},costumes:[{name:'Fox',assetId:'kept',md5ext:'kept.svg'}]}],extensions:['duetHardware']};
test('lesson projects isolate old event scripts and preserve costume assets without mutating source',()=>{
  const saved=structuredClone(base);
  for(const kind of ['motion','catch','quiz','pen','music','blink','sensor','button','traffic']){
    const {project}=lessonScratch(base,kind);
    assert.equal(project.targets.length,2);assert.equal(project.targets[0].isStage,true);
    assert.deepEqual(project.targets[1].costumes,saved.targets[1].costumes);
    assert.equal(project.targets[0].variables.old,undefined);assert.equal(project.targets[1].blocks.old,undefined);
    for(const target of project.targets)for(const [id,block] of Object.entries(target.blocks)){
      if(block.parent)assert.ok(target.blocks[block.parent],`${kind}:${id} parent`);
      if(block.next)assert.equal(target.blocks[block.next].parent,id,`${kind}:${id} next`);
      for(const input of Object.values(block.inputs))if(typeof input[1]==='string')assert.ok(target.blocks[input[1]],`${kind}:${id} input`);
    }
  }
  assert.deepEqual(base,saved);
});
test('hardware lesson programs generate supported code and reject incompatible profiles',()=>{
  for(const kind of ['blink','sensor','traffic']){
    const result=exportArduino(lessonScratch(base,kind).project,{boardId:'arduino-uno'});
    assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  }
  assert.throws(()=>lessonScratch(base,'sensor','esp32-cam'),/no analog/);
  assert.throws(()=>lessonScratch(base,'traffic','esp32-cam'),/pins 13, 12 and 11/);
  assert.throws(()=>lessonScratch(base,'invented'),/not available/);
});
test('starter links point at real lessons and Python activity is ready for independent input',()=>{
  for(const id of Object.keys(ACTIVITY_STARTERS))assert.ok(LESSONS.some(lesson=>lesson.id===id),id);
  const python=timesTableStarter();assert.equal(python.input,'7');assert.match(python.code,/range\(1, 11\)/);
});

test('traffic wiring lights only the driven branch and decisions compile to both key branches',()=>{
  const circuit=trafficCircuit();
  for(let lit=0;lit<3;lit++){
    const result=solveCircuit(circuit,{pins:[13,12,11].map((pin,i)=>({pin,mode:'OUTPUT',kind:'digital',value:i===lit?1:0}))});
    assert.equal(result.safe,true);for(let i=0;i<3;i++)assert.equal(result.components[`trafficLED${i}`].lit,i===lit);
  }
  const compiled=compileJuniorProject(decisionStory());
  const blocks=compiled.project.targets.flatMap(target=>Object.values(target.blocks));
  assert.ok(blocks.some(b=>b.opcode==='control_if_else'));assert.ok(blocks.some(b=>b.opcode==='sensing_keypressed'));
});

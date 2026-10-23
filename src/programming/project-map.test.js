import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectMap} from './project-map.js';
const fixture = () => ({targets:[{isStage:true,name:'Stage',blocks:{}},{name:'Fox',blocks:{
  flag:{opcode:'event_whenflagclicked',topLevel:true,next:'repeat'},
  repeat:{opcode:'control_repeat',next:null,inputs:{SUBSTACK:[2,'set'],TIMES:[1,[4,'3']]}},
  set:{opcode:'data_setvariableto',fields:{VARIABLE:['score','v']},inputs:{VALUE:[1,[10,'Found treasure']]}},
  unused:{opcode:'looks_say',topLevel:true,inputs:{MESSAGE:[1,[10,'Hello']]}}
}}]});
test('project map finds nested field values without executing a program',()=>{
  const result=projectMap(fixture(),'treasure'); assert.equal(result.scriptCount,2);assert.equal(result.blockCount,4);assert.equal(result.spriteCount,1);
  assert.equal(result.matches.length,1);assert.equal(result.matches[0].id,'flag');assert.equal(result.matches[0].blockCount,3);
  assert.equal(projectMap(fixture(),' SCORE ').matches[0].id,'flag');
});
test('project map handles shared references, cycles and missing blocks without duplicate counts',()=>{
  const p=fixture();p.targets[1].blocks.set.next='repeat';p.targets[1].blocks.repeat.inputs.EXTRA=[2,'set'];p.targets[1].blocks.repeat.inputs.MISSING=[2,'absent'];
  const result=projectMap(p,'score');assert.equal(result.matches[0].blockCount,3);assert.equal(result.truncated,false);
});
test('shadow reporters do not become scripts; Unicode searches and empty programs work',()=>{
  const p=fixture();p.targets[1].name='लोमड़ी';p.targets[1].blocks.shadow={opcode:'math_number',shadow:true,topLevel:true,fields:{NUM:['42',null]}};
  assert.equal(projectMap(p,'लोमड़ी').matches.length,2);assert.equal(projectMap(p).scriptCount,2);assert.deepEqual(projectMap(null).matches,[]);
});
test('large script lists have explicit bounded display and coverage',()=>{
  const p={targets:[{name:'Many',blocks:Object.fromEntries(Array.from({length:510},(_,i)=>[String(i),{opcode:'looks_say',topLevel:true}]))}]};
  const result=projectMap(p);assert.equal(result.matches.length,100);assert.equal(result.scriptCount,500);assert.equal(result.truncated,true);
});
test('My Block definition titles come from their linked prototype, including no-input names',()=>{
  const p={targets:[{name:'Fox',blocks:{
    definition:{opcode:'procedures_definition',topLevel:true,next:'body',inputs:{custom_block:[1,'prototype']}},
    prototype:{opcode:'procedures_prototype',shadow:true,mutation:{proccode:'Celebrate'}},
    body:{opcode:'procedures_call',mutation:{proccode:'Other %s'},inputs:{TEXT:[1,[10,'100% ready']]}}
  }}]};
  const map=projectMap(p);
  assert.equal(map.matches[0].title,'Define Celebrate');
  assert.equal(projectMap(p,'celebrate').matches[0].id,'definition');
  p.targets[0].blocks.prototype.mutation.proccode='Walk %s steps if %b';
  assert.equal(projectMap(p).matches[0].title,'Define Walk %s steps if %b');
});
test('missing or invalid prototypes never borrow a definition name from body text',()=>{
  const p={targets:[{name:'Fox',blocks:{
    definition:{opcode:'procedures_definition',topLevel:true,next:'body',inputs:{custom_block:[1,'missing']}},
    body:{opcode:'looks_say',inputs:{MESSAGE:[1,[10,'100% ready']]},mutation:{proccode:'Not the definition %s'}}
  }}]};
  assert.equal(projectMap(p).matches[0].title,'Define My Block');
  p.targets[0].blocks.definition.inputs.custom_block=[1,'body'];
  assert.equal(projectMap(p).matches[0].title,'Define My Block');
  p.targets[0].blocks.body.opcode='procedures_prototype';
  p.targets[0].blocks.body.mutation.proccode='A'.repeat(250);
  assert.equal(projectMap(p).matches[0].title,`Define ${'A'.repeat(100)}`);
});

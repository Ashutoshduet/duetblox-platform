import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPythonProject,validatePythonProject,inputLines,pythonFilename,MAX_CODE_LENGTH,MAX_INPUT_LENGTH} from './project.js';
import {PythonRunner,OUTPUT_LIMIT} from './runner.js';

test('Python projects validate bounded source and preserve Unicode input without executable metadata',()=>{
  const project={...defaultPythonProject(),code:'print("नमस्ते")',input:'छात्र\n',name:'../../नया.py',extra:'discard'};
  const checked=validatePythonProject(project);assert.equal(checked.code,project.code);assert.equal(checked.name,'नया.py');assert.equal(checked.extra,undefined);
  for(const patch of [{version:2},{kind:'script'},{code:null},{input:[]},{code:'\0'},{input:'\0'},{code:'x'.repeat(MAX_CODE_LENGTH+1)},{input:'x'.repeat(MAX_INPUT_LENGTH+1)}])assert.throws(()=>validatePythonProject({...project,...patch}));
});
test('input lines preserve intentional empty answers and handle platform line endings',()=>{
  assert.deepEqual(inputLines(''),[]);assert.deepEqual(inputLines('\n'),['']);assert.deepEqual(inputLines('a\r\nb\rc\n'),['a','b','c']);assert.deepEqual(inputLines('a\n\n'),['a','']);assert.equal(pythonFilename('test'),'test.py');
});

function harness(options={}){
  const workers=[],states=[];
  const runner=new PythonRunner({...options,onChange:state=>states.push(state),workerFactory:()=>{const worker={terminated:false,postMessage(data){this.sent=data;},terminate(){this.terminated=true;},send(data){this.onmessage({data:{id:this.sent.id,...data}});}};workers.push(worker);return worker;}});
  return {runner,workers,states};
}
test('fresh worker per run, output separation, and no stale results after Stop',()=>{
  const {runner,workers}=harness();runner.run(defaultPythonProject());const first=workers[0];assert.equal(runner.state.status,'loading');first.send({type:'running'});first.send({type:'output',stream:'stdout',text:'hello'});first.send({type:'output',stream:'stderr',text:'warning'});assert.equal(runner.state.output.length,2);
  runner.stop();assert.equal(first.terminated,true);assert.equal(runner.state.status,'stopped');runner.run(defaultPythonProject());first.send({type:'done'});assert.equal(runner.state.status,'loading');assert.equal(workers.length,2);assert.equal(runner.state.output.length,0);workers[1].send({type:'done',elapsed:42});assert.equal(runner.state.status,'completed');assert.equal(runner.state.elapsed,42);assert.equal(workers[1].terminated,true);runner.dispose();
});
test('output flood terminates execution and bounds displayed data',()=>{
  const {runner,workers}=harness();runner.run(defaultPythonProject());workers[0].send({type:'output',text:'a'.repeat(OUTPUT_LIMIT+100)});assert.equal(runner.state.characters,OUTPUT_LIMIT);assert.equal(runner.state.status,'limit');assert.equal(workers[0].terminated,true);runner.dispose();
});
test('execution timeout terminates synchronous infinite loop worker without waiting for a response',async()=>{
  const {runner,workers}=harness({runTimeout:10});runner.run(defaultPythonProject());workers[0].send({type:'running'});await new Promise(resolve=>setTimeout(resolve,25));assert.equal(runner.state.status,'timeout');assert.equal(workers[0].terminated,true);runner.dispose();
});
test('runtime load timeout and worker failure can recover on the next run',async()=>{
  const {runner,workers}=harness({loadTimeout:10});runner.run(defaultPythonProject());await new Promise(resolve=>setTimeout(resolve,25));assert.equal(runner.state.status,'error');assert.equal(workers[0].terminated,true);runner.run(defaultPythonProject());workers[1].onerror({preventDefault(){}});assert.equal(workers[1].terminated,true);runner.run(defaultPythonProject());runner.dispose();assert.equal(workers[2].terminated,true);assert.throws(()=>runner.run(defaultPythonProject()),/closed/);
});
test('invalid source and double runs never create extra workers',()=>{
  const {runner,workers}=harness();assert.throws(()=>runner.run({}));assert.equal(workers.length,0);runner.run(defaultPythonProject());assert.throws(()=>runner.run(defaultPythonProject()),/already/);assert.throws(()=>runner.clear(),/Stop/);assert.equal(workers.length,1);runner.stop();runner.clear();assert.equal(runner.state.status,'idle');runner.dispose();
});

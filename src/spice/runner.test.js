import test from 'node:test';
import assert from 'node:assert/strict';
import {SpiceRunner} from './runner.js';
import {SPICE_EXAMPLES} from './model.js';
const code=SPICE_EXAMPLES[0].netlist;
function setup(timeoutMs=1000,retryDelayMs=10){const workers=[],states=[];const runner=new SpiceRunner({timeoutMs,retryDelayMs,onChange:state=>states.push(state),createWorker:()=>{const worker={terminated:false,terminate(){this.terminated=true},postMessage(message){this.sent=message}};workers.push(worker);return worker;}});return {runner,workers,states};}
test('Stop terminates actual worker and ignores any late result',()=>{
  const {runner,workers}=setup();runner.run(code);const worker=workers[0];runner.stop();worker.onmessage({data:{id:worker.sent.id,type:'done',result:{points:1},elapsed:1}});assert.equal(worker.terminated,true);assert.equal(runner.state.status,'stopped');assert.equal(runner.state.result,null);runner.dispose();
});
test('new runs terminate predecessors and do not inherit stale solver results',()=>{
  const {runner,workers}=setup();runner.run(code);const first=workers[0];runner.run(code);assert.equal(first.terminated,true);first.onmessage({data:{id:first.sent.id,type:'error',message:'stale'}});assert.equal(runner.state.status,'loading');const current=workers[1];current.onmessage({data:{id:current.sent.id,type:'done',result:{points:2},elapsed:5}});assert.equal(runner.state.status,'completed');assert.equal(current.terminated,true);runner.dispose();
});
test('invalid imports do not construct a worker and recovery is possible',()=>{
  const {runner,workers}=setup();runner.run('Invalid\n.include file\n.end');assert.equal(workers.length,0);assert.equal(runner.state.status,'error');runner.run(code);assert.equal(workers.length,1);assert.equal(runner.state.status,'loading');runner.dispose();
});
test('timeout ends a nonresponding solver and next Run remains usable',async()=>{
  const {runner,workers}=setup(20);runner.run(code);await new Promise(resolve=>setTimeout(resolve,45));assert.equal(runner.state.status,'timeout');assert.equal(workers[0].terminated,true);runner.run(code);assert.equal(runner.state.status,'loading');runner.dispose();
});
test('worker failure after startup resets state and retains a useful error log',()=>{
  const {runner,workers}=setup();runner.run(code);workers[0].onmessage({data:{id:workers[0].sent.id,type:'loading',message:'Starting WASM'}});workers[0].onerror({message:'WASM load failed',preventDefault(){}});assert.equal(runner.state.status,'error');assert.match(runner.state.log,/WASM/);assert.equal(workers[0].terminated,true);runner.dispose();
});

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
test('an interrupted worker download retries once and ignores late messages from its predecessor', async () => {
  const {runner,workers}=setup();runner.run(code);const first=workers[0];
  first.onerror({message:'Network interrupted',preventDefault(){}});
  assert.equal(first.terminated,true);assert.equal(runner.state.status,'loading');assert.match(runner.state.message,/Retrying once/);
  await wait(25);assert.equal(workers.length,2);
  first.onmessage({data:{id:first.sent.id,type:'error',message:'stale'}});assert.equal(runner.state.status,'loading');
  const second=workers[1];second.onmessage({data:{id:second.sent.id,type:'done',result:{points:3},elapsed:5}});
  assert.equal(runner.state.status,'completed');assert.equal(second.terminated,true);runner.dispose();
});
test('a second startup failure ends with loading guidance and no further retry',async()=>{
  const {runner,workers}=setup();runner.run(code);workers[0].onerror({});await wait(25);
  workers[1].onerror({});await wait(25);assert.equal(workers.length,2);assert.equal(runner.state.status,'error');
  assert.match(runner.state.message,/could not start after one retry/);assert.match(runner.state.message,/connection or offline pack/);runner.dispose();
});
test('posted simulation errors never trigger a startup retry',async()=>{
  const {runner,workers}=setup();runner.run(code);const worker=workers[0];
  worker.onmessage({data:{id:worker.sent.id,type:'error',message:'Convergence failed'}});await wait(25);
  assert.equal(workers.length,1);assert.equal(runner.state.message,'Convergence failed');runner.dispose();
});
for(const action of ['stop','dispose'])test(`${action} cancels a scheduled startup retry`,async()=>{
  const {runner,workers,states}=setup();runner.run(code);workers[0].onerror({});runner[action]();const count=states.length;
  await wait(25);assert.equal(workers.length,1);assert.equal(states.length,count);assert.equal(runner.retryTimer,null);
  if(action==='stop')assert.equal(runner.state.status,'stopped');runner.dispose();
});
test('the original deadline can cancel a scheduled retry before a second worker is created',async()=>{
  const {runner,workers}=setup(15,50);runner.run(code);workers[0].onerror({});await wait(70);
  assert.equal(runner.state.status,'timeout');assert.equal(workers.length,1);assert.equal(runner.retryTimer,null);runner.dispose();
});
test('a replacement run cancels an older scheduled startup retry',async()=>{
  const {runner,workers}=setup();runner.run(code);workers[0].onerror({});runner.run(code);await wait(25);
  assert.equal(workers.length,2);assert.equal(runner.state.status,'loading');runner.dispose();
});

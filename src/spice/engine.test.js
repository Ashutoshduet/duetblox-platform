import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {SPICE_EXAMPLES} from './model.js';
const simulate=id=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./engine-probe.mjs',import.meta.url),{workerData:{netlist:SPICE_EXAMPLES.find(example=>example.id===id).netlist}});
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Real ngspice run timed out'));},20000);
  worker.once('message',message=>{clearTimeout(timer);worker.terminate();message.error?reject(new Error(message.error)):resolve(message);});
  worker.once('error',error=>{clearTimeout(timer);worker.terminate();reject(error);});
});
const signal=(result,name)=>{const found=result.signals.find(item=>item.name===name);assert.ok(found,`${name} exists`);return found;};

test('real ngspice operating point solves voltage divider and Kirchhoff current',async()=>{
  const {result,errors,log}=await simulate('divider');assert.deepEqual(errors,[]);assert.equal(result.points,1);assert.equal(signal(result,'v(out)').real[0],2.5);assert.equal(signal(result,'i(v1)').real[0],-.0025);assert.match(log,/No. of Data Rows/);
});
test('real ngspice RC transient matches the analytic charging curve',async()=>{
  const {result}=await simulate('rc'),voltage=signal(result,'v(out)').real,time=result.axis.values;
  assert.ok(time.length>100);
  for(const target of [.001,.003,.005]){let index=0;for(let i=1;i<time.length;i++)if(Math.abs(time[i]-target)<Math.abs(time[index]-target))index=i;const expected=5*(1-Math.exp(-time[index]/.001));assert.ok(Math.abs(voltage[index]-expected)<.02,`t=${time[index]} actual ${voltage[index]} vs ${expected}`);}
});
test('real ngspice AC response matches complex RC transfer function',async()=>{
  const {result}=await simulate('filter'),output=signal(result,'v(out)');assert.equal(result.complex,true);
  for(const index of [0,80,result.points-1]){const w=2*Math.PI*result.axis.values[index]*.001,real=1/(1+w*w),imaginary=-w/(1+w*w);assert.ok(Math.abs(output.real[index]-real)<1e-7);assert.ok(Math.abs(output.imaginary[index]-imaginary)<1e-7);}
});
test('real ngspice diode, BJT and RLC examples produce nonlinear and dynamic measurements',async()=>{
  const diode=(await simulate('diode')).result,anode=signal(diode,'v(anode)').real;assert.ok(anode.at(-1)>.4&&anode.at(-1)<1);
  const transistor=(await simulate('transistor')).result,collector=signal(transistor,'v(collector)').real;assert.ok(collector[0]>4.9);assert.ok(collector.at(-1)<.2);
  const rlc=(await simulate('rlc')).result,voltage=signal(rlc,'v(out)').real;assert.ok(Math.max(...voltage)>5.1);assert.ok(Math.abs(voltage.at(-1)-5)<.4);
});

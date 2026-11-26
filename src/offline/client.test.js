import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('./client.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'').replaceAll('export ','').replace('import.meta.env?.DEV','false');
function harness(controller){
 const calls=[],owned={scriptURL:'https://example.test/duetblox/sw.js'};
 const context={URL,location:{origin:'https://example.test'},navigator:{serviceWorker:{controller,register:async(...args)=>{calls.push(args);return {active:owned};}}},window:{isSecureContext:true},appPath:p=>'/duetblox/'+p,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);return {context,calls,owned};
}
test('mounted offline commands select their own worker and never the main website controller',async()=>{
 const main={scriptURL:'https://example.test/sw.js'};const h=harness(main);
 assert.equal(h.context.isAppWorker(main),false);
 assert.equal(await h.context.offlineWorker(),h.owned);
 assert.equal(h.calls[0][0],'/duetblox/sw.js');assert.equal(h.calls[0][1].scope,'/duetblox/');
});
test('an already owned controller is reused while an update is registered only inside app scope',async()=>{
 const worker={scriptURL:'https://example.test/duetblox/sw.js'};const h=harness(worker);
 assert.equal(await h.context.offlineWorker(),worker);
 assert.equal(h.calls[0][0],'/duetblox/sw.js');assert.equal(h.calls[0][1].scope,'/duetblox/');
 for(const scriptURL of ['https://other.test/duetblox/sw.js','https://example.test/duetblox-other/sw.js','https://example.test/sw.js'])assert.equal(h.context.isAppWorker({scriptURL}),false);
});

function commandHarness(){
 let now=0,nextId=0;const timers=new Map(),channels=[],commands=[];
 const worker={scriptURL:'https://example.test/duetblox/sw.js',postMessage:(message,ports)=>commands.push({message,port:ports[0]})};
 const h=harness(worker);
 h.context.setTimeout=(callback,delay)=>{const id=++nextId;timers.set(id,{callback,at:now+delay});return id;};
 h.context.clearTimeout=id=>timers.delete(id);
 h.context.MessageChannel=class{
  constructor(){
   this.port1={onmessage:null,closed:false,close(){this.closed=true;}};
   this.port2={postMessage:message=>{if(!this.port1.closed)this.port1.onmessage?.({data:message});}};
   channels.push(this);
  }
 };
 const advance=async milliseconds=>{
  const target=now+milliseconds;
  while(true){
   const next=[...timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!next)break;
   now=next[1].at;timers.delete(next[0]);next[1].callback();await Promise.resolve();
  }
  now=target;await Promise.resolve();
 };
 return {...h,timers,channels,commands,advance,send:message=>commands[0].port.postMessage(message)};
}

for(const terminal of ['error','cancelled'])test(`unchanged verified totals renew the 90-second wait until ${terminal}, then release the timer and port`,async()=>{
 const h=commandHarness(),progress=[];
 const pending=h.context.offlineCommand('PREPARE',{},message=>progress.push(message));
 let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
 await Promise.resolve();assert.equal(h.commands.length,1);assert.equal(h.commands[0].message.type,'PREPARE');
 for(let attempt=1;attempt<=3;attempt++){
  h.send({type:'progress',completed:2,total:4,bytes:12,totalBytes:40,file:'/duetblox/model.bin',attempt});
  await h.advance(60000);
  assert.equal(settled,false,`Attempt ${attempt} should keep the client waiting even after 90 seconds total`);
  assert.equal(h.timers.size,1,'Only the current inactivity deadline remains');
 }
 assert.deepEqual(progress.map(message=>message.attempt),[1,2,3]);
 assert.ok(progress.every(message=>message.completed===2&&message.bytes===12),'Retry activity must not invent completed files');
 const message='Download timed out after 60 seconds: /duetblox/model.bin (attempt 3/3). Completed files are kept.';
 h.send({type:terminal,...(terminal==='error'?{message}:{})});
 if(terminal==='error')await assert.rejects(pending,/Download timed out.*attempt 3\/3/);
 else assert.equal((await pending).type,'cancelled');
 assert.equal(h.channels[0].port1.closed,true);assert.equal(h.timers.size,0);
 await h.advance(90000);assert.equal(h.timers.size,0);
});

test('a genuinely silent offline worker times out at 90 seconds and closes the command port',async()=>{
 const h=commandHarness(),pending=h.context.offlineCommand('PREPARE');
 let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
 await Promise.resolve();await h.advance(89999);assert.equal(settled,false);
 await h.advance(1);await assert.rejects(pending,/Offline storage stopped responding/);
 assert.equal(h.channels[0].port1.closed,true);assert.equal(h.timers.size,0);
});

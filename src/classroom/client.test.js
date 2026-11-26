import test from 'node:test';import assert from 'node:assert/strict';import {ClassroomService} from './client.js';
const key='x'.repeat(43);const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
test('client uses authenticated requests, keeps keys out of state and rejects missing cloud values',async()=>{const calls=[];const service=new ClassroomService({fetchImpl:async(url,options)=>{calls.push({url,options});return json(url.endsWith('/session')?{room:'classroom',role:'student'}:url.endsWith('/variables')?{values:{score:7},revision:1}:{value:12});}});await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});assert.equal(service.rpc('isConnected'),true);assert.equal(await service.rpc('getVariable',['score']),7);await assert.rejects(service.getVariable('missing'),/has not been set/);assert.equal(await service.rpc('setVariable',['score',12]),12);assert.equal(calls[0].options.headers.Authorization,`Bearer ${key}`);assert.equal(JSON.stringify(service.getState()).includes(key),false);service.disconnect();assert.equal(service.rpc('isConnected'),false);await assert.rejects(service.getVariable('score'),/Connect/);});
test('disconnect aborts in-flight work and late responses cannot reconnect',async()=>{let release;const service=new ClassroomService({fetchImpl:()=>new Promise(resolve=>{release=resolve;})});const pending=service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});service.disconnect();release(json({room:'classroom',role:'student'}));await assert.rejects(pending,/changed|cancelled/);assert.equal(service.getState().connected,false);});
test('client rejects invalid origin, credentials and nonnumeric cloud payloads',async()=>{const service=new ClassroomService({fetchImpl:async()=>json({room:'classroom',role:'student'})});for(const url of ['javascript:alert(1)','https://user:pass@example.com','https://example.com/path'])await assert.rejects(service.connect({url,room:'classroom',key}));await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});assert.throws(()=>service.setVariable('score','2'),/numbers/);assert.throws(()=>service.setVariable('score',Infinity),/numbers/);assert.throws(()=>service.rpc('deleteEverything'),/Unsupported/);assert.throws(()=>service.downloadProject('../private'),/Invalid/);});
test('default browser fetch keeps its global receiver and a network loss disconnects',async()=>{const original=globalThis.fetch;let lose=false;globalThis.fetch=async function(){assert.equal(this,globalThis);if(lose)throw new TypeError('Network unavailable');return json({room:'classroom',role:'student'});};try{const service=new ClassroomService();await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});lose=true;await assert.rejects(service.getVariables(),/Cannot reach/);assert.equal(service.getState().connected,false);assert.equal(service.credentials,null);}finally{globalThis.fetch=original;}});
test('a mounted app keeps classroom requests on the teacher-supplied server origin',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://duetpower.in',href:'https://duetpower.in/duetblox/',pathname:'/duetblox/'}});
 try{
  const requested=[];
  const service=new ClassroomService({fetchImpl:async(url,options)=>{requested.push({url,options});return json(url.endsWith('/session')?{room:'classroom',role:'student'}:{values:{score:3}});}});
  await service.connect({url:'http://192.168.1.20:5191',room:'classroom',key});
  assert.equal(await service.getVariable('score'),3);
  assert.deepEqual(requested.map(call=>call.url),['http://192.168.1.20:5191/api/classroom/rooms/classroom/session','http://192.168.1.20:5191/api/classroom/rooms/classroom/variables']);
  for(const call of requested){assert.equal(call.options.headers.Authorization,`Bearer ${key}`);assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');}
  service.disconnect();
 }finally{if(original)Object.defineProperty(globalThis,'location',original);else delete globalThis.location;}
});

test('submission receipts are scoped to the exact connected room and never leak to another server',async()=>{
 const calls=[],id='12345678-1234-1234-1234-123456789abc',receiptKey='R'.repeat(43);
 const service=new ClassroomService({fetchImpl:async(url,options)=>{calls.push({url,options});return json(url.endsWith('/session')?{room:'classroom',role:'student'}:url.endsWith('/submissions')?{submission:{id,name:'Story.sb3'},receiptKey}:{id,review:null});}});
 await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});
 const result=await service.submitAssignment(new File(['zip'],'Story.sb3'),id,'Blue Fox');assert.equal(result.receipt.kind,'duetblox-submission-receipt');assert.equal(result.receipt.key,receiptKey);
 await service.getSubmission(id,result.receipt);assert.equal(calls.at(-1).options.headers['X-Submission-Key'],receiptKey);
 const count=calls.length;assert.throws(()=>service.getSubmission(id,{...result.receipt,url:'https://another.example'}),/has not been sent/);assert.throws(()=>service.downloadSubmission(id,{...result.receipt,room:'other'}),/has not been sent/);assert.equal(calls.length,count);
 assert.equal(JSON.stringify(service.getState()).includes(receiptKey),false);assert.equal(JSON.stringify(service.getState()).includes(key),false);
 service.disconnect();assert.throws(()=>service.validateReceipt(result.receipt),/has not been sent/);
});

test('assignment requests use explicit API paths and review is sent as JSON',async()=>{
 const calls=[],id='12345678-1234-1234-1234-123456789abc';const service=new ClassroomService({fetchImpl:async(url,options)=>{calls.push({url,options});return json(url.endsWith('/session')?{room:'classroom',role:'teacher'}:url.endsWith('/assignments')?{assignments:[]}:url.endsWith('/submissions')?{submissions:[]}:{id});}});
 await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});assert.deepEqual(await service.listAssignments(),[]);assert.deepEqual(await service.listSubmissions(),[]);
 await service.saveAssignment({title:'Story',instructions:'Try it.'},id);assert.match(calls.at(-1).url,new RegExp('/assignments/'+id+'$'));
 await service.reviewSubmission(id,{status:'complete',feedback:'You explained the change.'});assert.equal(calls.at(-1).options.method,'POST');assert.equal(JSON.parse(calls.at(-1).options.body).status,'complete');assert.match(calls.at(-1).url,/\/review$/);
 assert.throws(()=>service.submitAssignment(new File(['x'],'bad.html'),id,'Fox'),/Choose a/);
 assert.throws(()=>service.validateReceipt({kind:'duetblox-submission-receipt',version:1,id,key:'bad'}),/valid/);
});

test('session receipt history survives panel navigation and is erased on disconnect',async()=>{
 const id='12345678-1234-1234-1234-123456789abc',other='12345678-1234-1234-1234-123456789abd',receiptKey='R'.repeat(43);
 const service=new ClassroomService({fetchImpl:async()=>json({room:'classroom',role:'student'})});await service.connect({url:'http://127.0.0.1:5191',room:'classroom',key});
 const receipt={kind:'duetblox-submission-receipt',version:1,url:'http://127.0.0.1:5191',room:'classroom',id,key:receiptKey};
 service.rememberSubmissionReceipt(receipt,'First.sb3');service.rememberSubmissionReceipt({...receipt,id:other,key:'Q'.repeat(43)},'Revision.sb3');
 const history=service.getSubmissionReceipts();assert.equal(history.length,2);assert.equal(history[0].receipt.id,id);history[0].receipt.key='modified';assert.equal(service.getSubmissionReceipts()[0].receipt.key,receiptKey);
 assert.equal(JSON.stringify(service.getState()).includes(receiptKey),false);
 assert.throws(()=>service.rememberSubmissionReceipt({...receipt,url:'https://other.example'}),/has not been sent/);assert.equal(service.getSubmissionReceipts().length,2);
 service.disconnect();assert.deepEqual(service.getSubmissionReceipts(),[]);
});

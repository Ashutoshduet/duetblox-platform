import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import JSZip from 'jszip';
import {createClassroomServer,generateRoomConfig} from './server.mjs';
import {MAX_UPLOAD,validateProjectArchive} from './archive.mjs';
const teacher='T'.repeat(43),student='S'.repeat(43),second='B'.repeat(43);
async function fixture(t,opts={}){const dir=await mkdtemp(path.join(os.tmpdir(),'duet-classroom-'));const dist=path.join(dir,'dist');await mkdir(dist);await writeFile(path.join(dist,'index.html'),'<h1>DUETBlox</h1>');const server=await createClassroomServer({dataDir:path.join(dir,'data'),distDir:dist,rooms:{alpha:{teacher,student},beta:{teacher:second,student:'C'.repeat(43)}},origins:['http://127.0.0.1:5190'],...opts});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;const request=(resource,options={})=>fetch(`${base}/api/classroom/rooms/${options.room||'alpha'}/${resource}`,{method:options.method||'GET',headers:{Authorization:`Bearer ${options.token||student}`,...options.headers},body:options.body});return {dir,dist,server,base,request};}
async function archive(name='project.json',value={targets:[{isStage:true,name:'Stage'}]}){const zip=new JSZip();zip.file(name,JSON.stringify(value));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
test('authentication, exact origin and host checks isolate private rooms',async t=>{const {request,base}=await fixture(t);assert.equal((await request('session')).status,200);assert.equal((await request('session',{token:'wrong'})).status,401);assert.equal((await request('session',{room:'beta'})).status,401);assert.equal((await fetch(base+'/api/classroom/rooms/alpha/session')).status,401);assert.equal((await request('session',{headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await request('session',{headers:{Origin:'null'}})).status,403);const badHost=await new Promise((resolve,reject)=>{const u=new URL(base);http.get({hostname:u.hostname,port:u.port,path:'/api/classroom/rooms/alpha/session',headers:{Host:'evil.example',Authorization:`Bearer ${student}`}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});assert.equal(badHost,403);const allowed=await request('session',{headers:{Origin:'http://127.0.0.1:5190'}});assert.equal(allowed.headers.get('access-control-allow-origin'),'http://127.0.0.1:5190');const preflight=await fetch(base+'/api/classroom/rooms/alpha/projects',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:5190','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,x-project-name'}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);});
test('real ZIP project is shared, downloaded byte-for-byte, room-isolated and teacher-removable',async t=>{const {request}=await fixture(t);const bytes=await archive();const upload=await request('projects',{method:'POST',body:bytes,headers:{'X-Project-Name':'Lesson.sb3'}});assert.equal(upload.status,201);const item=await upload.json();assert.equal(item.bytes,bytes.length);assert.equal((await(await request('projects')).json()).projects[0].name,'Lesson.sb3');assert.deepEqual(Buffer.from(await(await request(`projects/${item.id}`)).arrayBuffer()),bytes);assert.equal((await request(`projects/${item.id}`,{room:'beta',token:second})).status,404);assert.equal((await request(`projects/${item.id}`,{method:'DELETE'})).status,403);assert.equal((await request(`projects/${item.id}`,{method:'DELETE',token:teacher})).status,200);assert.equal((await request(`projects/${item.id}`)).status,404);});
test('DUET manifest works; disguised, malformed, unsafe and oversized uploads fail',async t=>{const {request,base}=await fixture(t);const valid=await archive('duetblox.json',{kind:'duetblox-project',version:3});assert.equal((await request('projects',{method:'POST',body:valid,headers:{'X-Project-Name':'My%20project.duet'}})).status,201);for(const [body,name] of [[Buffer.from('not a zip'),'bad.sb3'],[await archive('notes.txt',{}),'fake.sb3'],[await archive(),'../escape.sb3'],[await archive(),'anything.html']])assert.equal((await request('projects',{method:'POST',body,headers:{'X-Project-Name':encodeURIComponent(name)}})).status,400);const unsafe=new JSZip();unsafe.file('../escape','danger');unsafe.file('project.json',JSON.stringify({targets:[{isStage:true}]}));assert.throws(()=>validateProjectArchive(Buffer.alloc(MAX_UPLOAD+1),'too-big.sb3'),/size/);const noStage=await archive('project.json',{targets:[{isStage:false}]});assert.throws(()=>validateProjectArchive(noStage,'bad.sb3'),/Invalid Scratch/);const evilBytes=await unsafe.generateAsync({type:'nodebuffer'});assert.throws(()=>validateProjectArchive(evilBytes,'bad.sb3'),/Unsafe/);
 const status=await new Promise((resolve,reject)=>{const u=new URL(base);const req=http.request({hostname:u.hostname,port:u.port,path:'/api/classroom/rooms/alpha/projects',method:'POST',headers:{Authorization:`Bearer ${student}`,'Content-Length':String(MAX_UPLOAD+1),'X-Project-Name':'large.sb3'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});assert.equal(status,413);
});
test('numeric values persist; concurrent writes preserve fields and room boundaries',async t=>{const {request,dir}=await fixture(t);await Promise.all(Array.from({length:12},(_,i)=>request(`variables/value${i}`,{method:'POST',body:JSON.stringify({value:i*3}),headers:{'Content-Type':'application/json'}}).then(r=>assert.equal(r.status,200))));const state=await(await request('variables')).json();assert.equal(Object.keys(state.values).length,12);assert.equal(state.revision,12);assert.deepEqual((await(await request('variables',{room:'beta',token:second})).json()).values,{});const disk=JSON.parse(await readFile(path.join(dir,'data','alpha','index.json')));assert.deepEqual(disk.variables,state.values);for(const value of ['3',null,1e13])assert.equal((await request('variables/score',{method:'POST',body:JSON.stringify({value})})).status,400);assert.equal((await request('variables/1bad',{method:'POST',body:'{"value":2}'})).status,400);assert.equal((await request('variables/score',{method:'POST',body:'x'.repeat(1025)})).status,413);});
test('static app serving cannot expose outside files or symlink targets',async t=>{const {dist,dir,base}=await fixture(t);await writeFile(path.join(dir,'secret.txt'),'PRIVATE');await symlink(path.join(dir,'secret.txt'),path.join(dist,'leak.txt'));assert.match(await(await fetch(base)).text(),/DUETBlox/);assert.equal((await fetch(base+'/leak.txt')).status,404);assert.equal((await fetch(base+'/.hidden')).status,404);const status=await new Promise((resolve,reject)=>{const u=new URL(base);http.get({hostname:u.hostname,port:u.port,path:'/%2e%2e/secret.txt'},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});assert.equal(status,400);});
test('room initialization uses distinct generated secrets and refuses overwrite',async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'duet-keys-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'keys.json'),keys=await generateRoomConfig(file,'robotics');assert.notEqual(keys.teacher,keys.student);assert.equal(keys.teacher.length,43);assert.equal(JSON.parse(await readFile(file,'utf8')).rooms.robotics.teacher,keys.teacher);await assert.rejects(generateRoomConfig(file,'robotics'),e=>e.code==='EEXIST');});

test('private classroom stores version 5 circuit projects byte-for-byte and rejects future versions',async t=>{
 const {request}=await fixture(t),bytes=await archive('duetblox.json',{kind:'duetblox-project',version:5,circuit:{kind:'duetblox-circuit',version:1,boardId:'arduino-uno',components:[],wires:[]},spice:{kind:'duetblox-spice',version:1,name:'Divider',netlist:'Divider\nV1 a 0 5\nR1 a 0 1k\n.op\n.end'}});
 const response=await request('projects',{method:'POST',body:bytes,headers:{'X-Project-Name':'Circuit.duet'}});assert.equal(response.status,201);const {id}=await response.json();assert.deepEqual(Buffer.from(await(await request(`projects/${id}`)).arrayBuffer()),bytes);
 assert.throws(()=>validateProjectArchive(Buffer.from(bytes),'Circuit.html'),/named/);
 const future=await archive('duetblox.json',{kind:'duetblox-project',version:6});assert.throws(()=>validateProjectArchive(future,'Future.duet'),/Unsupported/);
});

test('assignments are teacher-managed and private submissions need their own receipt',async t=>{
 const {request,dir}=await fixture(t);
 const task={title:'Make a story',instructions:'Move, speak, then explain one change.',closed:false};
 assert.equal((await request('assignments',{method:'POST',body:JSON.stringify(task)})).status,403);
 const created=await request('assignments',{method:'POST',token:teacher,body:JSON.stringify(task)});assert.equal(created.status,201);const assignment=await created.json();
 assert.equal((await(await request('assignments')).json()).assignments[0].title,task.title);
 const bytes=await archive();const response=await request('submissions',{method:'POST',body:bytes,headers:{'X-Project-Name':'Story.sb3','X-Assignment-Id':assignment.id,'X-Student-Name':'Blue%20Fox'}});assert.equal(response.status,201);
 const {submission,receiptKey}=await response.json();assert.equal(receiptKey.length,43);assert.equal(submission.studentName,'Blue Fox');assert.equal(submission.receiptHash,undefined);
 assert.deepEqual((await(await request('projects')).json()).projects,[]);
 assert.equal((await request('submissions')).status,403);
 assert.equal((await request(`submissions/${submission.id}`)).status,403);
 assert.equal((await request(`submissions/${submission.id}/file`)).status,403);
 assert.equal((await request(`submissions/${submission.id}`,{headers:{'X-Submission-Key':'wrong'}})).status,403);
 const headers={'X-Submission-Key':receiptKey};assert.equal((await request(`submissions/${submission.id}`,{headers})).status,200);
 assert.deepEqual(Buffer.from(await(await request(`submissions/${submission.id}/file`,{headers})).arrayBuffer()),bytes);
 assert.equal((await request(`submissions/${submission.id}`,{room:'beta',token:second,headers})).status,404);
 const list=await(await request('submissions',{token:teacher})).json();assert.equal(list.submissions.length,1);assert.equal(JSON.stringify(list).includes(receiptKey),false);assert.equal(JSON.stringify(list).includes('receiptHash'),false);
 const disk=await readFile(path.join(dir,'data','alpha','index.json'),'utf8');assert.equal(disk.includes(receiptKey),false);assert.match(disk,/receiptHash/);
 const review={status:'revise',feedback:'Try changing the move distance and explain your prediction.'};
 assert.equal((await request(`submissions/${submission.id}/review`,{method:'POST',body:JSON.stringify(review)})).status,403);
 assert.equal((await request(`submissions/${submission.id}/review`,{method:'POST',token:teacher,body:JSON.stringify(review)})).status,200);
 const received=await(await request(`submissions/${submission.id}`,{headers})).json();assert.equal(received.review.feedback,review.feedback);assert.equal(received.review.status,'revise');
 assert.equal((await request(`assignments/${assignment.id}`,{method:'POST',token:teacher,body:JSON.stringify({...task,closed:true})})).status,200);
 assert.equal((await request('submissions',{method:'POST',body:bytes,headers:{'X-Project-Name':'Late.sb3','X-Assignment-Id':assignment.id,'X-Student-Name':'Fox'}})).status,409);
 assert.equal((await request(`submissions/${submission.id}`,{headers})).status,200);
});

test('assignment and review bounds reject malformed content without mutating saved work',async t=>{
 const {request}=await fixture(t);
 for(const payload of [{title:'',instructions:'Try'}, {title:'A',instructions:'x'.repeat(5001)}, {title:'A',instructions:'Try',closed:'yes'}])assert.equal((await request('assignments',{method:'POST',token:teacher,body:JSON.stringify(payload)})).status,400);
 const assignment=await(await request('assignments',{method:'POST',token:teacher,body:JSON.stringify({title:'A',instructions:'Try a circuit'})})).json();
 const headers={'X-Project-Name':'Work.sb3','X-Assignment-Id':assignment.id,'X-Student-Name':'Fox'};
 assert.equal((await request('submissions',{method:'POST',headers,body:Buffer.from('not a project')})).status,400);
 assert.equal((await request('submissions',{method:'POST',headers:{...headers,'X-Student-Name':'bad%0Aalias'},body:await archive()})).status,400);
 const result=await(await request('submissions',{method:'POST',headers,body:await archive()})).json();
 for(const review of [{status:'graded',feedback:'X'}, {status:'complete',feedback:'x'.repeat(3001)}, {status:'complete',feedback:22}])assert.equal((await request(`submissions/${result.submission.id}/review`,{method:'POST',token:teacher,body:JSON.stringify(review)})).status,400);
 assert.equal((await(await request(`submissions/${result.submission.id}`,{token:teacher})).json()).review,null);
});

test('concurrent assignment submissions retain distinct private receipts and survive server restart',async t=>{
 const {request,dir}=await fixture(t);
 const task=await(await request('assignments',{method:'POST',token:teacher,body:JSON.stringify({title:'Two stories',instructions:'Explain your code.'})})).json();
 const bytes=await archive();const results=await Promise.all(['Fox','Robot'].map(async alias=>{const response=await request('submissions',{method:'POST',body:bytes,headers:{'X-Project-Name':alias+'.sb3','X-Assignment-Id':task.id,'X-Student-Name':alias}});assert.equal(response.status,201);return response.json();}));
 assert.notEqual(results[0].receiptKey,results[1].receiptKey);assert.equal((await request(`submissions/${results[0].submission.id}`,{headers:{'X-Submission-Key':results[1].receiptKey}})).status,403);
 const restarted=await createClassroomServer({dataDir:path.join(dir,'data'),rooms:{alpha:{teacher,student}}});await new Promise(resolve=>restarted.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>restarted.close(resolve)));
 const base=`http://127.0.0.1:${restarted.address().port}/api/classroom/rooms/alpha`;
 const list=await(await fetch(base+'/submissions',{headers:{Authorization:`Bearer ${teacher}`}})).json();assert.equal(list.submissions.length,2);
 const saved=await fetch(`${base}/submissions/${results[0].submission.id}`,{headers:{Authorization:`Bearer ${student}`,'X-Submission-Key':results[0].receiptKey}});assert.equal(saved.status,200);
});

test('mounted browser releases are served at their manifest path while classroom API remains at the origin',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'duet-classroom-mounted-'));
 const dist=path.join(dir,'dist');await mkdir(path.join(dist,'assets'),{recursive:true});await writeFile(path.join(dist,'index.html'),'<h1>Mounted app</h1>');await writeFile(path.join(dist,'assets','app.js'),'/* mounted script */');await writeFile(path.join(dist,'offline-manifest.json'),JSON.stringify({basePath:'/duetblox/'}));
 const server=await createClassroomServer({dataDir:path.join(dir,'data'),distDir:dist,rooms:{alpha:{teacher,student}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
 const root=await fetch(base,{redirect:'manual'});assert.equal(root.status,307);assert.equal(root.headers.get('location'),'/duetblox/');assert.match(await(await fetch(base+'/duetblox/')).text(),/Mounted app/);assert.match(await(await fetch(base+'/duetblox/assets/app.js')).text(),/mounted script/);assert.equal((await fetch(base+'/assets/app.js')).status,404);
 assert.equal((await fetch(base+'/api/classroom/rooms/alpha/session',{headers:{Authorization:`Bearer ${student}`}})).status,200);
});

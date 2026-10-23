import http from 'node:http';
import {readFile,writeFile,mkdir,rename,rm,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MAX_UPLOAD,validateProjectArchive} from './archive.mjs';
const slug=/^[a-z0-9][a-z0-9-]{0,47}$/;
const variable=/^[A-Za-z][A-Za-z0-9 _-]{0,47}$/;
const problem=(status,message)=>Object.assign(new Error(message),{status});
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
async function body(req,limit){if(Number(req.headers['content-length'])>limit)throw problem(413,'Request exceeds its size limit.');let size=0,parts=[];for await(const p of req){size+=p.length;if(size>limit)throw problem(413,'Request exceeds its size limit.');parts.push(p);}return Buffer.concat(parts);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
export async function createClassroomServer({dataDir,rooms,distDir,origins=[],publicOrigins=[]}={}){
 if(!dataDir||!rooms||!Object.keys(rooms).length)throw Error('A data directory and at least one room are required.');
 for(const [name,keys] of Object.entries(rooms)){if(!slug.test(name)||!keys||typeof keys.teacher!=='string'||typeof keys.student!=='string'||keys.teacher.length<32||keys.student.length<32||keys.teacher===keys.student)throw Error('Each room needs a valid name and separate teacher/student keys of at least 32 characters.');}
 const originsSet=new Set([...origins,...publicOrigins]);for(const origin of originsSet){const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==origin||u.username||u.password)throw Error('Origins must be exact HTTP(S) origins.');}
 await mkdir(dataDir,{recursive:true,mode:0o700});const root=distDir?await realpath(distDir):null;
 let queue=Promise.resolve(),uploads=0;const rates=new Map();const mutate=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const dataPath=room=>path.join(dataDir,room,'index.json');
 const read=async room=>{try{const x=JSON.parse(await readFile(dataPath(room),'utf8'));if(!Array.isArray(x.projects)||!x.variables||typeof x.variables!=='object')throw Error('Invalid saved room');return x;}catch(e){if(e.code==='ENOENT')return {projects:[],variables:{},revision:0};throw e;}};
 const save=async(room,x)=>{const folder=path.join(dataDir,room);await mkdir(folder,{recursive:true,mode:0o700});const tmp=path.join(folder,`.${randomUUID()}.tmp`);await writeFile(tmp,JSON.stringify(x),{mode:0o600});await rename(tmp,dataPath(room));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   const host=req.headers.host||'',port=server.address()?.port;const localHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`]);const publicHosts=new Set(publicOrigins.map(x=>new URL(x).host));
   if(!localHosts.has(host)&&!publicHosts.has(host))throw problem(403,'Host is not configured for this classroom.');
   const same=`http://${host}`,origin=req.headers.origin;
   if(origin&&(origin==='null'||!(origin===same||originsSet.has(origin))))throw problem(403,'Origin is not allowed.');
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Project-Name','Access-Control-Max-Age':'300'});res.end();return;}
   let url;try{url=new URL(req.url,same);}catch{throw problem(400,'Invalid URL.');}
   const raw=req.url.split('?')[0];let decoded;try{decoded=decodeURIComponent(raw);}catch{throw problem(400,'Invalid URL encoding.');}
   if(decoded.includes('\\')||decoded.split('/').some(p=>p==='..'||p==='.')||decoded.includes('\0'))throw problem(400,'Unsafe path.');
   if(!url.pathname.startsWith('/api/classroom/')){
    if(!root||!['GET','HEAD'].includes(req.method))throw problem(404,'Not found.');
    if(decoded.split('/').some(p=>p.startsWith('.')))throw problem(404,'Not found.');
    let file=path.resolve(root,'.'+decoded);if(file!==root&&!file.startsWith(root+path.sep))throw problem(404,'Not found.');
    try{let info=await stat(file);if(info.isDirectory())file=path.join(file,'index.html');file=await realpath(file);info=await stat(file);if(!file.startsWith(root+path.sep)||!info.isFile())throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;}catch{throw problem(404,'Not found.');}
   }
   const match=url.pathname.match(/^\/api\/classroom\/rooms\/([a-z0-9][a-z0-9-]{0,47})\/(session|projects|variables)(?:\/([^/]+))?$/);
   if(!match)throw problem(404,'Not found.');const [,room,resource,rawId]=match;const keys=rooms[room],token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
   const role=keys&&equal(token,keys.teacher)?'teacher':keys&&equal(token,keys.student)?'student':null;if(!role)throw problem(401,'Room or access key is incorrect.');
   const rateKey=room+':'+role,now=Date.now();let rate=rates.get(rateKey);if(!rate||now-rate.start>=10000){rate={start:now,count:0};rates.set(rateKey,rate);}if(++rate.count>300)throw problem(429,'This room is sending requests too quickly. Wait a few seconds.');
   if(resource==='session'&&req.method==='GET'&&!rawId){json(res,200,{room,role,maxUploadBytes:MAX_UPLOAD,projectLimit:100,variableLimit:100});return;}
   if(resource==='projects'){
    if(req.method==='GET'&&!rawId){json(res,200,{projects:(await read(room)).projects});return;}
    if(req.method==='POST'&&!rawId){
     if(uploads>=2)throw problem(429,'Another upload is in progress. Try again shortly.');uploads++;
     try{let name;try{name=decodeURIComponent(req.headers['x-project-name']||'');}catch{throw problem(400,'Invalid project name.');}const bytes=await body(req,MAX_UPLOAD);validateProjectArchive(bytes,name);
      const result=await mutate(async()=>{const x=await read(room);if(x.projects.length>=100||x.projects.reduce((n,p)=>n+p.bytes,0)+bytes.length>512*1024*1024)throw problem(409,'Room storage limit reached. Ask the teacher to remove a project.');const item={id:randomUUID(),name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:new Date().toISOString()};await mkdir(path.join(dataDir,room),{recursive:true,mode:0o700});await writeFile(path.join(dataDir,room,item.id+'.bin'),bytes,{flag:'wx',mode:0o600});try{x.projects.unshift(item);await save(room,x);}catch(e){await rm(path.join(dataDir,room,item.id+'.bin'),{force:true});throw e;}return item;});json(res,201,result);return;
     }finally{uploads--;}
    }
    if(rawId&&/^[0-9a-f-]{36}$/.test(rawId)){
     if(req.method==='GET'){const item=(await read(room)).projects.find(p=>p.id===rawId);if(!item)throw problem(404,'Project not found.');const file=path.join(dataDir,room,rawId+'.bin');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':item.bytes,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`,'Cache-Control':'no-store'});createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;}
     if(req.method==='DELETE'){if(role!=='teacher')throw problem(403,'Only the teacher can remove shared projects.');await mutate(async()=>{const x=await read(room);if(!x.projects.some(p=>p.id===rawId))throw problem(404,'Project not found.');x.projects=x.projects.filter(p=>p.id!==rawId);await save(room,x);await rm(path.join(dataDir,room,rawId+'.bin'),{force:true});});json(res,200,{deleted:true});return;}
    }
   }
   if(resource==='variables'){
    if(req.method==='GET'&&!rawId){const x=await read(room);json(res,200,{values:x.variables,revision:x.revision});return;}
    if(req.method==='POST'&&rawId){let name;try{name=decodeURIComponent(rawId);}catch{throw problem(400,'Invalid variable name.');}if(!variable.test(name))throw problem(400,'Use a letter followed by up to 47 letters, numbers, spaces, underscores or hyphens.');let payload;try{payload=JSON.parse((await body(req,1024)).toString('utf8'));}catch(e){if(e.status)throw e;throw problem(400,'Expected a JSON number value.');}const value=payload?.value;if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e12)throw problem(400,'Value must be a finite number between -1e12 and 1e12.');const result=await mutate(async()=>{const x=await read(room);if(!Object.hasOwn(x.variables,name)&&Object.keys(x.variables).length>=100)throw problem(409,'This room already has 100 variables.');Object.defineProperty(x.variables,name,{value,enumerable:true,configurable:true,writable:true});x.revision++;await save(room,x);return {name,value,revision:x.revision};});json(res,200,result);return;}
   }
   throw problem(405,'Method is not supported for this resource.');
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'The classroom server could not complete this request.'});else res.destroy();}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;return server;
}
export async function generateRoomConfig(file,room='classroom'){
 if(!slug.test(room))throw Error('Room name must contain lowercase letters, numbers and hyphens.');const keys={teacher:randomBytes(32).toString('base64url'),student:randomBytes(32).toString('base64url')};await mkdir(path.dirname(file),{recursive:true,mode:0o700});await writeFile(file,JSON.stringify({rooms:{[room]:keys}},null,2)+'\n',{flag:'wx',mode:0o600});return {room,...keys};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2);const option=(key,fallback)=>{const i=args.indexOf(key);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for ${key}`);return args[i+1];};
  if(args.includes('--init')){const file=path.resolve(option('--config','work/classroom-keys.json')),room=option('--room','classroom');const keys=await generateRoomConfig(file,room);console.log(`Created ${file}\nRoom: ${room}\nTeacher key: ${keys.teacher}\nStudent key: ${keys.student}\nKeep teacher access private; give students only the student key.`);}
  else {const host=option('--host','127.0.0.1'),port=Number(option('--port','5191'));if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be between 1024 and 65535.');const publicOrigin=option('--public-origin','');if(!['127.0.0.1','localhost','::1'].includes(host)&&!publicOrigin)throw Error('LAN listening requires --public-origin http://YOUR-LAN-IP:PORT.');const config=JSON.parse(await readFile(path.resolve(option('--config','work/classroom-keys.json')),'utf8'));const server=await createClassroomServer({dataDir:path.resolve(option('--data','work/classroom-data')),rooms:config.rooms,distDir:path.resolve(option('--dist','dist')),origins:args.flatMap((v,i)=>v==='--allow-origin'?[args[i+1]]:[]),publicOrigins:publicOrigin?[publicOrigin]:[]});server.listen(port,host,()=>console.log(`DUETBlox private classroom: ${publicOrigin||`http://${host}:${port}`}\nRoom data stays in ${path.resolve(option('--data','work/classroom-data'))}\nKeep this terminal open; Ctrl+C stops the server.`));server.on('error',e=>{console.error(e.message);process.exitCode=1;});}
 }catch(e){console.error(e.message);process.exitCode=1;}
}

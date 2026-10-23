// Dependency-free, loopback-only preview of the already-built browser app.
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,realpath,stat} from 'node:fs/promises';
import {normalizeAppBase} from '../src/app-paths.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../dist/',import.meta.url)));
const pack=JSON.parse(await readFile(path.join(root,'offline-manifest.json'),'utf8'));
const basePath=normalizeAppBase(pack.basePath || '/');
if(process.env.DUETBLOX_BASE_PATH && normalizeAppBase(process.env.DUETBLOX_BASE_PATH)!==basePath)throw new Error('Preview base does not match the build. Rebuild with DUETBLOX_BASE_PATH first.');
const port=Number(process.env.DUETBLOX_PORT||5173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('DUETBLOX_PORT must be an integer from 1024 to 65535.');
const types={'.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8','.ino':'text/plain; charset=utf-8','.zip':'application/zip','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(basePath!=='/'&&pathname===basePath.slice(0,-1)){res.writeHead(308,{Location:basePath});res.end();return;}
  if(!pathname.startsWith(basePath))throw new Error('Not found');
  const localPath='/'+pathname.slice(basePath.length);
  if(localPath.split('/').some(part=>part.startsWith('.')))throw new Error('Not found');
  let file=path.resolve(root,'.'+localPath);if(file!==root&&!file.startsWith(root+path.sep))throw new Error('Not found');
  let info=await stat(file);if(info.isDirectory()){file=path.join(file,'index.html');info=await stat(file);}
  file=await realpath(file);if(!file.startsWith(root+path.sep)||!info.isFile())throw new Error('Not found');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{if(!res.headersSent)res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Close the other preview or set DUETBLOX_PORT.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`DUETBlox: http://127.0.0.1:${port}${basePath}\nKeep this terminal open. Press Ctrl+C to stop.`));

import {readFile,writeFile,mkdir,rename,rm,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const execFileAsync=promisify(execFile),root=path.resolve(import.meta.dirname,'..');
const base=path.join(root,'public/python'),runtime=path.join(base,'runtime');
const upstream=JSON.parse(await readFile(path.join(base,'upstream-release.json'),'utf8'));
const manifest=JSON.parse(await readFile(path.join(base,'runtime-manifest.json'),'utf8'));
const notices=JSON.parse(await readFile(path.join(base,'notices-manifest.json'),'utf8'));
const digest=data=>createHash('sha256').update(data).digest('hex');
const allowed=['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','pyodide-lock.json','python_stdlib.zip','package.json'];
if(upstream.version!=='314.0.7'||manifest.version!==upstream.version||manifest.files.length!==allowed.length||manifest.files.some(f=>!allowed.includes(f.name)))throw new Error('Unexpected Python runtime manifest. Review and pin a release before changing the runtime.');
const valid=(data,file)=>data.length===file.bytes&&digest(data)===file.sha256;
async function verify(){for(const file of manifest.files)if(!valid(await readFile(path.join(runtime,file.name)),file))throw new Error(`Python runtime integrity check failed: ${file.name}`);}
let failure;
try{await verify();}catch(error){failure=error;}
if(failure){
  const archiveArg=process.argv.find(arg=>arg.startsWith('--archive='));
  const cache=archiveArg?path.resolve(archiveArg.slice(10)):path.join(root,'work/downloads',upstream.asset.name);
  if(!archiveArg&&!process.argv.includes('--download'))throw new Error(`Python runtime is missing or changed. Run node scripts/prepare-python-runtime.mjs --download (or --archive=/path/to/${upstream.asset.name}). ${failure.message}`);
  let archive;
  try{archive=await readFile(cache);}catch(error){if(error.code!=='ENOENT'||archiveArg)throw error;}
  if(!archive){
    console.log(`Downloading pinned Pyodide ${upstream.version} core from GitHub…`);
    const response=await fetch(upstream.asset.url,{signal:AbortSignal.timeout(180000)});
    if(!response.ok)throw new Error(`Python runtime download failed: HTTP ${response.status}`);
    archive=Buffer.from(await response.arrayBuffer());
    if(archive.length!==upstream.asset.size||digest(archive)!==upstream.asset.sha256)throw new Error('Downloaded Python archive does not match the pinned GitHub release digest.');
    await mkdir(path.dirname(cache),{recursive:true});await writeFile(cache,archive);
  }
  if(archive.length!==upstream.asset.size||digest(archive)!==upstream.asset.sha256)throw new Error('Python archive does not match the pinned GitHub release digest.');
  const extracted=[];
  for(const file of manifest.files){const {stdout}=await execFileAsync('tar',['-xOf',cache,`pyodide/${file.name}`],{encoding:'buffer',maxBuffer:16*1024*1024});if(!valid(stdout,file))throw new Error(`Python archive entry does not match its pinned digest: ${file.name}`);extracted.push([file.name,stdout]);}
  const staging=await mkdtemp(path.join(base,'.runtime-'));
  try{for(const [name,data]of extracted)await writeFile(path.join(staging,name),data);await rm(runtime,{recursive:true,force:true});await rename(staging,runtime);}finally{await rm(staging,{recursive:true,force:true});}
  await verify();
}
console.log(`Pyodide ${manifest.version} / CPython ${manifest.python}: ${manifest.files.length} verified files, ${manifest.files.reduce((n,f)=>n+f.bytes,0)} bytes. No third-party Python packages bundled.`);
for(const file of notices.files){if(!/^[A-Z][A-Za-z0-9_.-]+$/.test(file.name)||!valid(await readFile(path.join(base,file.name)),file))throw new Error(`Python license/notice integrity check failed: ${file.name}`);}

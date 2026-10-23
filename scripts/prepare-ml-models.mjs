// Verify bundled assets without a network, or restore them from pinned official URLs.
// node scripts/prepare-ml-models.mjs [--download]
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(await readFile(new URL('./ml-models.lock.json',import.meta.url),'utf8'));
const download=process.argv.includes('--download');
if(process.argv.slice(2).some(a=>a!=='--download'))throw new Error('Use --download to restore pinned assets, or no arguments to verify only.');
if(lock.format!=='duetblox-local-ml-models'||lock.version!==1||!Array.isArray(lock.files))throw new Error('Invalid ML asset lockfile');
const digest=data=>createHash('sha256').update(data).digest('hex');
const valid=(data,file)=>data.length===file.bytes&&digest(data)===file.sha256;
let bytes=0;
for(const file of lock.files){
  if(!/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(file.path)||file.path.split('/').some(s=>s==='.'||s==='..')||!Number.isSafeInteger(file.bytes)||file.bytes<1||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Invalid ML asset descriptor');
  const destination=path.join(root,'public/models',file.path);let present;
  try{present=await readFile(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!present||!valid(present,file)){
    if(!download)throw new Error(`Missing or changed ML asset: ${file.path}. Run node scripts/prepare-ml-models.mjs --download while online to restore the pinned copy.`);
    const url=new URL(file.source);
    if(url.protocol!=='https:'||!['storage.googleapis.com','raw.githubusercontent.com'].includes(url.hostname)||url.username||url.password)throw new Error('Unexpected asset source');
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`Could not download ${file.path}: HTTP ${response.status}`);
    const data=Buffer.from(await response.arrayBuffer());
    if(!valid(data,file))throw new Error(`Checksum mismatch for ${file.path}; the upstream file changed. Refusing to replace the pinned model.`);
    await mkdir(path.dirname(destination),{recursive:true});const temp=destination+'.partial';
    try{await writeFile(temp,data);await rename(temp,destination);}finally{await rm(temp,{force:true});}
  }
  bytes+=file.bytes;
}
const manifestPath=path.join(root,'public/models/manifest.json'),serialized=JSON.stringify(lock,null,2)+'\n';
if(download)await writeFile(manifestPath,serialized);
else if(await readFile(manifestPath,'utf8')!==serialized)throw new Error('The public ML manifest does not match its lockfile. Run with --download to restore it.');
console.log(`Verified ${lock.files.length} local ML files (${bytes.toLocaleString('en-US')} bytes). All pinned models are available without external requests.`);

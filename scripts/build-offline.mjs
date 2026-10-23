import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {appPath, normalizeAppBase} from '../src/app-paths.js';
const basePath=normalizeAppBase(process.env.DUETBLOX_BASE_PATH || '/');
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist'),hash=data=>createHash('sha256').update(data).digest('hex');
// The web manifest is hashed only after its install scope has been finalized.
try {
 const manifestPath=path.join(dist,'manifest.webmanifest');
 const pwa=JSON.parse(await readFile(manifestPath,'utf8'));
 pwa.id=basePath;pwa.start_url=basePath;pwa.scope=basePath;
 pwa.icons=pwa.icons.map(icon=>({...icon,src:appPath(icon.src.replace(/^\.\//,''),basePath)}));
 await writeFile(manifestPath,JSON.stringify(pwa,null,2)+'\n');
} catch(error) {if(error.code!=='ENOENT')throw error;}
const files=[];
async function walk(dir,rel=''){for(const entry of await readdir(dir,{withFileTypes:true})){
 const name=rel?`${rel}/${entry.name}`:entry.name;
 if(['source','types'].includes(entry.name)||['sw.js','offline-manifest.json'].includes(name)||name.endsWith('.map')||entry.name==='.DS_Store')continue;
 if(entry.isDirectory())await walk(path.join(dir,entry.name),name);else if(entry.isFile()){
  const data=await readFile(path.join(dir,entry.name));files.push({url:appPath(name,basePath),bytes:data.length,sha256:hash(data),shell:name==='index.html'||name==='favicon.svg'||name==='manifest.webmanifest'||name.startsWith('assets/')||name.startsWith('fonts/')});
 }
}}
await walk(dist);const index=files.find(f=>f.url===appPath('index.html',basePath));if(!index)throw new Error('Build Vite before building the offline pack.');files.push({...index,url:basePath});files.sort((a,b)=>a.url.localeCompare(b.url));
const version=hash(JSON.stringify(files)).slice(0,20),manifest={format:'duetblox-offline-pack',schema:1,basePath,version,bytes:files.reduce((n,f)=>n+f.bytes,0),files};
// Hosted builds may omit only these large shards; the full pack still lists
// every byte and offline preparation restores the exact official copies.
const modelLock=JSON.parse(await readFile(path.join(root,'scripts/ml-models.lock.json'),'utf8'));
const mirrors={},resnet=modelLock.files.filter(file=>/^pose\/resnet50\/group1-shard(?:[1-9]|1[0-9]|2[0-3])of23\.bin$/.test(file.path));
if(resnet.length!==23||new Set(resnet.map(file=>file.path)).size!==23)throw new Error('Expected exactly 23 pinned ResNet50 weight shards.');
for(const file of resnet){
 const localURL=appPath(`models/${file.path}`,basePath),built=files.find(entry=>entry.url===localURL);
 const official=`https://storage.googleapis.com/tfjs-models/savedmodel/posenet/resnet50/float/${path.posix.basename(file.path)}`;
 if(file.source!==official||!built||built.bytes!==file.bytes||built.sha256!==file.sha256)throw new Error(`ResNet50 mirror differs from the verified build: ${file.path}`);
 mirrors[localURL]={url:official,bytes:file.bytes,sha256:file.sha256};
}
await writeFile(path.join(dist,'offline-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(dist,'sw.js'),(await readFile(path.join(root,'src/offline/worker.js'),'utf8')).replace('__DUET_OFFLINE_MANIFEST__',JSON.stringify(manifest)).replace('__DUET_OFFLINE_MIRRORS__',JSON.stringify(mirrors)));
console.log(`Offline pack ${version}: ${files.length} files, ${(manifest.bytes/1048576).toFixed(1)} MiB; source archives excluded.`);

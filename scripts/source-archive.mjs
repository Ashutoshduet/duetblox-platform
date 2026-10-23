import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const root=path.resolve(import.meta.dirname,'..');
const zip=new JSZip();
const excluded=new Set(['node_modules','.git','.openai','dist','work','.sites-runtime']);
async function walk(directory,relative=''){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const name=relative?`${relative}/${entry.name}`:entry.name;
    if(excluded.has(entry.name)||name==='public/scratch'||name==='public/python/runtime'||entry.name==='.DS_Store'||entry.name.startsWith('qa-'))continue;
    if(name.startsWith('public/source/')&&(/\.tar\.gz(?:\.|$)|\.zip(?:\.|$)/.test(name)))continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())await walk(absolute,name);
    else if(entry.isFile()&&(!name.startsWith('public/models/')&&!name.startsWith('public/scratch-media/')||entry.name.endsWith('.json')||entry.name.endsWith('.txt')))zip.file(`duetblox/${name}`,await readFile(absolute));
  }
}
await walk(root);
zip.file('duetblox/UPSTREAM-SOURCES.txt','The official Scratch source archives are linked at /source/ on the same host. Exact revisions, source manifests, checksum-pinned URLs, notices and restoration instructions are included under public/source in this ZIP. Run node scripts/restore-source-packets.mjs to fetch and verify all archive packets. The laptop handoff already contains them. See docs/source-distribution.md. Package lockfiles pin the complete dependency tree. The unmodified ML weights and Scratch media are distributed separately at /models/ and /scratch-media/ with provenance/checksums. The scripts prepare-ml-models.mjs and package-scratch-media.mjs verify or restore them. No user projects, credentials or installed dependencies are included.\n');
await mkdir(path.join(root,'public/source'),{recursive:true});
const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});
await writeFile(path.join(root,'public/source/duetblox-source.zip'),data);
console.log(`DUETBlox source archive: ${(data.length/1048576).toFixed(2)} MiB`);

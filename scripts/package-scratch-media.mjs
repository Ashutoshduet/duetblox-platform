// Mirror the exact media IDs referenced by the pinned official Scratch libraries.
// Normal builds verify the local bundle; acquisition happens only with --download.
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'public/scratch-media');
const acquire=process.argv.includes('--download');
const names=new Set();
function collect(value){if(typeof value==='string'&&/^[a-f\d]{32}\.(svg|png|jpg|jpeg|wav|mp3)$/.test(value))names.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect);}
for(const library of ['sprites','costumes','backdrops','sounds'])collect(JSON.parse(await readFile(path.join(root,`public/scratch/libraries/${library}.json`),'utf8')));
await mkdir(output,{recursive:true});
let previous;try{previous=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));}catch{}
const existing=new Map((previous?.files||[]).map(f=>[f.name,f]));
const pending=[...names].sort(),files=[];let done=0;
async function worker(){while(pending.length){const name=pending.shift(),url=`https://assets.scratch.mit.edu/internalapi/asset/${name}/get/`;let data;try{data=await readFile(path.join(output,name));}catch{}
 if(!data){if(!acquire)throw new Error(`Missing Scratch media ${name}. Run npm run offline:download once.`);for(let attempt=0;attempt<3;attempt++){try{const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error(`HTTP ${res.status}`);data=Buffer.from(await res.arrayBuffer());if(data.length>10*1024*1024||data.length===0)throw new Error('Unexpected asset size');break;}catch(error){if(attempt===2)throw new Error(`${name}: ${error.message}`);}}await writeFile(path.join(output,name),data);}
 const sha256=createHash('sha256').update(data).digest('hex');if(existing.has(name)&&existing.get(name).sha256!==sha256)throw new Error(`Media integrity mismatch: ${name}`);
 files.push({name,bytes:data.length,sha256,url});if(++done%200===0)console.log(`Scratch media verified ${done}/${names.size}`);
}}
await Promise.all(Array.from({length:6},worker));files.sort((a,b)=>a.name.localeCompare(b.name));
const manifest={format:'duetblox-scratch-media',version:1,scratchVersion:'15.2.0',source:'Official pinned Scratch GUI libraries; assets.scratch.mit.edu content-addressed resources',license:'See NOTICE.txt and original library attributions',files};
await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(output,'NOTICE.txt'),`Scratch media library assets — provenance and license information

These unmodified files are the content-addressed resources referenced by the official @scratch/scratch-gui 15.2.0 sprite, costume, backdrop and sound libraries. They were obtained from assets.scratch.mit.edu. manifest.json records each source URL, byte count and SHA-256 digest. Original library names, tags and asset identifiers remain in /scratch/libraries/*.json; those upstream JSON files do not contain per-asset author or license fields.

Scratch is developed by the Scratch Foundation and its partners and affiliates. See https://scratchfoundation.org/.
DUETBlox acknowledges the Scratch Foundation, the historical MIT Scratch Team, and the media contributors. Upstream illustration and sound credits are available at https://scratch.mit.edu/credits and in https://github.com/scratchfoundation/scratch-www/tree/develop/src/views/credits . DUETBlox does not claim ownership of their work.

The official support FAQ says most Scratch support materials are available under Creative Commons Attribution-ShareAlike, with exceptions for named Scratch characters and the logo. It does not specify a version for every asset. The January 22, 2026 Terms of Service, section 7.2, directs users to each material's applicable license; it does not grant a single blanket license to every library item. This notice therefore does not relicense all files as CC BY-SA 2.0 or AGPL. Keep applicable original credits and license conditions when reusing media.

Support FAQ: https://mitscratch.freshdesk.com/en/support/solutions/articles/4000156892-may-i-use-remix-scratch-support-materials-sprites-images-sounds-or-sample-projects-i-ve-found-on
Current terms: https://mitscratch.freshdesk.com/en/support/solutions/articles/4000219182-scratch-terms-of-service
Creative Commons license information: https://creativecommons.org/licenses/

Scratch names, logos and character trademarks have separate restrictions described by the FAQ and section 7.3 of the current terms. Their presence as local educational compatibility media does not grant permission to use them as DUETBlox branding, advertising, or endorsement. DUETBlox is independent of Scratch. This provenance notice is not a determination of rights for every asset; per-asset permission or historical license evidence may be needed before wider redistribution.
`);
console.log(`Verified ${files.length} Scratch media files (${(files.reduce((n,f)=>n+f.bytes,0)/1048576).toFixed(1)} MiB).`);

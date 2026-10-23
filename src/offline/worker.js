/* DUETBlox offline worker. Manifest is injected from the final, hashed build. */
const PACK = __DUET_OFFLINE_MANIFEST__;
const MIRRORS = __DUET_OFFLINE_MIRRORS__;
const CACHE = `duetblox-offline-${PACK.version}`;
const META = '/__duetblox_offline_state__';
const known = new Map(PACK.files.map(f => [new URL(f.url,self.location.origin).href,f]));
let job = null;
const state = async () => { const r=await (await caches.open(CACHE)).match(META); return r?await r.json():{ready:false,offline:false}; };
const saveState = async data => (await caches.open(CACHE)).put(META,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function verifiedResponse(file,{repair=false}={}) {
 const mirror=MIRRORS[file.url];
 const sources=[file.url];
 if(mirror&&mirror.bytes===file.bytes&&mirror.sha256===file.sha256)sources.push(mirror.url);
 let failure;
 for(const url of sources){
  for(let attempt=0;attempt<3;attempt++){
   // Recheck before every attempt: offline mode may change during a backoff.
   // Only an explicit preparation/repair may bypass that network policy.
   if(!repair&&(await state()).offline)throw new Error('DUETBlox offline mode: this file is not saved.');
   let retryable=false;
   try{
    const timeout=typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(60000)}:{};
    let response;
    try{response=await fetch(url,{cache:'no-store',...timeout,...(url!==file.url?{mode:'cors',credentials:'omit',redirect:'error'}:{})});}
    catch(error){retryable=true;throw error;}
    if(!response.ok||response.type==='opaque'){
     retryable=response.type!=='opaque'&&[408,429,500,502,503,504].includes(response.status);
     try{await response.body?.cancel();}catch{}
     throw new Error(`Cannot save ${file.url} (HTTP ${response.status}).`);
    }
    let bytes;
    try{bytes=await response.arrayBuffer();}catch(error){retryable=['TypeError','AbortError','TimeoutError'].includes(error?.name);throw error;}
    if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw new Error(`Downloaded file failed verification: ${file.url}. Keep using the current app and try again after reloading.`);
    const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
    return new Response(bytes,{status:200,headers});
   }catch(error){
    failure=error;
    if(!retryable||attempt===2)break;
    await new Promise(resolve=>setTimeout(resolve,attempt===0?250:750));
   }
  }
 }
 throw failure;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const file of PACK.files.filter(f=>f.shell))await cache.put(file.url,await verifiedResponse(file));
})()));
// Never force an update over a running project. Normal worker activation waits
// until older tabs close; initial installation can claim the first tab.
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function prepare(port) {
 if(job){port.postMessage({type:'error',message:'Offline preparation is already running in another window.'});return;}
 const token={cancelled:false};job=token;
 let completed=0,bytes=0;
 try{
  const cache=await caches.open(CACHE);
  await saveState({...(await state()),ready:false});
  const pending=[...PACK.files];
  async function worker(){while(pending.length&&!token.cancelled){const file=pending.shift();let response=await cache.match(file.url);
   // An explicit repair checks existing bytes too, not just cache-key presence.
   if(response){const content=await response.clone().arrayBuffer();if(content.byteLength!==file.bytes||await digest(content)!==file.sha256)response=null;}
   if(!response){response=await verifiedResponse(file,{repair:true});if(token.cancelled)return;await cache.put(file.url,response);}
   completed++;bytes+=file.bytes;port.postMessage({type:'progress',completed,total:PACK.files.length,bytes,totalBytes:PACK.bytes});
  }}
  await Promise.all(Array.from({length:6},worker));
  if(token.cancelled){port.postMessage({type:'cancelled'});return;}
  await saveState({...(await state()),ready:true,version:PACK.version,completedAt:Date.now()});
  port.postMessage({type:'complete',...(await state()),bytes:PACK.bytes,files:PACK.files.length});
 }catch(error){token.cancelled=true;port.postMessage({type:'error',message:error.message||'Offline preparation failed. Check available storage and try again.'});}
 finally{if(job===token)job=null;}
}
self.addEventListener('message',event=>{
 const port=event.ports?.[0];if(!port)return;
 const run=async()=>{
  try{
   if(event.data?.type==='PREPARE')return await prepare(port);
   if(event.data?.type==='CANCEL'){if(job)job.cancelled=true;port.postMessage({type:'cancelled'});return;}
   if(event.data?.type==='STATUS'){const saved=await state();let ready=saved.ready;
    if(ready){const keys=new Set((await (await caches.open(CACHE)).keys()).map(r=>r.url));ready=PACK.files.every(f=>keys.has(new URL(f.url,self.location.origin).href));if(!ready)await saveState({...saved,ready:false});}
    port.postMessage({type:'status',...saved,ready,offline:!!saved.offline,version:PACK.version,bytes:PACK.bytes,files:PACK.files.length,busy:!!job});return;
   }
   if(event.data?.type==='SET_OFFLINE'){const saved=await state();if(event.data.enabled){const keys=new Set((await (await caches.open(CACHE)).keys()).map(r=>r.url));if(!saved.ready||!PACK.files.every(f=>keys.has(new URL(f.url,self.location.origin).href))){await saveState({...saved,ready:false});throw new Error('Prepare offline files first; some saved files are missing.');}}await saveState({...saved,offline:!!event.data.enabled});port.postMessage({type:'status',...(await state()),bytes:PACK.bytes,files:PACK.files.length,version:PACK.version});return;}
   port.postMessage({type:'error',message:'Unknown offline action.'});
  }catch(error){port.postMessage({type:'error',message:error.message});}
 };
 event.waitUntil(run());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url),normalized=new URL(url.pathname,self.location.origin).href;
 // Local classroom requests are never cached, even when this app is installed.
 // Literal private IPs avoid treating an arbitrary external hostname as a LAN service.
 const host=url.hostname,parts=host.split('.').map(Number);
 const privateHost=['127.0.0.1','localhost','[::1]'].includes(host)||(parts.length===4&&parts.every(p=>Number.isInteger(p)&&p>=0&&p<=255)&&(parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31));
 if(privateHost&&url.pathname.startsWith('/api/classroom/'))return;
 // The authenticated local compiler remains reachable without internet.
 if(url.origin!==self.location.origin&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.port==='8765')return;
 event.respondWith((async()=>{
  const saved=await state();
  if(request.method==='GET'&&url.origin===self.location.origin&&known.has(normalized)){
   const cache=await caches.open(CACHE);const cached=await cache.match(normalized);
   if(cached)return cached;
   if(saved.offline)return new Response('This file is missing from the offline pack. Reconnect and prepare it again.',{status:503});
   if(MIRRORS[known.get(normalized).url]){
    try{const response=await verifiedResponse(known.get(normalized));await cache.put(normalized,response.clone());return response;}
    catch(error){return new Response(error.message||'The verified model file is unavailable. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain'}});}
   }
   return fetch(request);
  }
  if(saved.offline)return new Response('DUETBlox offline mode: this feature requires a network connection.',{status:503,headers:{'Content-Type':'text/plain'}});
  return fetch(request);
 })());
});

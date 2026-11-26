/* DUETBlox offline worker. Manifest is injected from the final, hashed build. */
const PACK = __DUET_OFFLINE_MANIFEST__;
const MIRRORS = __DUET_OFFLINE_MIRRORS__;
const BASE = PACK.basePath || '/';
const CACHE_PREFIX = `duetblox-offline-${encodeURIComponent(BASE)}-`;
const CACHE = `${CACHE_PREFIX}${PACK.version}`;
const META = `${BASE}__duetblox_offline_state__`;
// A malformed build must never store or intercept another application's paths.
if (!BASE.startsWith('/') || !BASE.endsWith('/') || BASE.startsWith('//') || PACK.files.some(file => !file.url.startsWith(BASE) || !new URL(file.url, self.location.origin).pathname.startsWith(BASE) || new URL(file.url, self.location.origin).origin !== self.location.origin)) throw new Error('Offline pack escaped its application scope.');
const known = new Map(PACK.files.map(f => [new URL(f.url,self.location.origin).href,f]));
let job = null;
const state = async () => { const r=await (await caches.open(CACHE)).match(META); return r?await r.json():{ready:false,offline:false}; };
const saveState = async data => (await caches.open(CACHE)).put(META,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const cancelled = () => Object.assign(new Error('Offline preparation cancelled.'),{name:'AbortError'});
const checkCancelled = signal => {if(signal?.aborted)throw cancelled();};
const cleanResponse = (bytes,response) => {const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');return new Response(bytes,{status:200,headers});};
async function verifiedCachedResponse(file,response){
 if(!response?.ok||response.type==='opaque')return null;
 try{const bytes=await response.arrayBuffer();return bytes.byteLength===file.bytes&&await digest(bytes)===file.sha256?cleanResponse(bytes,response):null;}catch{return null;}
}
async function previousPackCaches(){
 // CacheStorage is origin-wide. Only inspect older releases of this exact
 // application mount; never enumerate their contents or alter their state.
 return (await caches.keys()).filter(name=>name!==CACHE&&name.startsWith(CACHE_PREFIX)&&/^[a-f0-9]{20}$/.test(name.slice(CACHE_PREFIX.length))).reverse();
}
async function reusePrevious(file,names,signal){
 for(const name of names){
  checkCancelled(signal);
  try{const response=await verifiedCachedResponse(file,await (await caches.open(name)).match(file.url));if(response)return response;}catch{}
 }
 return null;
}
function attemptSignal(parent){
 const controller=new AbortController();
 const timeout=typeof AbortSignal.timeout==='function'?AbortSignal.timeout(60000):null;
 const expire=()=>controller.abort(Object.assign(new Error('Download deadline exceeded'),{name:'TimeoutError'}));
 const timer=timeout?null:setTimeout(expire,60000);
 const stop=()=>controller.abort(parent.reason);
 const timedOut=()=>controller.abort(timeout.reason);
 if(parent?.aborted)stop();else parent?.addEventListener('abort',stop,{once:true});
 if(timeout?.aborted)timedOut();else timeout?.addEventListener('abort',timedOut,{once:true});
 return {signal:controller.signal,close(){if(timer!==null)clearTimeout(timer);parent?.removeEventListener('abort',stop);timeout?.removeEventListener('abort',timedOut);}};
}
function retryDelay(delay,signal){
 return new Promise((resolve,reject)=>{
  checkCancelled(signal);
  const stop=()=>{clearTimeout(timer);reject(cancelled());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},delay);
  signal?.addEventListener('abort',stop,{once:true});
 });
}
async function verifiedResponse(file,{repair=false,signal,previous,onAttempt}={}) {
 checkCancelled(signal);
 const reused=await reusePrevious(file,previous??await previousPackCaches(),signal);
 checkCancelled(signal);
 if(reused)return reused;
 const mirror=MIRRORS[file.url];
 const sources=[file.url];
 if(mirror&&mirror.bytes===file.bytes&&mirror.sha256===file.sha256)sources.push(mirror.url);
 let failure;
 for(const url of sources){
  for(let attempt=0;attempt<3;attempt++){
   checkCancelled(signal);
   // Recheck before every attempt: offline mode may change during a backoff.
   // Only an explicit preparation/repair may bypass that network policy.
   if(!repair&&(await state()).offline)throw new Error('DUETBlox offline mode: this file is not saved.');
   onAttempt?.({file:file.url,source:new URL(url,self.location.origin).host,attempt:attempt+1});
   let retryable=false,transportFailure=false;
   const deadline=attemptSignal(signal);
   try{
    let response;
    try{response=await fetch(url,{cache:'no-store',signal:deadline.signal,...(url!==file.url?{mode:'cors',credentials:'omit',redirect:'error'}:{})});}
    catch(error){retryable=true;transportFailure=true;throw error;}
    if(!response.ok||response.type==='opaque'){
     retryable=response.type!=='opaque'&&[408,429,500,502,503,504].includes(response.status);
     try{await response.body?.cancel();}catch{}
     throw new Error(`Cannot save ${file.url} from ${new URL(url,self.location.origin).host} (HTTP ${response.status}, attempt ${attempt+1}/3). Completed files are kept; retry preparation when the connection is available.`);
    }
    let bytes;
    try{bytes=await response.arrayBuffer();}catch(error){retryable=['TypeError','AbortError','TimeoutError'].includes(error?.name);transportFailure=true;throw error;}
    checkCancelled(signal);
    if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw new Error(`Downloaded file failed verification: ${file.url}. Keep using the current app and try again after reloading.`);
    return cleanResponse(bytes,response);
   }catch(error){
    checkCancelled(signal);
    const timeout=error?.name==='TimeoutError'||deadline.signal.reason?.name==='TimeoutError';
    failure=transportFailure?new Error(`${timeout?'Download timed out after 60 seconds':'Network download failed'}: ${file.url} from ${new URL(url,self.location.origin).host} (attempt ${attempt+1}/3). Completed files are kept; retry preparation when the connection is available.`):error;
    if(!retryable||attempt===2)break;
    await retryDelay(attempt===0?250:750,signal);
   }finally{deadline.close();}
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
 const token={cancelled:false,controller:new AbortController()};job=token;
 let completed=0,bytes=0;
 try{
  const cache=await caches.open(CACHE);
  const previous=await previousPackCaches();
  await saveState({...(await state()),ready:false});
  const pending=[...PACK.files];
  // Attempts may wait up to 60 seconds without a completed file. Report the
  // unchanged verified totals so the client knows bounded work is still alive.
  const progress=details=>port.postMessage({type:'progress',completed,total:PACK.files.length,bytes,totalBytes:PACK.bytes,...details});
  async function worker(){while(pending.length&&!token.cancelled){const file=pending.shift();let response=await cache.match(file.url);
   // An explicit repair checks existing bytes too, not just cache-key presence.
   if(response)response=await verifiedCachedResponse(file,response);
   if(!response){response=await verifiedResponse(file,{repair:true,signal:token.controller.signal,previous,onAttempt:progress});if(token.cancelled)return;await cache.put(file.url,response);}
   if(token.cancelled)return;
   completed++;bytes+=file.bytes;progress();
  }}
  await Promise.all(Array.from({length:6},worker));
  if(token.cancelled){port.postMessage({type:'cancelled'});return;}
  const beforeCompletion=await state();
  if(token.cancelled){port.postMessage({type:'cancelled'});return;}
  await saveState({...beforeCompletion,ready:true,version:PACK.version,completedAt:Date.now()});
  const completedState=await state();
  // CANCEL can arrive while CacheStorage commits the final metadata. Do not
  // turn that cancelled operation into success or leave a ready marker behind.
  if(token.cancelled){await saveState({...completedState,ready:false});port.postMessage({type:'cancelled'});return;}
  port.postMessage({type:'complete',...completedState,bytes:PACK.bytes,files:PACK.files.length});
 }catch(error){const wasCancelled=token.cancelled;token.cancelled=true;token.controller.abort();port.postMessage(wasCancelled?{type:'cancelled'}:{type:'error',message:error.message||'Offline preparation failed. Check available storage and try again.'});}
 finally{if(job===token)job=null;}
}
self.addEventListener('message',event=>{
 const port=event.ports?.[0];if(!port)return;
 const run=async()=>{
  try{
   if(event.data?.type==='ACTIVATE_UPDATE'){
    // Only the dedicated recovery document may deliberately replace a worker
    // after its saved-work acknowledgement. Ordinary app tabs never activate
    // a waiting release, and a stale page cannot select another pack version.
    const client=event.source?.id?await self.clients.get(event.source.id):null;
    const url=client?.url?new URL(client.url):null;
    if(event.origin!==self.location.origin||client?.type!=='window'||client.frameType!=='top-level'||url?.origin!==self.location.origin||url.pathname!==`${BASE}update.html`||event.data.confirmed!==true||event.data.version!==PACK.version)throw new Error('Confirm this exact update from the DUETBlox update page after saving your work.');
    await self.skipWaiting();
    port.postMessage({type:'activating',version:PACK.version});return;
   }
   if(event.data?.type==='PREPARE')return await prepare(port);
   if(event.data?.type==='CANCEL'){if(job){job.cancelled=true;job.controller.abort();}port.postMessage({type:'cancelled'});return;}
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
 // Scoped pages may request same-origin website resources. Leave them entirely
 // to the browser/main site, even when DUETBlox's offline switch is enabled.
 if(url.origin===self.location.origin&&!url.pathname.startsWith(BASE))return;
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
   // A browser HTTP cache can retain a previous release's fixed file names.
   // Verify every pack asset on its first use, not only mirrored model files,
   // so a current shell cannot silently run an older Scratch bridge.
   try{
    const response=await verifiedResponse(known.get(normalized));
    // A full cache must not prevent an otherwise valid online file loading.
    // STATUS/PREPARE still require every file before claiming offline readiness.
    try{await cache.put(normalized,response.clone());}catch{}
    return response;
   }
   catch(error){return new Response(error.message||'The current app file is unavailable. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain'}});}
  }
  if(saved.offline)return new Response('DUETBlox offline mode: this feature requires a network connection.',{status:503,headers:{'Content-Type':'text/plain'}});
  return fetch(request);
 })());
});

let registrationPromise;
export async function offlineWorker(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)throw new Error('Offline storage needs desktop Chrome/Edge on HTTPS or localhost.');
 if(import.meta.env?.DEV)throw new Error('Offline preparation is available in the production build. Run npm run build, then npm start.');
 if(navigator.serviceWorker.controller){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});return navigator.serviceWorker.controller;}
 if(!registrationPromise)registrationPromise=navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(error=>{registrationPromise=null;throw error;});
 const registration=await registrationPromise;
 // Use the worker already controlling this release. Never activate a replacement
 // while a student has an unsaved project in another window.
 if(navigator.serviceWorker.controller)return navigator.serviceWorker.controller;
 if(registration.active)return registration.active;
 return new Promise((resolve,reject)=>{const worker=registration.installing||registration.waiting;if(!worker){reject(new Error('Offline worker is not ready. Reload and try again.'));return;}
 const timeout=setTimeout(()=>reject(new Error('Offline setup took too long. Reconnect and try again.')),90000);
 const check=()=>{if(worker.state==='activated'){clearTimeout(timeout);resolve(worker);}else if(worker.state==='redundant'){clearTimeout(timeout);reject(new Error('Offline setup could not verify this build. Reload and try again.'));}};worker.addEventListener('statechange',check);check();});
}
export async function offlineCommand(type,data={},onProgress){
 const worker=await offlineWorker();return new Promise((resolve,reject)=>{const channel=new MessageChannel();let timer;
 const finish=(fn,value)=>{clearTimeout(timer);channel.port1.close();fn(value);};
 const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(reject,new Error('Offline storage stopped responding. Check the Offline page before retrying.')),90000);};reset();
 channel.port1.onmessage=event=>{reset();const message=event.data;if(message.type==='progress'){onProgress?.(message);return;}if(message.type==='error')finish(reject,new Error(message.message));else {if(['status','complete'].includes(message.type))window.dispatchEvent(new CustomEvent('duetblox:offline-status',{detail:message}));finish(resolve,message);}};
 worker.postMessage({type,...data},[channel.port2]);});
}

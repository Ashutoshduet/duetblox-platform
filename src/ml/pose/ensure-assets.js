import {offlineWorker} from '../../offline/client.js';

// The public build can obtain large pinned checkpoints through its offline worker.
// Wait for control before PoseNet starts its parallel weight requests on first use.
export async function ensurePoseAssets(settings,{serviceWorker=globalThis.navigator?.serviceWorker,secure=globalThis.isSecureContext,development=import.meta.env?.DEV,register=offlineWorker,timeout=15000}={}){
  if(settings.architecture!=='ResNet50'||development||!secure||!serviceWorker)return;
  await register();
  if(serviceWorker.controller)return;
  await new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);serviceWorker.removeEventListener('controllerchange',check);};
    const check=()=>{if(serviceWorker.controller){cleanup();resolve();}};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Pose model files are still preparing. Reload DUETBlox and import the pose model again.'));},timeout);
    serviceWorker.addEventListener('controllerchange',check);check();
  });
}

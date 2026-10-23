import {appPath} from '../app-paths.js';

// Local copies of the exact upstream checkpoints used by the pinned TM runtimes.
// Asset hashes and original URLs: public/models/manifest.json.
const MODEL_ROOT=appPath('/models/');
export const IMAGE_MODEL_OPTIONS=Object.freeze({
  checkpointUrl:`${MODEL_ROOT}image/mobilenet-v2-035/model.json`,
  trainingLayer:'out_relu'
});
export const SOUND_MODEL_URL=`${MODEL_ROOT}sound/speech-18w/model.json`;
export const SOUND_METADATA_URL=`${MODEL_ROOT}sound/speech-18w/metadata.json`;

// speech-commands 0.4.0 accepts only explicit http(s) schemes for metadata.
// Resolve from the app origin at call time so imports still work outside a browser.
export function localSoundURLs(origin=globalThis.location?.origin){
  let base;try{base=new URL(origin);}catch{throw new Error('Open DUETBlox on HTTPS or localhost to load the local sound model.');}
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/'||base.search||base.hash)
    throw new Error('The sound model needs a valid HTTP or HTTPS app origin.');
  return {modelURL:new URL(SOUND_MODEL_URL,base).href,metadataURL:new URL(SOUND_METADATA_URL,base).href};
}

/** Never trust modelUrl in imported metadata. Match a bundled architecture exactly. */
export function localPoseConfig(settings){
  const c=settings||{},architecture=c.architecture;
  const outputStride=c.outputStride,inputResolution=c.inputResolution;
  if(!Number.isInteger(inputResolution)||inputResolution<129||inputResolution>513)
    throw new Error('Use a PoseNet input resolution from 129 to 513.');
  let multiplier,modelUrl;
  if(architecture==='MobileNetV1'){
    multiplier=c.multiplier??1;
    if(![.5,.75,1].includes(multiplier)||![8,16].includes(outputStride))
      throw new Error('Use a MobileNetV1 PoseNet model with multiplier 0.5, 0.75 or 1 and stride 8 or 16. The upstream stride-32 checkpoint is unavailable.');
    modelUrl=`${MODEL_ROOT}pose/mobilenet-${multiplier*100}/model-stride${outputStride}.json`;
  }else if(architecture==='ResNet50'){
    multiplier=c.multiplier??1;
    if(multiplier!==1||![16,32].includes(outputStride))
      throw new Error('Use a ResNet50 PoseNet model with multiplier 1 and stride 16 or 32.');
    modelUrl=`${MODEL_ROOT}pose/resnet50/model-stride${outputStride}.json`;
  }else throw new Error('Use a Teachable Machine MobileNetV1 or ResNet50 pose model.');
  // Older TM exports do not specify quantization. The original loader used float32.
  // Keeping that behavior also keeps saved classifier feature distributions unchanged.
  return {architecture,outputStride,inputResolution,multiplier,quantBytes:4,modelUrl};
}

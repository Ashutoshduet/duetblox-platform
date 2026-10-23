export const BACKGROUND_ID='__background__';
export const OBJECT_ALGORITHM='mobilenet-sliding-window-v1';
export async function objectImageHash(record){const data=new TextEncoder().encode(record.dataUrl),bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export function defaultObjectDataset(){return {kind:'duetblox-objects-dataset',version:1,classes:[{id:'object-1',name:'Object 1'}],images:[]};}
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const identifier=id=>typeof id==='string'&&id.length>0&&id.length<=80;
export function validateObjectDataset(data,{training=false}={}){
  if(data?.kind!=='duetblox-objects-dataset'||data.version!==1||!Array.isArray(data.classes)||data.classes.length<1||data.classes.length>6||!Array.isArray(data.images)||data.images.length>30)throw new Error('Use an object dataset with 1–6 classes and at most 30 images.');
  const ids=new Set(),names=new Set();
  for(const c of data.classes){const name=c?.name?.trim();if(!identifier(c?.id)||c.id===BACKGROUND_ID||ids.has(c.id)||typeof name!=='string'||!name||name.length>40||names.has(name.toLowerCase())||['background',BACKGROUND_ID].includes(name.toLowerCase()))throw new Error('Give object classes unique names (1–40 characters); Background is reserved.');ids.add(c.id);names.add(name.toLowerCase());}
  ids.add(BACKGROUND_ID);const imageIds=new Set(),counts=new Map([...ids].map(id=>[id,0]));let boxes=0,characters=0;
  for(const image of data.images){
    if(!identifier(image?.id)||imageIds.has(image.id)||typeof image.name!=='string'||image.name.length>150||!['train','test'].includes(image.split)||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<16||image.height<16||image.width>1024||image.height>1024||typeof image.dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl)||image.dataUrl.length>1000000||!Array.isArray(image.boxes))throw new Error('An object image is invalid. Use local JPEG, PNG or WebP images up to 1024 pixels and 1 MB after resizing.');
    if(Math.max(image.width,image.height)/Math.min(image.width,image.height)>4)throw new Error('Use object photos with an aspect ratio no wider or taller than 4:1. Crop very wide panoramas first.');imageIds.add(image.id);characters+=image.dataUrl.length;if(characters>20000000)throw new Error('Object images exceed the 20 MB dataset limit.');
    const boxIds=new Set();for(const box of image.boxes){if(!identifier(box?.id)||boxIds.has(box.id)||!ids.has(box.classId)||!['x','y','width','height'].every(key=>finite(box[key]))||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.000001||box.y+box.height>1.000001)throw new Error('Every object box needs a class and valid bounds inside its image.');boxIds.add(box.id);if(image.split==='train')counts.set(box.classId,counts.get(box.classId)+1);if(++boxes>200)throw new Error('Use at most 200 labeled boxes.');}
  }
  if(training){
    for(const [id,count]of counts)if(count<3)throw new Error(`Draw at least 3 training boxes for ${id===BACKGROUND_ID?'Background':data.classes.find(c=>c.id===id).name}. Use varied images.`);
    const trainImages=new Set(data.images.filter(i=>i.split==='train').map(i=>i.dataUrl));
    if(data.images.some(i=>i.split==='test'&&trainImages.has(i.dataUrl)))throw new Error('The same image appears in both training and holdout sets. Use a different image for testing.');
  }
  return data;
}
export function validateObjectMetadata(metadata){
  const object=metadata?.duetbloxObjects;
  if(object?.version!==1||object.algorithm!==OBJECT_ALGORITHM||!finite(object.minimumConfidence)||object.minimumConfidence<0||object.minimumConfidence>1||!Array.isArray(object.trainingImageHashes)||!object.trainingImageHashes.length||object.trainingImageHashes.length>30||object.trainingImageHashes.some(hash=>typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))||new Set(object.trainingImageHashes).size!==object.trainingImageHashes.length)throw new Error('This is not a supported DUETBlox object-finder model with training-image provenance.');
  validateObjectDataset({kind:'duetblox-objects-dataset',version:1,classes:object.classes,images:[]});
  const expected=[BACKGROUND_ID,...object.classes.map(c=>c.name.trim())];
  if(!Array.isArray(metadata.labels)||expected.length!==metadata.labels.length||expected.some((name,i)=>name!==metadata.labels[i]))throw new Error('The object model labels do not match its class metadata and Background order.');
  return {version:1,algorithm:OBJECT_ALGORITHM,minimumConfidence:object.minimumConfidence,trainingImageHashes:[...object.trainingImageHashes],classes:object.classes.map(c=>({id:c.id,name:c.name.trim()}))};
}
export function validateObjectNetworkShape(model,labelCount){
  const input=model.inputs?.[0],output=model.outputs?.[0];
  if(model.inputs?.length!==1||model.outputs?.length!==1||input.dtype!=='float32'||output.dtype!=='float32'||input.shape?.length!==4||![null,1].includes(input.shape[0])||input.shape[1]!==224||input.shape[2]!==224||input.shape[3]!==3||output.shape?.length!==2||![null,1].includes(output.shape[0])||output.shape[1]!==labelCount)throw new Error('Object models need one float32 [1,224,224,3] input and one float32 class-score output.');
}
export function validateObjectScores(scores,labels){if(!Array.isArray(scores)||scores.length!==labels.length||scores.some((score,i)=>score.className!==labels[i]||!finite(score.probability)||score.probability<0||score.probability>1)||Math.abs(scores.reduce((sum,s)=>sum+s.probability,0)-1)>.01)throw new Error('The object model returned invalid class scores.');return scores;}
export function intersectionOverUnion(a,b){const width=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)),intersection=width*height;return intersection/(a.width*a.height+b.width*b.height-intersection)||0;}
export function suppressOverlaps(boxes,{threshold=.3,maximum=10}={}){
  const kept=[];for(const box of [...boxes].sort((a,b)=>b.confidence-a.confidence)){if(kept.some(other=>other.classId===box.classId&&intersectionOverUnion(box,other)>threshold))continue;kept.push(box);if(kept.length>=maximum)break;}return kept;
}
export function scanWindows(width,height){
  if(!finite(width)||!finite(height)||width<=0||height<=0)throw new Error('Choose a valid test image first.');
  if(Math.max(width,height)/Math.min(width,height)>4)throw new Error('Use an image with an aspect ratio no wider or taller than 4:1.');
  const windows=[];
  for(const scale of [1,.65,.4]){const side=Math.min(width,height)*scale;
    const positions=maximum=>{if(maximum<.001)return [0];const steps=Math.ceil(maximum/(side*.25)-1e-10)+1;return Array.from({length:steps},(_,i)=>maximum*i/(steps-1));};
    for(const y of positions(height-side))for(const x of positions(width-side))windows.push({x:x/width,y:y/height,width:side/width,height:side/height});
  }
  if(windows.length>400)throw new Error('This image exceeds the 400-window scan budget. Crop it to a less extreme aspect ratio.');
  return windows;
}
export function evaluateDetections(predictions,truth,{iouThreshold=.5}={}){
  const targets=truth.filter(box=>box.classId!==BACKGROUND_ID),used=new Set(),matches=[];let truePositive=0;
  for(const prediction of [...predictions].sort((a,b)=>b.confidence-a.confidence)){let best=-1,bestIoU=0;
    targets.forEach((box,index)=>{if(used.has(index)||box.classId!==prediction.classId)return;const iou=intersectionOverUnion(prediction,box);if(iou>bestIoU){best=index;bestIoU=iou;}});
    const matched=best>=0&&bestIoU>=iouThreshold;if(matched){used.add(best);truePositive++;}matches.push({className:prediction.label,confidence:prediction.confidence,iou:bestIoU,matched});
  }
  const falsePositive=predictions.length-truePositive,falseNegative=targets.length-truePositive;
  return {truePositive,falsePositive,falseNegative,precision:truePositive/(truePositive+falsePositive)||0,recall:truePositive/(truePositive+falseNegative)||0,iouThreshold,matches};
}

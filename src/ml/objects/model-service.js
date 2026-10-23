import {ownArtifactMetadata} from '../artifact-ownership.js';
import {readRecord,writeRecord} from '../../storage.js';
import {ImageModelService} from '../model-service.js';
import {IMAGE_MODEL_OPTIONS} from '../local-models.js';
import {BACKGROUND_ID,OBJECT_ALGORITHM,defaultObjectDataset,validateObjectDataset,validateObjectMetadata,validateObjectNetworkShape,validateObjectScores,scanWindows,suppressOverlaps,evaluateDetections,objectImageHash} from './model.js';
import {decodedObjectImage,objectCrop} from './images.js';
export {defaultObjectDataset,validateObjectDataset} from './model.js';
let libraries;const libs=()=>libraries??=Promise.all([import('@tensorflow/tfjs'),import('@teachablemachine/image')]).then(([tf,tm])=>({tf,tm}));
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export class ObjectModelService extends ImageModelService{
  constructor({read=readRecord,write=writeRecord}={}){super();this.read=read;this.write=write;this.dataset=null;this.testRecord=null;this.imageEpoch=0;this.state={...this.state,message:'Draw boxes around your objects and background.',detections:[],inputReady:false,minimumConfidence:.8,evaluation:null};}
  beginWorkspaceImport(){const token=this.beginOperation('Opening workspace object finder…');this.clearInput();this.workspaceToken=token;return token;}
  endWorkspaceImport(token,error){if(token===this.workspaceToken&&!error)this.update({message:this.model?'Workspace object finder ready. Choose a test image.':'Draw boxes around your objects and background.'});return this.endOperation(token,error);}
  async restore(){const epoch=this.operationEpoch;if(this.operation||this.model)return false;try{const artifact=await this.read('objects-model');if(this.operation||this.model||this.operationEpoch!==epoch)return false;if(artifact){await this.importArtifact(artifact,false);return true;}return false;}catch(error){if(!this.operation&&this.operationEpoch===epoch)this.update({message:'Saved object finder could not be restored. Import or train it again.',error:error.message});return false;}}
  clearResults(){this.update({detections:[],evaluation:null});}
  clearInput(){this.imageEpoch++;this.testImage=null;this.testRecord=null;this.update({detections:[],evaluation:null,inputReady:false});}
  cancelTraining(){this.cancelRequested=true;if(this.trainingModel?.trainingModel)this.trainingModel.trainingModel.stopTraining=true;this.clearResults();this.update({message:'Stopping after the current training or scan step…'});}
  async setTestImage(record){this.assertIdle();this.clearInput();const epoch=this.imageEpoch,operationEpoch=this.operationEpoch,model=this.model;const image=await decodedObjectImage(record);if(this.imageEpoch!==epoch||this.operationEpoch!==operationEpoch||this.model!==model)throw new Error('Test-image loading was cancelled.');this.testImage=image;this.testRecord=record;this.update({inputReady:true,message:'Test image ready. Choose Find objects to scan it.'});return true;}
  async artifactFor(model,minimumConfidence=this.state.minimumConfidence){
    const {tf}=await libs();let artifact;
    await model.model.save(tf.io.withSaveHandler(async data=>{artifact={format:'duetblox-objects-model',version:1,modelTopology:data.modelTopology,weightSpecs:data.weightSpecs,weightData:data.weightData,metadata:structuredClone({...model.getMetadata(),duetbloxObjects:{version:1,algorithm:OBJECT_ALGORITHM,classes:model._duetObjects.classes,trainingImageHashes:model._duetObjects.trainingImageHashes,minimumConfidence}})};return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON',modelTopologyBytes:0,weightSpecsBytes:0,weightDataBytes:data.weightData.byteLength}};}));return artifact;
  }
  async exportArtifact(){return this.model?this.artifactFor(this.model):null;}
  async prepareArtifact(artifact){
    artifact=ownArtifactMetadata(artifact);
    if(artifact?.format!=='duetblox-objects-model'||artifact.version!==1||!artifact.modelTopology||!Array.isArray(artifact.weightSpecs)||!(artifact.weightData instanceof ArrayBuffer)||artifact.weightData.byteLength>30*1024*1024)throw new Error('Use a complete DUETBlox object-finder model smaller than 30 MB.');
    const settings=validateObjectMetadata(artifact.metadata),{tf,tm}=await libs();const layers=await tf.loadLayersModel(tf.io.fromMemory(artifact.modelTopology,artifact.weightSpecs,artifact.weightData));let candidate;
    try{validateObjectNetworkShape(layers,artifact.metadata.labels.length);candidate=new tm.CustomMobileNet(layers,artifact.metadata);this.validateModel(candidate);candidate._duetObjects=settings;const probe=document.createElement('canvas');probe.width=probe.height=224;validateObjectScores(await candidate.predict(probe),artifact.metadata.labels);return candidate;}catch(error){if(candidate)this.disposeModel(candidate);else layers.dispose();throw error;}
  }
  async replaceModel(candidate){
    const settings=validateObjectMetadata({...candidate.getMetadata(),duetbloxObjects:candidate._duetObjects});
    if(this.predicting)await this.predicting.catch(()=>{});const old=this.model;this.model=candidate;this.clearInput();this.update({labels:settings.classes.map(c=>c.name),minimumConfidence:settings.minimumConfidence,error:null,metrics:null});if(old&&old!==candidate)this.disposeModel(old);
  }
  async importArtifact(artifact,persist=true){artifact=ownArtifactMetadata(artifact);const token=this.beginOperation('Opening object-finder model…');let candidate;try{candidate=await this.prepareArtifact(artifact);if(persist)await this.write('objects-model',artifact);await this.replaceModel(candidate);candidate=null;this.update({message:'Object finder loaded. Choose a test image.'});}catch(error){this.update({message:error.message,error:error.message});throw error;}finally{if(candidate)this.disposeModel(candidate);this.endOperation(token);}}
  async persist(){await this.write('objects-model',await this.exportArtifact());}
  async train(dataset,{epochs=20}={}){
    const data=structuredClone(dataset);validateObjectDataset(data,{training:true});if(!Number.isInteger(epochs)||epochs<1||epochs>100)throw new Error('Choose 1–100 object training epochs.');
    const token=this.beginOperation('Loading local image features…');this.cancelRequested=false;this.clearResults();let candidate;
    try{
      const {tm}=await libs(),labels=[BACKGROUND_ID,...data.classes.map(c=>c.name.trim())];
      candidate=await tm.createTeachable({labels,modelName:'DUETBlox experimental object finder'},IMAGE_MODEL_OPTIONS);this.trainingModel=candidate;candidate.setLabels(labels);candidate.setSeed('duetblox-objects-v1');candidate._duetObjects={version:1,algorithm:OBJECT_ALGORITHM,classes:data.classes.map(c=>({id:c.id,name:c.name.trim()})),minimumConfidence:this.state.minimumConfidence,trainingImageHashes:[...new Set(await Promise.all(data.images.filter(i=>i.split==='train'&&i.boxes.length).map(objectImageHash)))]};
      const total=data.images.filter(i=>i.split==='train').reduce((n,i)=>n+i.boxes.length,0);let count=0;
      for(const record of data.images.filter(i=>i.split==='train')){const image=await decodedObjectImage(record);for(const box of record.boxes){if(this.cancelRequested)throw new Error('Object training cancelled.');const index=box.classId===BACKGROUND_ID?0:1+data.classes.findIndex(c=>c.id===box.classId);await candidate.addExample(index,objectCrop(image,box));this.update({phase:'extracting',progress:++count/total*.4,message:`Learning labeled crop ${count} of ${total}…`});await nextFrame();}}
      if(this.cancelRequested)throw new Error('Object training cancelled.');candidate.prepare();this.update({phase:'training',message:'Training your crop classifier…'});
      await candidate.train({denseUnits:64,epochs,learningRate:.001,batchSize:Math.min(16,Math.max(2,Math.floor(total*.7)))},{onEpochEnd:async(epoch,logs)=>{this.update({phase:'training',progress:.4+.6*(epoch+1)/epochs,message:`Training epoch ${epoch+1} of ${epochs}`,metrics:{loss:logs.loss,accuracy:logs.acc??logs.accuracy}});if(this.cancelRequested)candidate.trainingModel.stopTraining=true;await nextFrame();}});
      if(this.cancelRequested)throw new Error('Object training cancelled.');const artifact=await this.artifactFor(candidate);await this.write('objects-model',artifact);await this.replaceModel(candidate);candidate=null;this.dataset=data;this.update({progress:1,message:'Crop classifier trained. Test localization on a separate image.'});
    }catch(error){this.update({message:error.message,error:error.message});throw error;}finally{this.trainingModel=null;if(candidate)this.disposeModel(candidate);this.endOperation(token);}
  }
  async scan(image,model=this.model,onProgress=()=>{}){
    const classes=model._duetObjects.classes,windows=scanWindows(image.naturalWidth||image.width,image.naturalHeight||image.height),candidates=[];
    for(let index=0;index<windows.length;index++){
      if(this.cancelRequested)throw new Error('Object scan cancelled.');const box=windows[index],scores=validateObjectScores(await model.predict(objectCrop(image,box)),[BACKGROUND_ID,...classes.map(c=>c.name)]);const top=[...scores].sort((a,b)=>b.probability-a.probability)[0];
      if(top?.className!==BACKGROUND_ID&&top?.probability>=this.state.minimumConfidence){const label=classes.find(c=>c.name===top.className);if(label)candidates.push({...box,classId:label.id,label:label.name,confidence:top.probability});}
      onProgress((index+1)/windows.length,index+1,windows.length);await nextFrame();
    }
    return suppressOverlaps(candidates,{threshold:.3,maximum:10});
  }
  async detect(){
    this.clearResults();this.assertIdle();if(!this.model)throw new Error('Train or import an object finder first.');if(!this.testImage)throw new Error('Choose a test image in Object learning first.');
    const token=this.beginOperation('Scanning the selected test image…');this.cancelRequested=false;const epoch=this.imageEpoch;
    try{const boxes=await this.scan(this.testImage,this.model,(progress,n,total)=>this.update({phase:'predicting',progress,message:`Checking window ${n} of ${total}…`}));if(epoch!==this.imageEpoch||this.cancelRequested)throw new Error('Object scan cancelled.');this.update({detections:boxes,message:`Found ${boxes.length} candidate object${boxes.length===1?'':'s'}. Check the boxes before using the result.`});return boxes;}catch(error){this.clearResults();this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}
  }
  async evaluate(dataset){
    validateObjectDataset(dataset);this.clearResults();this.assertIdle();if(!this.model)throw new Error('Train an object finder first.');const tests=dataset.images.filter(i=>i.split==='test');if(!tests.length)throw new Error('Add a separate Holdout image and label every target object first. Leave background-only holdout photos without target boxes.');
    const trainData=new Set(dataset.images.filter(i=>i.split==='train').map(i=>i.dataUrl));if(tests.some(i=>trainData.has(i.dataUrl)))throw new Error('Use different images for training and holdout testing.');const modelClasses=this.model._duetObjects.classes;if(dataset.classes.length!==modelClasses.length||dataset.classes.some(c=>!modelClasses.some(m=>m.id===c.id&&m.name===c.name.trim())))throw new Error('Object classes changed. Train again before evaluating.');
    const token=this.beginOperation('Evaluating separate holdout images…');this.cancelRequested=false;const rows=[];
    try{const trainingHashes=new Set(this.model._duetObjects.trainingImageHashes);for(const record of tests)if(trainingHashes.has(await objectImageHash(record)))throw new Error('A holdout image was used to train this model. Choose a genuinely separate photo, even if you changed its split later.');for(let i=0;i<tests.length;i++){const image=await decodedObjectImage(tests[i]),boxes=await this.scan(image,this.model,p=>this.update({phase:'predicting',progress:(i+p)/tests.length,message:`Holdout image ${i+1} of ${tests.length}…`}));rows.push({imageId:tests[i].id,name:tests[i].name,...evaluateDetections(boxes,tests[i].boxes)});}
      if(this.cancelRequested)throw new Error('Object evaluation cancelled.');const sums=rows.reduce((a,r)=>({truePositive:a.truePositive+r.truePositive,falsePositive:a.falsePositive+r.falsePositive,falseNegative:a.falseNegative+r.falseNegative}),{truePositive:0,falsePositive:0,falseNegative:0});const evaluation={...sums,precision:sums.truePositive/(sums.truePositive+sums.falsePositive)||0,recall:sums.truePositive/(sums.truePositive+sums.falseNegative)||0,iouThreshold:.5,rows};this.update({evaluation,message:`Holdout localization check finished on ${rows.length} images.`});return evaluation;
    }catch(error){this.clearResults();this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}
  }
  async setMinimumConfidence(percent){const value=Number(percent);if(!Number.isFinite(value)||value<0||value>100)throw new Error('Object confidence must be 0–100.');const token=this.beginOperation('Saving object confidence…');try{if(this.model){await this.write('objects-model',await this.artifactFor(this.model,value/100));this.model._duetObjects={...this.model._duetObjects,minimumConfidence:value/100};}this.update({minimumConfidence:value/100,detections:[],evaluation:null});}finally{this.endOperation(token);}}
  async clear(token,{persist=true}={}){const owned=token===undefined,operation=owned?this.beginOperation('Clearing object finder…'):token;if(!owned&&(!token||token!==this.operation||token!==this.workspaceToken))throw new Error('The workspace import operation is no longer active.');try{if(persist)await this.write('objects-model',null);const old=this.model;this.model=null;this.disposeModel(old);this.clearInput();this.update({labels:[],progress:0,minimumConfidence:.8,metrics:null,error:null,message:'Draw boxes around your objects and background.'});}finally{if(owned)this.endOperation(operation);}}
  objectAt(index){const n=Number(index??1);if(!Number.isInteger(n)||n<1||n>this.state.detections.length)throw new Error('That object number is unavailable. Run Find objects and check the object count first.');return this.state.detections[n-1];}
  async rpc(method,args=[]){switch(method){case'isReady':return Boolean(this.model);case'inputReady':return this.state.inputReady;case'detect':return(await this.detect()).length;case'count':return args[0]&&args[0]!=='all'?this.state.detections.filter(b=>b.label===String(args[0])).length:this.state.detections.length;case'label':return this.objectAt(args[0]).label;case'confidence':return this.objectAt(args[0]).confidence*100;case'x':return this.objectAt(args[0]).x*100;case'y':return this.objectAt(args[0]).y*100;case'width':return this.objectAt(args[0]).width*100;case'height':return this.objectAt(args[0]).height*100;case'setMinimumConfidence':await this.setMinimumConfidence(args[0]);return true;default:throw new Error('Unknown object-learning command.');}}
}
export const objectModel=new ObjectModelService();

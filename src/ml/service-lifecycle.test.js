import test from 'node:test';
import assert from 'node:assert/strict';
import {ImageModelService} from './model-service.js';
import {ModelService,artifactFromFiles} from './audio/common.js';
import JSZip from 'jszip';

class TestModelService extends ModelService {
  constructor(){super('sound');}
  labels(model){return model.labels;}
  disposeModel(model){this.disposedModel=model;}
  stopInput(){}
}
test('prediction policy affects blocks while preserving raw scores and rolls back failed persistence',async()=>{
  for(const service of [new ImageModelService(),new TestModelService()]){
    service.update({predictions:[{className:'Cat',probability:.6},{className:'Dog',probability:.4}]});
    assert.equal(await service.rpc('label'),'Unknown');
    assert.equal(await service.rpc('isAccepted'),false);
    assert.equal(await service.rpc('confidence'),60);
    await service.setPredictionPolicy({minimumConfidence:.5,minimumMargin:.1},{persist:false});
    assert.equal(await service.rpc('label'),'Cat');
    service.model={};service.persist=async()=>{throw new Error('Storage full');};
    await assert.rejects(service.setPredictionPolicy({minimumConfidence:.9,minimumMargin:.1}),/Storage full/);
    assert.equal(service.state.predictionPolicy.minimumConfidence,.5);
    assert.equal(service.state.busy,false);
    const lock=service.beginOperation('Evaluation');
    await assert.rejects(service.setPredictionPolicy({minimumConfidence:.2}),/Wait/);
    service.endOperation(lock);
  }
});
test('invalid imported prediction settings never replace the current model',async()=>{
  for(const service of [new ImageModelService(),new TestModelService()]){
    const old={name:'old'};service.model=old;
    const invalid={labels:['A','B'],getClassLabels:()=>['A','B'],getMetadata:()=>({duetbloxDecision:{minimumConfidence:2}})};
    await assert.rejects(service.replaceModel(invalid),/between 0 and 1/);
    assert.equal(service.model,old);
  }
});
test('image prediction rejects an operation lock before invoking a model',async()=>{
  const service=new ImageModelService();let calls=0;service.model={predict(){calls++;}};
  const token=service.beginOperation('Import');await assert.rejects(service.predict({}),/Wait/);
  assert.equal(calls,0);service.endOperation(token);
});
test('sound and pose imports reserve model ownership before awaiting files or network',async()=>{
  for(const kind of ['sound','pose']){
    const service=new TestModelService();service.kind=kind;let release;
    service.prepareArtifact=async artifact=>artifact;service.persist=async()=>{};
    const loading=service.loadArtifact(()=>new Promise(resolve=>{release=resolve;}));
    assert.equal(service.state.busy,true);
    assert.throws(()=>service.beginWorkspaceImport(),/Wait/);
    await assert.rejects(service.importArtifact({labels:['Other','Old']}),/Wait/);
    release({labels:['A','B']});await loading;
    assert.deepEqual(service.state.labels,['A','B']);assert.equal(service.state.busy,false);
    await assert.rejects(service.loadArtifact(async()=>{throw new Error('Download failed');}),/Download failed/);
    assert.equal(service.state.busy,false);assert.deepEqual(service.state.labels,['A','B']);
  }
});
test('cancelled image camera permission closes late stream without activating a camera',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let accept,stopped=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{accept=resolve;})}}});
  try{
    const service=new ImageModelService();const starting=service.startCamera();
    await assert.rejects(service.startCamera(),/already being requested/);
    service.stopCamera();accept({getTracks:()=>[{stop(){stopped++;}}]});
    await assert.rejects(starting,/cancelled/);
    assert.equal(stopped,1);assert.equal(service.state.camera,false);assert.equal(service.stream,null);assert.equal(service.inputStarting,false);
  }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
test('model ZIP aggregate size is rejected before weight decompression',async()=>{
  const zip=new JSZip();zip.file('model.json','{}');zip.file('metadata.json','{}');zip.file('one.bin','x');zip.file('two.bin','x');
  const bytes=await zip.generateAsync({type:'uint8array'}),view=new DataView(bytes.buffer);
  for(let offset=0;offset<bytes.length-46;offset++)if(view.getUint32(offset,true)===0x02014b50){
    const name=new TextDecoder().decode(bytes.subarray(offset+46,offset+46+view.getUint16(offset+28,true)));
    if(name.endsWith('.bin'))view.setUint32(offset+24,60000000,true);
  }
  bytes.name='model.zip';bytes.size=bytes.length;
  await assert.rejects(artifactFromFiles([bytes]),/Expanded model ZIP exceeds/);
});

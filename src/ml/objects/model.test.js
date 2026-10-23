import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKGROUND_ID,OBJECT_ALGORITHM,defaultObjectDataset,validateObjectDataset,validateObjectMetadata,validateObjectNetworkShape,validateObjectScores,intersectionOverUnion,scanWindows,suppressOverlaps,evaluateDetections,objectImageHash} from './model.js';
import {ObjectModelService} from './model-service.js';
const box=(id,classId='object-1',x=.1,y=.1,width=.4,height=.4)=>({id,classId,x,y,width,height});
const image=(id='a',split='train')=>({id,name:'photo.png',dataUrl:`data:image/png;base64,${id==='a'?'AAAA':'BBBB'}`,width:100,height:100,split,boxes:[box('p1'),box('p2'),box('p3'),box('b1',BACKGROUND_ID),box('b2',BACKGROUND_ID),box('b3',BACKGROUND_ID)]});
test('object annotations validate exact bounds, classes, limits and distinct holdout images',()=>{
  const data={...defaultObjectDataset(),images:[image()]};assert.equal(validateObjectDataset(data,{training:true}),data);
  for(const replacement of [{...data,classes:[]},{...data,classes:[...data.classes,{id:'b',name:'Object 1'}]},{...data,images:[{...image(),boxes:[box('b','unknown')]}]},{...data,images:[{...image(),boxes:[box('b','object-1',.9,0,.5,.5)]}]},{...data,images:[{...image(),dataUrl:'https://example.com/photo.png'}]}])assert.throws(()=>validateObjectDataset(replacement));
  assert.throws(()=>validateObjectDataset({...data,images:[{...image(),boxes:[box('p')]}]},{training:true}),/at least 3/);
  assert.throws(()=>validateObjectDataset({...data,images:[image(),{...image('b','test'),dataUrl:image().dataUrl}]},{training:true}),/same image/);
});
test('artifact class order must include the reserved background before learned labels',()=>{
  const metadata={labels:[BACKGROUND_ID,'Object 1'],duetbloxObjects:{version:1,algorithm:OBJECT_ALGORITHM,minimumConfidence:.8,classes:defaultObjectDataset().classes,trainingImageHashes:['a'.repeat(64)]}};
  assert.equal(validateObjectMetadata(metadata).classes[0].id,'object-1');assert.throws(()=>validateObjectMetadata({...metadata,labels:['Object 1',BACKGROUND_ID]}),/order/);assert.throws(()=>validateObjectMetadata({...metadata,duetbloxObjects:{...metadata.duetbloxObjects,minimumConfidence:NaN}}));
});
test('scan is deterministic, bounded and stays inside square, portrait and landscape images',()=>{
  for(const [width,height,count]of [[640,480,104],[480,640,104],[400,400,66],[1024,256,360]]){const windows=scanWindows(width,height);assert.equal(windows.length,count);for(const window of windows){assert.ok(window.x>=0&&window.y>=0&&window.x+window.width<=1.000001&&window.y+window.height<=1.000001);assert.ok(Math.abs(window.width*width-window.height*height)<.000001);}assert.deepEqual(windows,scanWindows(width,height));}
  assert.throws(()=>scanWindows(0,1));assert.throws(()=>scanWindows(1024,16),/4:1/);
});
test('NMS removes same-class overlapping candidates without suppressing another class',()=>{
  const a={...box('a'),confidence:.9},b={...box('b'),confidence:.7},c={...box('c','other'),confidence:.8};assert.equal(intersectionOverUnion(a,b),1);assert.equal(intersectionOverUnion(a,box('d','object-1',.7,.7,.1,.1)),0);assert.deepEqual(suppressOverlaps([b,c,a]).map(b=>b.id),['a','c']);
});
test('holdout matching counts duplicates, incorrect classes, missed objects and background correctly',()=>{
  const truth=[box('a'),box('b','other',.5,.5,.4,.4),box('bg',BACKGROUND_ID,.8,0,.2,.2)],predictions=[{...box('a'),confidence:.9,label:'Object 1'},{...box('duplicate'),confidence:.8,label:'Object 1'},{...box('wrong','wrong',.5,.5,.4,.4),confidence:.8,label:'Wrong'}];
  const report=evaluateDetections(predictions,truth);assert.equal(report.truePositive,1);assert.equal(report.falsePositive,2);assert.equal(report.falseNegative,1);assert.equal(report.precision,1/3);assert.equal(report.recall,.5);assert.equal(report.matches[0].iou,1);
});
test('failed or cancelled scans clear stale boxes and reject unavailable reporter indices',async()=>{
  const service=new ObjectModelService({read:async()=>null,write:async()=>{}});service.model={};service.testImage={};service.state.detections=[{...box('old'),label:'Old',confidence:.9}];service.scan=async()=>{throw new Error('scan failed');};await assert.rejects(()=>service.detect(),/scan failed/);assert.deepEqual(service.state.detections,[]);assert.equal(service.state.busy,false);await assert.rejects(()=>service.rpc('x',[1]),/unavailable/);assert.equal(await service.rpc('count'),0);
});
test('changing confidence persists before publishing and clears results; failed persistence preserves settings',async()=>{
  const saved=[],service=new ObjectModelService({write:async(key,value)=>saved.push([key,value])});service.model={_duetObjects:{minimumConfidence:.8}};service.artifactFor=async(_model,minimumConfidence)=>({minimumConfidence});service.state.detections=[{label:'old'}];await service.setMinimumConfidence(65);assert.equal(service.state.minimumConfidence,.65);assert.deepEqual(service.state.detections,[]);assert.equal(service.model._duetObjects.minimumConfidence,.65);assert.deepEqual(saved,[['objects-model',{minimumConfidence:.65}]]);service.write=async()=>{throw new Error('full');};await assert.rejects(()=>service.setMinimumConfidence(70),/full/);assert.equal(service.state.minimumConfidence,.65);assert.equal(service.state.busy,false);
});
test('workspace lock excludes detection and clears test-image state before replacement',async()=>{
  const service=new ObjectModelService();service.testImage={};service.state.inputReady=true;service.state.detections=[box('old')];const token=service.beginWorkspaceImport();assert.equal(service.state.inputReady,false);assert.deepEqual(service.state.detections,[]);await assert.rejects(()=>service.detect(),/Wait/);assert.equal(service.endWorkspaceImport(Symbol('wrong')),false);assert.equal(service.endWorkspaceImport(token),true);
});
test('model provenance rejects a training image moved into holdout after training',async()=>{
  const original=image(),service=new ObjectModelService();service.model={_duetObjects:{classes:defaultObjectDataset().classes,trainingImageHashes:[await objectImageHash(original)]}};service.scan=async()=>{throw new Error('must not scan leaked test data');};await assert.rejects(()=>service.evaluate({...defaultObjectDataset(),images:[{...original,split:'test'}]}),/used to train this model/);assert.equal(service.state.evaluation,null);assert.equal(service.state.busy,false);
});
test('renamed classes cannot produce a holdout report against a stale model',async()=>{
  const service=new ObjectModelService();service.model={_duetObjects:{classes:defaultObjectDataset().classes,trainingImageHashes:[]}};await assert.rejects(()=>service.evaluate({kind:'duetblox-objects-dataset',version:1,classes:[{id:'object-1',name:'Renamed'}],images:[image('b','test')]}),/classes changed/);
});
test('import contract rejects extra model inputs, tensor outputs, fixed large batches and non-finite scores',()=>{
  const model={inputs:[{shape:[null,224,224,3],dtype:'float32'}],outputs:[{shape:[null,2],dtype:'float32'}]};validateObjectNetworkShape(model,2);
  for(const invalid of [{...model,inputs:[...model.inputs,...model.inputs]},{...model,outputs:[{shape:[null,1,2],dtype:'float32'}]},{...model,inputs:[{shape:[2,224,224,3],dtype:'float32'}]},{...model,outputs:[{shape:[null,2],dtype:'int32'}]}])assert.throws(()=>validateObjectNetworkShape(invalid,2));
  const scores=[{className:'a',probability:.4},{className:'b',probability:.6}];assert.equal(validateObjectScores(scores,['a','b']),scores);assert.throws(()=>validateObjectScores([{className:'a',probability:NaN},{className:'b',probability:.6}],['a','b']));assert.throws(()=>validateObjectScores(scores,['b','a']));
});

test('scan grid covers supported square sizes throughout the entire image with IoU above 0.6',()=>{
  for(const [width,height]of [[320,320],[640,480],[480,640],[1024,256]]){const windows=scanWindows(width,height);assert.ok(windows.length<=400);for(const scale of [1,.65,.4]){const side=Math.min(width,height)*scale,w=side/width,h=side/height;for(let xi=0;xi<=20;xi++)for(let yi=0;yi<=20;yi++){const target={x:(1-w)*xi/20,y:(1-h)*yi/20,width:w,height:h};assert.ok(Math.max(...windows.map(window=>intersectionOverUnion(target,window)))>.6,JSON.stringify({width,height,target}));}}}
  const target={x:.125,y:.096875,width:.4,height:.4};assert.ok(Math.max(...scanWindows(320,320).map(window=>intersectionOverUnion(target,window)))>.7);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenize,trainTextClassifier,predictText,validateTextDataset,validateTextArtifact,splitTextHoldout,evaluateTextHoldout} from './classifier.js';
import {exampleTextDataset} from './fixtures.js';
import {TextModelService} from './model-service.js';
import {registerDuetExtensions} from '../../../apps/scratch-editor/src/extensions.js';
const examples=()=>exampleTextDataset().classes;
const memory=()=>{const records=new Map();return {records,read:async key=>records.get(key),write:async(key,value)=>records.set(key,structuredClone(value))};};

test('Unicode word tokenization keeps Hindi vowel marks and normalizes English case',()=>{
  assert.deepEqual(tokenize('नमस्ते दोस्त! HELLO, ｈｅｌｌｏ १२३'),['नमस्ते','दोस्त','hello','hello','१२३']);
  assert.deepEqual(tokenize('… 😀'),[]);assert.throws(()=>tokenize('x'.repeat(4001)),/4,000/);
});
test('trained word counts classify novel English and Hindi examples with normalized scores',()=>{
  const model=trainTextClassifier(examples());validateTextArtifact(model);
  for(const [text,label] of [['hello hello','Greeting'],['goodbye bye','Goodbye'],['नमस्ते सुप्रभात नमस्ते','Greeting'],['अलविदा अलविदा','Goodbye']]){
    const result=predictText(model,text);assert.equal(result.predictions[0].className,label);assert.ok(Math.abs(result.predictions.reduce((s,p)=>s+p.probability,0)-1)<1e-12);
  }
});
test('unknown words abstain and explanation contributions reconstruct top-versus-runner log odds',()=>{
  const model=trainTextClassifier(examples());assert.equal(predictText(model,'telescope orbit').predictions.length,0);
  const result=predictText(model,'hello hello goodbye telescope'),e=result.explanation;
  const odds=e.priorLogOdds+e.contributions.reduce((s,c)=>s+c.logOdds,0);
  assert.ok(Math.abs(odds-Math.log(result.predictions[0].probability/result.predictions[1].probability))<1e-12);
  assert.deepEqual(e.unknownWords,['telescope']);assert.equal(e.knownWords,3);
});
test('duplicate normalized examples cannot inflate sample count or cross classes',()=>{
  const classes=examples();classes[0].samples=['hello','HELLO','hello!'];assert.throws(()=>trainTextClassifier(classes),/3 different/);
  const conflict=examples();conflict[1].samples.push(conflict[0].samples[0]);assert.throws(()=>trainTextClassifier(conflict),/different classes/);
});
test('malformed text datasets and artifacts are rejected without trusting counts',()=>{
  const dataset=exampleTextDataset();dataset.classes[1].id=dataset.classes[0].id;assert.throws(()=>validateTextDataset(dataset),/different IDs/);
  const model=trainTextClassifier(examples());model.classes[0].counts[0]=-1;assert.throws(()=>validateTextArtifact(model),/word counts/);
  const badPolicy=trainTextClassifier(examples());badPolicy.predictionPolicy={minimumConfidence:NaN};assert.throws(()=>validateTextArtifact(badPolicy),/between 0 and 1/);
});
test('deterministic holdout excludes test examples and does not mutate training data',()=>{
  const classes=examples(),before=structuredClone(classes),split=splitTextHoldout(classes),training=new Set(split.training.flatMap(c=>c.samples));
  assert.ok(split.test.every(s=>!training.has(s.text)));assert.deepEqual(split,splitTextHoldout([...classes].map(c=>({...c,samples:[...c.samples].reverse()}))));
  const report=evaluateTextHoldout(classes);assert.equal(report.testCount,2);assert.equal(report.trainCount,14);assert.ok(report.accuracy>=0&&report.accuracy<=1);assert.deepEqual(classes,before);
  assert.equal(evaluateTextHoldout(classes.map(c=>({...c,samples:c.samples.slice(0,3)}))).available,false);
});
test('text service threshold settings survive artifact export/import and unknown vocabulary never triggers a class',async()=>{
  const store=memory(),service=new TextModelService(store);await service.train(examples());await service.setPredictionPolicy({minimumConfidence:.9,minimumMargin:.3});
  const exported=await service.exportArtifact(),restored=new TextModelService(memory());await restored.importArtifact(exported);
  assert.deepEqual(restored.state.predictionPolicy,{minimumConfidence:.9,minimumMargin:.3});assert.equal(await restored.rpc('predict',['telescope orbit']),'Unknown');assert.equal(await restored.rpc('isAccepted'),false);assert.equal(await restored.rpc('confidence'),0);
  await restored.rpc('setMinimumConfidence',[0]);await restored.rpc('setMinimumMargin',[0]);assert.equal(await restored.rpc('predict',['अलविदा अलविदा']),'Goodbye');assert.equal(await restored.rpc('isAccepted'),true);
  await restored.clear();assert.deepEqual(restored.state.predictionPolicy,{minimumConfidence:.7,minimumMargin:.1});assert.equal(await restored.rpc('label'),'');
});
test('workspace operations reject concurrent setting changes and stale clear tokens',async()=>{
  const service=new TextModelService(memory());await service.train(examples());const token=service.beginWorkspaceImport();
  await assert.rejects(service.setPredictionPolicy({minimumConfidence:.8,minimumMargin:.2}),/Wait/);await assert.rejects(service.predict('hello'),/Wait/);
  await assert.rejects(service.clear(Symbol('stale'),{persist:false}),/no longer active/);await service.clear(token,{persist:false});assert.equal(service.endWorkspaceImport(token),true);assert.equal(service.endWorkspaceImport(token),false);
});
test('file imports own the model operation before a deferred file read begins',async()=>{
  const service=new TextModelService(memory());let resolve;const reading=new Promise(r=>resolve=r),importing=service.importFiles([{size:100,text:()=>reading}]);
  assert.equal(service.state.busy,true);assert.throws(()=>service.beginWorkspaceImport(),/Wait/);await assert.rejects(service.importArtifact(trainTextClassifier(examples())),/Wait/);
  resolve(JSON.stringify(trainTextClassifier(examples())));await importing;assert.equal(service.state.busy,false);assert.equal(await service.rpc('predict',['hello hello']),'Greeting');
  const token=service.beginWorkspaceImport();await service.clear(token,{persist:false});service.endWorkspaceImport(token);assert.equal(service.model,null);
});
test('dataset file reads are locked and rejected input cannot mutate a previous dataset',async()=>{
  const store=memory(),service=new TextModelService(store);service.dataset=exampleTextDataset();const previous=service.dataset;let resolve;const reading=new Promise(r=>resolve=r),importing=service.importDatasetFile({size:100,text:()=>reading});
  assert.throws(()=>service.beginWorkspaceImport(),/Wait/);resolve('{"kind":"wrong"}');await assert.rejects(importing,/DUETBlox text dataset/);assert.equal(service.dataset,previous);assert.equal(service.state.busy,false);assert.equal(store.records.has('text-dataset'),false);
});
test('failed model file decoding releases the operation and preserves the active model',async()=>{
  const service=new TextModelService(memory());await service.train(examples());const old=service.model;await assert.rejects(service.importFiles([{size:100,text:async()=>'{invalid'}]),/JSON|property name/);assert.equal(service.model,old);assert.equal(service.state.busy,false);
});
test('failed persistence keeps the previous model and prediction policy usable',async()=>{
  let fail=false;const service=new TextModelService({read:async()=>null,write:async()=>{if(fail)throw new Error('Storage full');}});await service.train(examples());const old=service.model;fail=true;
  await assert.rejects(service.setPredictionPolicy({minimumConfidence:.99,minimumMargin:.4}),/Storage full/);assert.deepEqual(service.state.predictionPolicy,{minimumConfidence:.7,minimumMargin:.1});
  await assert.rejects(service.importArtifact(trainTextClassifier(examples())),/Storage full/);assert.equal(service.model,old);assert.equal(service.state.busy,false);assert.equal(await service.rpc('predict',['hello hello']),'Greeting');
});
test('late restore cannot replace a newly imported workspace model',async()=>{
  let resolve;const read=new Promise(r=>resolve=r),service=new TextModelService({read:()=>read,write:async()=>{}});const restoring=service.restore(),token=service.beginWorkspaceImport();await service.clear(token,{persist:false});service.endWorkspaceImport(token);resolve(trainTextClassifier(examples()));assert.equal(await restoring,false);assert.equal(service.model,null);
});
test('a stale storage failure cannot overwrite a newer model status',async()=>{
  let reject;const reading=new Promise((_,r)=>reject=r),service=new TextModelService({read:()=>reading,write:async()=>{}});const restoring=service.restore();await service.importArtifact(trainTextClassifier(examples()));reject(new Error('Late storage error'));assert.equal(await restoring,false);assert.equal(service.state.error,null);assert.match(service.state.message,/Text model ready/);
});
test('Scratch text and prediction-policy blocks route the actual requested arguments',async()=>{
  const extensions=new Map(),calls=[],vm={runtime:{},extensionManager:{_loadedExtensions:new Map(),isExtensionLoaded:()=>false,_registerInternalExtension(instance){extensions.set(instance.getInfo().id,instance);return instance.getInfo().id;}}};
  registerDuetExtensions(vm,async(...args)=>calls.push(args));const text=extensions.get('duetText');assert.ok(text.getInfo().blocks.find(b=>b.opcode==='predict').arguments.TEXT);await text.predict({TEXT:'नमस्ते'});await text.setMinimumConfidence({PERCENT:80});await text.isAccepted();
  assert.deepEqual(calls,[['text','predict',['नमस्ते']],['text','setMinimumConfidence',[80]],['text','isAccepted',[]]]);
  for(const id of ['duetML','duetSound','duetPose'])assert.ok(extensions.get(id).getInfo().blocks.some(b=>b.opcode==='isAccepted'));
});

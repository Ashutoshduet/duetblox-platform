import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {parseWorkspace} from './workspace.js';
import {makeJuniorProject} from './junior/model.js';

async function archive(manifest = {}, entries = {}) {
  const zip = new JSZip();
  zip.file('duetblox.json', JSON.stringify({kind: 'duetblox-project', version: 1, ...manifest}));
  for (const [path, data] of Object.entries(entries)) zip.file(path, data);
  return zip.generateAsync({type: 'uint8array'});
}

test('workspace absent sections produce explicit fresh resets', async () => {
  const bytes = await archive({name: 'Junior only', board: 'unknown-board'});
  const first = await parseWorkspace(bytes);
  const second = await parseWorkspace(bytes);
  assert.equal(first.name, 'Junior only');
  assert.equal(first.board, 'arduino-uno');
  assert.equal(first.sb3, null);
  assert.equal(first.model, null);
  assert.equal(first.junior.schema, 'duetblox-junior');
  assert.equal(first.junior.scenes.length, 1);
  assert.equal(first.dataset.kind, 'duetblox-image-dataset');
  assert.deepEqual(first.dataset.classes.map(c => [c.name, c.samples]), [['Class 1', []], ['Class 2', []]]);
  first.dataset.classes[0].samples.push('changed');
  first.junior.scenes[0].name = 'changed';
  assert.deepEqual(second.dataset.classes[0].samples, []);
  assert.notEqual(second.junior.scenes[0].name, 'changed');
});

test('workspace preserves valid Junior, dataset, board and Scratch sections', async () => {
  const junior = makeJuniorProject();
  junior.title = 'Robot story';
  junior.scenes[0].sprites[0].scripts[0].blocks[0].value = 75;
  const dataset = {kind: 'duetblox-image-dataset', version: 1, classes: [{id: 'orange', name: 'Orange', samples: []}]};
  const scratch = new JSZip();
  scratch.file('project.json', JSON.stringify({targets: [{isStage: true, name: 'Stage'}]}));
  const sb3 = await scratch.generateAsync({type: 'uint8array'});
  const result = await parseWorkspace(await archive({name: 'Complete', junior, board: 'arduino-mega'}, {
    'ml/dataset.json': JSON.stringify(dataset), 'project.sb3': sb3
  }));
  assert.equal(result.name, 'Complete');
  assert.equal(result.board, 'arduino-mega');
  assert.equal(result.junior.title, 'Robot story');
  assert.equal(result.junior.scenes[0].sprites[0].scripts[0].blocks[0].value, 75);
  assert.deepEqual(result.dataset, dataset);
  assert.equal(result.sb3, Buffer.from(sb3).toString('base64'));
});

test('workspace rejects invalid dataset before returning a replacement', async () => {
  const dataset = {kind: 'duetblox-image-dataset', version: 1, classes: [
    {id: 'remote', name: 'Remote', samples: ['https://example.com/sample.png']}
  ]};
  const bytes = await archive({name: 'Invalid dataset'}, {'ml/dataset.json': JSON.stringify(dataset)});
  await assert.rejects(parseWorkspace(bytes), /invalid class or image data/);
});

test('workspace rejects invalid Junior execution blocks', async () => {
  const junior = makeJuniorProject();
  junior.scenes[0].sprites[0].scripts[0].blocks.push({id: 'unsupported', type: 'execute-js'});
  await assert.rejects(parseWorkspace(await archive({junior})), /Unsupported/);
  await assert.rejects(parseWorkspace(await archive({junior: {schema: 'other', version: 1}})), /Junior/);
});

test('workspace rejects a nested Scratch archive without a stage', async () => {
  const scratch = new JSZip();
  scratch.file('project.json', JSON.stringify({targets: [{isStage: false, name: 'Sprite'}]}));
  const bytes = await archive({}, {'project.sb3': await scratch.generateAsync({type: 'uint8array'})});
  await assert.rejects(parseWorkspace(bytes), /Scratch project is invalid/);
});

test('v2 workspace restores sound and pose datasets and identifies model modalities',async()=>{
 const sound={kind:'duetblox-sound-dataset',version:1,classes:[{id:'noise',name:'_background_noise_',samples:[]},{id:'clap',name:'Clap',samples:[]}]};
 const pose={kind:'duetblox-pose-dataset',version:1,classes:[{id:'up',name:'Arms up',samples:[]},{id:'down',name:'Arms down',samples:[]}]};
 const entries={'ml/sound/dataset.json':JSON.stringify(sound),'ml/pose/dataset.json':JSON.stringify(pose)};
 for(const kind of ['sound','pose']){entries[`ml/${kind}/model.json`]=JSON.stringify({modelTopology:{class_name:'Sequential'},weightsManifest:[{paths:['weights.bin'],weights:[]}]});entries[`ml/${kind}/weights.bin`]=new Uint8Array([1,2,3]);entries[`ml/${kind}/metadata.json`]=JSON.stringify({labels:['one','two']});}
 const result=await parseWorkspace(await archive({version:2},entries));assert.deepEqual(result.sound.dataset,sound);assert.deepEqual(result.pose.dataset,pose);assert.equal(result.sound.model.format,'duetblox-sound-model');assert.equal(result.pose.model.format,'duetblox-pose-model');
});
test('v1 workspaces explicitly reset absent sound and pose instead of leaking previous models',async()=>{const result=await parseWorkspace(await archive());assert.equal(result.sound.model,null);assert.equal(result.pose.model,null);assert.equal(result.sound.dataset.classes[0].name,'_background_noise_');assert.equal(result.pose.dataset.classes.length,2);});
test('workspace rejects invalid multimodal datasets before replacement',async()=>{const bad={kind:'duetblox-sound-dataset',version:1,classes:[{id:'a',name:'Noise',samples:[]},{id:'b',name:'Clap',samples:[]}]};await assert.rejects(parseWorkspace(await archive({version:2},{'ml/sound/dataset.json':JSON.stringify(bad)})),/background_noise/);});

// These fixtures exercise the same validator used by standalone imports and
// saved-program code generation, without initializing the browser editor.
import {validateScratchArchive,replaceScratchProject} from './workspace.js';
import {writeRecordBatch} from './storage.js';
import {imageModel} from './ml/model-service.js';
import {ModelService} from './ml/audio/common.js';
import {trainTextClassifier} from './ml/text/classifier.js';
import {addModelToZip} from './ml/archive.js';

test('v3 workspace preserves text model, policy and separate evaluation examples',async()=>{
 const text={kind:'duetblox-text-dataset',version:1,classes:[{id:'a',name:'Fruit',samples:['red apple','green apple','sweet orange']},{id:'b',name:'Travel',samples:['fast train','blue bus','long train']}]};
 const model={...trainTextClassifier(text.classes),predictionPolicy:{minimumConfidence:.85,minimumMargin:.15}};
 const evaluation={kind:'duetblox-evaluation-dataset',version:1,modelKind:'image',samples:[{id:'test1',name:'new-circle.png',actual:'Circle',data:'data:image/png;base64,AQID'}]};
 const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:3,name:'Text and evaluation'}));zip.file('ml/text/dataset.json',JSON.stringify(text));addModelToZip(zip,model,'ml/text/');zip.file('ml/evaluation.json',JSON.stringify(evaluation));
 const parsed=await parseWorkspace(await zip.generateAsync({type:'uint8array'}));
 assert.deepEqual(parsed.text.model,model);assert.deepEqual(parsed.text.dataset,text);assert.deepEqual(parsed.evaluation,evaluation);assert.equal(parsed.sound.evaluation,null);
});
test('legacy workspace clears text and evaluation state, invalid v3 sections reject before replacement',async()=>{
 const parsed=await parseWorkspace(await archive());assert.equal(parsed.text.model,null);assert.equal(parsed.evaluation,null);assert.equal(parsed.text.dataset.classes.length,2);
 await assert.rejects(parseWorkspace(await archive({version:3},{'ml/text/model.json':JSON.stringify({format:'other'})})),/text model/);
 const bad={kind:'duetblox-evaluation-dataset',version:1,modelKind:'image',samples:[{id:'x',name:'remote',actual:'Cat',data:'https://example.com/cat.png'}]};
 await assert.rejects(parseWorkspace(await archive({version:3},{'ml/evaluation.json':JSON.stringify(bad)})),/evaluation|sample/i);
});

test('standalone Scratch archives validate stage, JSON, and expanded byte limits',async()=>{
 const zip=new JSZip();const project={targets:[{isStage:true,name:'Stage'},{isStage:false,name:'Sprite'}]};zip.file('project.json',JSON.stringify(project));zip.file('large.svg','a'.repeat(4096));const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 assert.deepEqual(await validateScratchArchive(bytes),project);
 assert.deepEqual(await validateScratchArchive(Buffer.from(bytes).toString('base64'),{base64:true}),project);
 await assert.rejects(validateScratchArchive(bytes,{maxUncompressedBytes:1000}),/expanded Scratch/);
 await assert.rejects(validateScratchArchive(bytes,{maxProjectBytes:10}),/project.json exceeds/);
 await assert.rejects(validateScratchArchive(new Uint8Array([1,2,3])),/zip/i);
 const noProject=new JSZip();noProject.file('notes.txt','No program');await assert.rejects(validateScratchArchive(await noProject.generateAsync({type:'uint8array'})),/project.json is missing/);
 const twoStages=new JSZip();twoStages.file('project.json',JSON.stringify({targets:[{isStage:true},{isStage:true}]}));await assert.rejects(validateScratchArchive(await twoStages.generateAsync({type:'uint8array'})),/Scratch project is invalid/);
});

test('Scratch replacement restores the previous VM on load or storage failure',async()=>{
 for(const failing of ['load','storage']){
  let vm='previous',stored='previous';const commands=[];
  const send=async(type,payload)=>{commands.push(type);if(type==='saveProject')return {base64:vm};if(type==='loadProject'){vm=payload.project;if(failing==='load'&&vm==='next')throw new Error('VM cannot load candidate');}};
  await assert.rejects(replaceScratchProject(send,'next',async()=>{throw new Error('Storage quota exceeded');}),failing==='load'?/VM cannot load/:/Storage quota/);
  assert.equal(vm,'previous');assert.equal(stored,'previous');assert.deepEqual(commands,['saveProject','loadProject','loadProject']);
 }
 let vm='previous',persisted=false;await replaceScratchProject(async(type)=>{if(type==='saveProject')return {base64:vm};if(type==='resetProject')vm='default';},null,async()=>{assert.equal(vm,'default');persisted=true;});assert.equal(persisted,true);
});

// Minimal IDB transaction fixture: writes remain staged until complete and are
// discarded on abort, including synchronous cloning failure halfway through.
function transactionDatabase(initial,{quotaKey,cloneKey}={}){
 const records=new Map(initial);let transactions=0;
 return {records,get transactions(){return transactions;},transaction(store,mode){assert.equal(store,'records');assert.equal(mode,'readwrite');transactions++;const staged=new Map(records);let aborted=false,failure;const tx={error:null,objectStore(){return {put(value,key){if(key===cloneKey)throw new Error('Value could not be cloned');staged.set(key,structuredClone(value));if(key===quotaKey)failure=new Error('Quota exceeded');}};},abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());}};
 queueMicrotask(()=>{if(aborted)return;if(failure){tx.error=failure;tx.onerror?.();tx.abort();}else{records.clear();for(const [key,value] of staged)records.set(key,value);tx.oncomplete?.();}});return tx;}};
}

test('workspace record batch commits all records in one transaction',async()=>{
 const db=transactionDatabase([['current-workspace','old'],['image-model','old model']]);const entries=[['current-workspace',{name:'new'}],['image-model',null],['image-dataset',{classes:['new']}],['sound-model',{weights:new Uint8Array([1,2]).buffer}]];
 await writeRecordBatch(db,entries);assert.equal(db.transactions,1);assert.deepEqual([...db.records],entries);
});

test('failed workspace record batch preserves every previous persistent record',async()=>{
 const initial=[['current-workspace',{name:'old'}],['image-model',{label:'old'}],['image-dataset',{classes:['old']}]];
 for(const failure of [{quotaKey:'image-dataset'},{cloneKey:'image-dataset'}]){const db=transactionDatabase(initial,failure);await assert.rejects(writeRecordBatch(db,[['current-workspace',{name:'new'}],['image-model',null],['image-dataset',{classes:['new']}]]),/Quota|cloned/);assert.equal(db.transactions,1);assert.deepEqual([...db.records],initial);}
});

test('workspace clear can release models after an external commit without a second storage write',async()=>{
 let imageDisposed=0;imageModel.model={model:{dispose(){imageDisposed++;}}};const imageToken=imageModel.beginWorkspaceImport();await imageModel.clear(imageToken,{persist:false});assert.equal(imageModel.model,null);assert.equal(imageDisposed,1);imageModel.endWorkspaceImport(imageToken);
 class TestService extends ModelService{stopInput(){}disposeModel(model){if(model)this.disposedModel=model;}}
 const service=new TestService('sound'),previous={label:'previous'};service.model=previous;const token=service.beginWorkspaceImport();await service.clear(token,{persist:false});assert.equal(service.model,null);assert.equal(service.disposedModel,previous);service.endWorkspaceImport(token);
});

// Patch declared central-directory sizes, without allocating/inflating a huge
// test file. The importer must reject these entries before reading their bodies.
function declaredSizes(bytes,sizes){const next=bytes.slice(),view=new DataView(next.buffer,next.byteOffset,next.byteLength);for(let offset=0;offset<next.length-46;offset++){if(view.getUint32(offset,true)!==0x02014b50)continue;const length=view.getUint16(offset+28,true),name=new TextDecoder().decode(next.subarray(offset+46,offset+46+length));if(sizes[name]!==undefined)view.setUint32(offset+24,sizes[name],true);}return next;}
test('workspace rejects expanded archive, manifest and combined model sizes before inflation',async()=>{
 const bytes=await archive({}, {'ml/model.json':'{}','ml/weights.bin':'x','padding.bin':'x'}),mb=1024*1024;
 await assert.rejects(parseWorkspace(declaredSizes(bytes,{'padding.bin':201*mb})),/workspace exceeds 200 MB/);
 await assert.rejects(parseWorkspace(declaredSizes(bytes,{'duetblox.json':31*mb})),/manifest exceeds 30 MB/);
 await assert.rejects(parseWorkspace(declaredSizes(bytes,{'ml/model.json':60*mb,'ml/weights.bin':41*mb})),/model exceeds 100 MB/);
});

import {defaultPythonProject} from './python/project.js';
import {exampleNumberDataset} from './ml/numbers/fixtures.js';
import {trainNumbers} from './ml/numbers/model.js';
test('v4 workspace round trip keeps Python, numeric dataset and portable coefficients',async()=>{
 const python={...defaultPythonProject(),name:'sensors.py',code:'print(sum([1, 2, 3]))',input:'answer\n'},dataset=exampleNumberDataset('regression'),model=trainNumbers(dataset);
 const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:4,python}));zip.file('ml/numbers/dataset.json',JSON.stringify(dataset));addModelToZip(zip,model,'ml/numbers/');
 const parsed=await parseWorkspace(await zip.generateAsync({type:'uint8array'}));assert.deepEqual(parsed.python,python);assert.deepEqual(parsed.numbers.dataset,dataset);assert.deepEqual(parsed.numbers.model,model);assert.equal(zip.file('ml/numbers/weights.bin'),null);
});
test('legacy workspaces reset Python and numbers, malformed new sections reject atomically',async()=>{
 const parsed=await parseWorkspace(await archive());assert.deepEqual(parsed.python,defaultPythonProject());assert.equal(parsed.numbers.model,null);assert.equal(parsed.numbers.dataset.rows.length,0);
 await assert.rejects(parseWorkspace(await archive({version:4,python:{kind:'unknown'}})),/Python/i);
 await assert.rejects(parseWorkspace(await archive({version:4},{'ml/numbers/model.json':JSON.stringify({format:'unknown'})})),/number/i);
 const bytes=await archive({version:4},{'ml/numbers/model.json':'{}'});await assert.rejects(parseWorkspace(declaredSizes(bytes,{'ml/numbers/model.json':100001})),/size limit/);
});

test('v4 object dataset restores labels and bounded annotations; legacy archive resets it',async()=>{
 const objects={kind:'duetblox-objects-dataset',version:1,classes:[{id:'triangle',name:'Triangle'}],images:[{id:'photo',name:'training.png',dataUrl:'data:image/png;base64,AQID',width:100,height:80,split:'train',boxes:[{id:'box',classId:'triangle',x:.1,y:.2,width:.3,height:.4}]}]};
 const parsed=await parseWorkspace(await archive({version:4},{'ml/objects/dataset.json':JSON.stringify(objects)}));assert.deepEqual(parsed.objects.dataset,objects);assert.equal(parsed.objects.model,null);
 assert.equal((await parseWorkspace(await archive())).objects.dataset.images.length,0);
 objects.images[0].boxes[0].x=.9;await assert.rejects(parseWorkspace(await archive({version:4},{'ml/objects/dataset.json':JSON.stringify(objects)})),/bounds/);
 const bytes=await archive({version:4},{'ml/objects/dataset.json':'{}'});await assert.rejects(parseWorkspace(declaredSizes(bytes,{'ml/objects/dataset.json':23*1024*1024})),/object dataset exceeds/);
});

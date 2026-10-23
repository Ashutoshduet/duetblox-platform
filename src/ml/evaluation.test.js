import test from 'node:test';
import assert from 'node:assert/strict';
import {ABSTAIN_LABEL,createEvaluationReport,checkEvaluationSeparation,evaluationCSV,sampleFingerprint,validateEvaluationDataset} from './evaluation.js';

const scores=(a,b)=>[{className:'A',probability:a},{className:'B',probability:b}];
const image=bytes=>`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const row=(id,actual,predictions)=>({id,name:id,actual,predictions});
test('separate evaluation reports exact confusion counts, abstention, failed cases and per-class metrics',()=>{
  const report=createEvaluationReport({kind:'image',labels:['A','B'],rows:[row('a1','A',scores(.9,.1)),row('a2','A',scores(.2,.8)),row('b1','B',scores(.75,.25)),row('b2','B',scores(.4,.6)),{id:'bad',actual:'B',error:'Cannot decode'}]});
  assert.deepEqual(report.matrix,[[1,1,0],[1,0,1]]);
  assert.equal(report.summary.total,5);assert.equal(report.summary.evaluated,4);assert.equal(report.summary.failed,1);
  assert.equal(report.summary.accuracy,.25);assert.equal(report.summary.rawTop1Accuracy,.5);assert.equal(report.summary.coverage,.75);assert.equal(report.summary.acceptedAccuracy,1/3);assert.equal(report.summary.macroF1,.25);
  assert.deepEqual(report.perClass[0],{label:'A',support:2,predicted:2,truePositive:1,precision:.5,recall:.5,f1:.5,abstained:0});
  assert.equal(report.samples[3].predicted,ABSTAIN_LABEL);
});
test('missing pose detections count as abstentions rather than disappearing from results',()=>{
  const r=createEvaluationReport({kind:'pose',labels:['A','B'],rows:[{...row('not-a-person','A',[]),poseConfidence:.02}]});
  assert.equal(r.summary.evaluated,1);assert.equal(r.summary.abstained,1);assert.equal(r.summary.coverage,0);assert.equal(r.summary.accuracy,0);assert.equal(r.samples[0].reason,'no-prediction');assert.equal(r.samples[0].poseConfidence,.02);
});
test('changing the decision policy recomputes the same raw outcomes without rerunning the model',()=>{
  const input={kind:'image',labels:['A','B'],rows:[row('one','A',scores(.65,.35))]};
  assert.equal(createEvaluationReport(input).summary.accepted,0);
  const r=createEvaluationReport({...input,policy:{minimumConfidence:.6,minimumMargin:.2}});assert.equal(r.summary.accepted,1);assert.equal(r.summary.accuracy,1);
});
test('macro F1 exposes missing evaluation classes and includes abstention as false negative',()=>{
  const r=createEvaluationReport({kind:'image',labels:['A','B'],rows:[row('a1','A',scores(.9,.1)),row('a2','A',scores(.6,.4))]});
  assert.equal(r.summary.classesTested,1);assert.equal(r.summary.classesTotal,2);assert.equal(r.summary.macroF1,2/3);assert.equal(r.perClass[1].support,0);
});
test('reports reject unknown actual labels, invalid scores and duplicate prediction labels',()=>{
  const base={kind:'image',labels:['A','B']};
  assert.throws(()=>createEvaluationReport({...base,rows:[row('x','C',scores(.9,.1))]}),/not in/);
  assert.throws(()=>createEvaluationReport({...base,rows:[row('x','A',scores(NaN,.1))]}),/invalid/);
  assert.throws(()=>createEvaluationReport({...base,rows:[row('x','A',[{className:'A',probability:.8},{className:'A',probability:.2}])]}),/invalid/);
  assert.throws(()=>createEvaluationReport({...base,rows:[]}),/examples/);
});
test('SHA-256 rejects exact training leakage even across media header changes, and repeated evaluation samples',async()=>{
  const train=image([1,2,3]),newData=image([4,5,6]);
  assert.equal(await sampleFingerprint(train),await sampleFingerprint(train.replace('image/png','image/jpeg')));
  const separation=await checkEvaluationSeparation([{samples:[train]}],[{id:'leak',data:train.replace('image/png','image/jpeg')},{id:'new',data:newData},{id:'repeated',data:newData}]);
  assert.deepEqual(separation,{leaks:['leak'],duplicates:['repeated']});
});
test('separation scan honours cancellation before reading examples',async()=>{
  const controller=new AbortController();controller.abort();await assert.rejects(checkEvaluationSeparation([{samples:[image([1])]}],[],{signal:controller.signal}),{name:'AbortError'});
});
test('evaluation import is a separate bounded format and never accepts remote examples',()=>{
  const dataset={kind:'duetblox-evaluation-dataset',version:1,modelKind:'image',samples:[{id:'a',name:'new.png',actual:'A',data:image([1])}]};
  assert.deepEqual(validateEvaluationDataset(dataset,'image'),dataset);
  assert.throws(()=>validateEvaluationDataset(dataset,'sound'),/valid/);
  assert.throws(()=>validateEvaluationDataset({...dataset,kind:'duetblox-image-dataset'}),/valid/);
  assert.throws(()=>validateEvaluationDataset({...dataset,samples:[{...dataset.samples[0],data:'https://example.com/image.png'}]}),/invalid/);
  assert.throws(()=>validateEvaluationDataset({...dataset,samples:[...dataset.samples,...dataset.samples]}),/invalid/);
  assert.throws(()=>validateEvaluationDataset({...dataset,samples:Array.from({length:61},(_,i)=>({...dataset.samples[0],id:String(i)}))}),/60/);
  assert.deepEqual(validateEvaluationDataset({...dataset,samples:[]}).samples,[]);
});
test('CSV export includes summary, matrix, failures and neutralizes spreadsheet formula labels',()=>{
  const r=createEvaluationReport({kind:'image',labels:['=cmd','B'],rows:[{id:'x',name:'@bad.csv',actual:'=cmd',predictions:[{className:'=cmd',probability:.99},{className:'B',probability:.01}]}]});
  const csv=evaluationCSV(r);assert.ok(csv.includes('"accuracy","1"'));assert.ok(csv.includes('"Actual / predicted"'));assert.ok(csv.includes('"\'=cmd"'));assert.ok(csv.includes('"\'@bad.csv"'));assert.ok(csv.includes('"Unknown / no prediction"'));
});

test('undefined metrics remain unavailable when no predictions are accepted or all inputs fail',()=>{
 const none=createEvaluationReport({kind:'pose',labels:['A','B'],rows:[{actual:'A',predictions:[]}],policy:{minimumConfidence:.7,minimumMargin:.1}});
 assert.equal(none.summary.acceptedAccuracy,null);assert.equal(none.summary.coverage,0);
 const failed=createEvaluationReport({kind:'image',labels:['A','B'],rows:[{actual:'A',error:'Could not decode'}],policy:{minimumConfidence:.7,minimumMargin:.1}});
 assert.equal(failed.summary.accuracy,null);assert.equal(failed.summary.macroF1,null);assert.equal(failed.summary.failed,1);
});

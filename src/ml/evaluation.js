import {decidePrediction,normalizePredictionPolicy} from './decision.js';

export const ABSTAIN_LABEL='Unknown / no prediction';
const ratio=(n,d)=>d?n/d:0;

export function validateEvaluationDataset(data,expectedKind){
  if(data?.kind!=='duetblox-evaluation-dataset'||data.version!==1||!['image','sound','pose'].includes(data.modelKind)||(expectedKind&&data.modelKind!==expectedKind)||!Array.isArray(data.samples)||data.samples.length>300)throw new Error('Choose a valid DUETBlox evaluation dataset.');
  const ids=new Set(),counts=new Map(),pattern=data.modelKind==='sound'?/^data:audio\/wav;base64,/:/^data:image\/(jpeg|png|webp);base64,/;
  const samples=data.samples.map(sample=>{
    if(!sample||typeof sample.id!=='string'||!sample.id||sample.id.length>100||ids.has(sample.id)||typeof sample.actual!=='string'||!sample.actual.trim()||sample.actual.length>80||typeof sample.name!=='string'||sample.name.length>200||typeof sample.data!=='string'||sample.data.length>2e6||!pattern.test(sample.data))throw new Error('The evaluation dataset contains an invalid example.');
    const payload=sample.data.slice(sample.data.indexOf(',')+1);if(!payload||payload.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))throw new Error('The evaluation dataset contains invalid encoded media.');
    ids.add(sample.id);counts.set(sample.actual,(counts.get(sample.actual)||0)+1);if(counts.get(sample.actual)>60)throw new Error('Use at most 60 evaluation examples per class.');
    return {id:sample.id,name:sample.name,actual:sample.actual,data:sample.data};
  });
  return {kind:'duetblox-evaluation-dataset',version:1,modelKind:data.modelKind,samples};
}

/** These metrics use separately labelled test examples, never training scores. */
export function createEvaluationReport({kind,labels,rows,policy,createdAt=new Date().toISOString()}){
  if(!Array.isArray(labels)||labels.length<2||new Set(labels).size!==labels.length||labels.some(v=>typeof v!=='string'||!v))throw new Error('Evaluation needs the model’s distinct class labels.');
  if(!Array.isArray(rows)||!rows.length)throw new Error('Add new labelled evaluation examples first.');
  const normalizedPolicy=normalizePredictionPolicy(policy),matrix=labels.map(()=>Array(labels.length+1).fill(0));
  let evaluated=0,accepted=0,correct=0,rawCorrect=0;
  const samples=rows.map((row,index)=>{
    const actualIndex=labels.indexOf(row.actual);
    if(actualIndex<0)throw new Error(`Evaluation label “${row.actual}” is not in this model.`);
    if(row.error)return {id:row.id||String(index+1),name:row.name||`Sample ${index+1}`,actual:row.actual,error:String(row.error)};
    const predictions=Array.isArray(row.predictions)?row.predictions:[];
    if(predictions.some(p=>!p||!labels.includes(p.className)||!Number.isFinite(p.probability)||p.probability<0||p.probability>1)||new Set(predictions.map(p=>p.className)).size!==predictions.length)throw new Error('The model returned invalid evaluation predictions.');
    const sorted=[...predictions].sort((a,b)=>b.probability-a.probability),decision=decidePrediction(sorted,normalizedPolicy);
    const predictedIndex=decision.accepted?labels.indexOf(decision.label):labels.length;
    matrix[actualIndex][predictedIndex]++;evaluated++;
    if(decision.accepted)accepted++;
    if(decision.accepted&&decision.label===row.actual)correct++;
    if(sorted[0]?.className===row.actual)rawCorrect++;
    return {id:row.id||String(index+1),name:row.name||`Sample ${index+1}`,actual:row.actual,predicted:decision.accepted?decision.label:ABSTAIN_LABEL,accepted:decision.accepted,confidence:decision.probability,margin:decision.margin,reason:decision.reason,predictions:sorted,...(Number.isFinite(row.poseConfidence)?{poseConfidence:row.poseConfidence}:{})};
  });
  const perClass=labels.map((label,i)=>{
    const truePositive=matrix[i][i],support=matrix[i].reduce((a,b)=>a+b,0),predicted=matrix.reduce((n,row)=>n+row[i],0),precision=ratio(truePositive,predicted),recall=ratio(truePositive,support);
    return {label,support,predicted,truePositive,precision,recall,f1:ratio(2*precision*recall,precision+recall),abstained:matrix[i][labels.length]};
  });
  const represented=perClass.filter(c=>c.support);
  return {format:'duetblox-evaluation-report',version:1,kind,createdAt,policy:normalizedPolicy,labels:[...labels],columns:[...labels,ABSTAIN_LABEL],matrix,perClass,samples,summary:{total:rows.length,evaluated,failed:rows.length-evaluated,accepted,abstained:evaluated-accepted,correct,accuracy:evaluated?ratio(correct,evaluated):null,rawTop1Accuracy:evaluated?ratio(rawCorrect,evaluated):null,acceptedAccuracy:accepted?ratio(correct,accepted):null,coverage:evaluated?ratio(accepted,evaluated):null,macroF1:represented.length?ratio(represented.reduce((n,c)=>n+c.f1,0),represented.length):null,classesTested:represented.length,classesTotal:labels.length},notes:['Evaluation samples are kept separate from training.','Accuracy counts abstentions as misses; failed samples are reported separately.','Macro F1 averages only classes with evaluation examples. Add examples for every class.','Exact matches with the available training dataset are rejected. Transformed duplicates and unknown imported-model training data cannot be detected.']};
}

export async function sampleFingerprint(data){
  if(typeof data!=='string'||!/^data:(?:image\/(?:jpeg|png|webp)|audio\/wav);base64,/.test(data))throw new Error('Evaluation needs a supported local image or WAV sample.');
  const binary=atob(data.slice(data.indexOf(',')+1)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}

export async function checkEvaluationSeparation(trainingClasses,evaluationSamples,{signal}={}){
  const fingerprints=new Map(),fingerprint=async data=>{signal?.throwIfAborted();if(!fingerprints.has(data))fingerprints.set(data,await sampleFingerprint(data));return fingerprints.get(data);};
  const training=new Set();for(const c of trainingClasses||[])for(const data of c.samples||[])training.add(await fingerprint(data));
  const seen=new Set(),leaks=[],duplicates=[];
  for(const sample of evaluationSamples){const hash=await fingerprint(sample.data);if(training.has(hash))leaks.push(sample.id);if(seen.has(hash))duplicates.push(sample.id);seen.add(hash);}
  signal?.throwIfAborted();return {leaks,duplicates};
}

const csvCell=value=>{let text=String(value??'');if(/^\s*[=+@-]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
export function evaluationCSV(report){
  const lines=[['DUETBlox evaluation report',report.kind,report.createdAt],['Minimum confidence',report.policy.minimumConfidence],['Minimum margin',report.policy.minimumMargin],[],['Metric','Value'],...Object.entries(report.summary),[],['Class','Examples','Predicted','Correct','Precision','Recall','F1','Abstained'],...report.perClass.map(c=>[c.label,c.support,c.predicted,c.truePositive,c.precision,c.recall,c.f1,c.abstained]),[],['Actual / predicted',...report.columns],...report.matrix.map((row,i)=>[report.labels[i],...row]),[],['Sample','Actual','Predicted','Accepted','Confidence','Margin','Reason','Error'],...report.samples.map(s=>[s.name,s.actual,s.predicted,s.accepted,s.confidence,s.margin,s.reason,s.error])];
  return lines.map(line=>line.map(csvCell).join(',')).join('\r\n');
}

// Multinomial Naive Bayes with Laplace smoothing, implemented locally.
// Formula reference: https://scikit-learn.org/stable/modules/naive_bayes.html#multinomial-naive-bayes
import {normalizePredictionPolicy} from '../decision.js';
export const TEXT_LIMITS = {classes:30,samples:300,characters:4000,vocabulary:10000};
export function tokenize(text) {
  if (typeof text!=='string'||text.length>TEXT_LIMITS.characters) throw new Error('Use text up to 4,000 characters per example.');
  // Combining marks are part of a word: splitting on ASCII word boundaries breaks Hindi.
  return text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu)||[];
}
const signature=text=>tokenize(text).join(' ');
const clone=value=>JSON.parse(JSON.stringify(value));
export const defaultTextClasses=()=>[{id:crypto.randomUUID(),name:'Class 1',samples:[]},{id:crypto.randomUUID(),name:'Class 2',samples:[]}];
export function validateTextDataset(data) {
  if(data?.kind!=='duetblox-text-dataset'||data.version!==1||!Array.isArray(data.classes)||data.classes.length<2||data.classes.length>TEXT_LIMITS.classes)throw new Error('Choose a DUETBlox text dataset with 2–30 classes.');
  const names=new Set(),ids=new Set();
  for(const c of data.classes){
    if(typeof c?.id!=='string'||!c.id||c.id.length>100||ids.has(c.id))throw new Error('Text classes need different IDs.');
    const name=typeof c.name==='string'?c.name.trim():'';
    if(!name||name.length>80||names.has(name.toLocaleLowerCase('en')))throw new Error('Use different class names, each 1–80 characters long.');
    names.add(name.toLocaleLowerCase('en'));ids.add(c.id);
    if(!Array.isArray(c.samples)||c.samples.length>TEXT_LIMITS.samples)throw new Error('Use at most 300 examples per text class.');
    for(const text of c.samples)if(!tokenize(text).length)throw new Error('Each example needs at least one word or number.');
  }
  return data.classes;
}
function trainingClasses(classes,minimum=3) {
  validateTextDataset({kind:'duetblox-text-dataset',version:1,classes});
  const seen=new Map();
  return classes.map(c=>{
    const unique=[];
    for(const text of c.samples){const key=signature(text);if(seen.has(key)){if(seen.get(key)!==c.id)throw new Error('The same text appears in different classes. Remove the conflicting example.');continue;}seen.set(key,c.id);unique.push(text);}
    if(unique.length<minimum)throw new Error(`Add at least ${minimum} different examples to “${c.name}”. Duplicate examples count once.`);
    return {...c,name:c.name.trim(),samples:unique};
  });
}
export function trainTextClassifier(classes) {
  const clean=trainingClasses(classes),vocabulary=[...new Set(clean.flatMap(c=>c.samples.flatMap(tokenize)))].sort();
  if(vocabulary.length>TEXT_LIMITS.vocabulary)throw new Error('Use no more than 10,000 different words in one model.');
  const indices=new Map(vocabulary.map((word,i)=>[word,i]));
  const rows=clean.map(c=>{
    const counts=Array(vocabulary.length).fill(0);
    for(const sample of c.samples)for(const word of tokenize(sample))counts[indices.get(word)]++;
    return {name:c.name,documentCount:c.samples.length,tokenTotal:counts.reduce((a,b)=>a+b,0),counts};
  });
  return {format:'duetblox-text-model',version:1,algorithm:'multinomial-naive-bayes',tokenizer:'unicode-words-nfkc-v1',alpha:1,vocabulary,classes:rows};
}
export function validateTextArtifact(artifact) {
  if(artifact?.format!=='duetblox-text-model'||artifact.version!==1||artifact.algorithm!=='multinomial-naive-bayes'||artifact.tokenizer!=='unicode-words-nfkc-v1'||artifact.alpha!==1)throw new Error('Choose a DUETBlox Multinomial Naive Bayes text model.');
  normalizePredictionPolicy(artifact.predictionPolicy);
  const vocabulary=artifact.vocabulary;
  if(!Array.isArray(vocabulary)||!vocabulary.length||vocabulary.length>TEXT_LIMITS.vocabulary||new Set(vocabulary).size!==vocabulary.length||vocabulary.some(w=>typeof w!=='string'||w.length>TEXT_LIMITS.characters||tokenize(w).length!==1||tokenize(w)[0]!==w))throw new Error('The text model contains an invalid vocabulary.');
  if(!Array.isArray(artifact.classes)||artifact.classes.length<2||artifact.classes.length>TEXT_LIMITS.classes)throw new Error('The text model needs 2–30 classes.');
  const names=new Set();
  for(const c of artifact.classes){
    if(typeof c?.name!=='string'||!c.name.trim()||c.name.length>80||names.has(c.name.toLocaleLowerCase('en')))throw new Error('The text model contains invalid class names.');
    names.add(c.name.toLocaleLowerCase('en'));
    if(!Number.isInteger(c.documentCount)||c.documentCount<3||c.documentCount>TEXT_LIMITS.samples||!Number.isInteger(c.tokenTotal)||c.tokenTotal<1||c.tokenTotal>1e6||!Array.isArray(c.counts)||c.counts.length!==vocabulary.length||c.counts.some(n=>!Number.isInteger(n)||n<0||n>1e6)||c.counts.reduce((a,b)=>a+b,0)!==c.tokenTotal)throw new Error('The text model contains invalid word counts.');
  }
  return artifact;
}
export function predictText(model,text) {
  const words=tokenize(text),indices=new Map(model.vocabulary.map((w,i)=>[w,i])),counts=new Map(),unknown=[];
  for(const word of words){if(indices.has(word))counts.set(word,(counts.get(word)||0)+1);else unknown.push(word);}
  if(!counts.size)return {predictions:[],explanation:{knownWords:0,totalWords:words.length,unknownWords:[...new Set(unknown)],contributions:[],reason:words.length?'No words match the trained vocabulary.':'Enter some text to classify.'}};
  const documents=model.classes.reduce((n,c)=>n+c.documentCount,0);
  const scores=model.classes.map(c=>({className:c.name,prior:Math.log(c.documentCount/documents),score:Math.log(c.documentCount/documents)+[...counts].reduce((sum,[word,count])=>sum+count*Math.log((c.counts[indices.get(word)]+1)/(c.tokenTotal+model.vocabulary.length)),0)})).sort((a,b)=>b.score-a.score);
  const max=scores[0].score,total=scores.reduce((sum,p)=>sum+Math.exp(p.score-max),0);
  const winner=model.classes.find(c=>c.name===scores[0].className),runner=model.classes.find(c=>c.name===scores[1].className);
  const contributions=[...counts].map(([word,count])=>({word,count,logOdds:count*(Math.log((winner.counts[indices.get(word)]+1)/(winner.tokenTotal+model.vocabulary.length))-Math.log((runner.counts[indices.get(word)]+1)/(runner.tokenTotal+model.vocabulary.length)))})).sort((a,b)=>Math.abs(b.logOdds)-Math.abs(a.logOdds));
  return {predictions:scores.map(s=>({className:s.className,probability:Math.exp(s.score-max)/total})),explanation:{winner:winner.name,runnerUp:runner.name,priorLogOdds:scores[0].prior-scores[1].prior,knownWords:[...counts.values()].reduce((a,b)=>a+b,0),totalWords:words.length,unknownWords:[...new Set(unknown)],contributions}};
}
// Fixed, stratified holdout. A fresh model sees training rows only; the deployed
// model is trained separately on all rows after this diagnostic has finished.
const hash=text=>{let n=2166136261;for(const char of text){n^=char.codePointAt(0);n=Math.imul(n,16777619);}return n>>>0;};
export function splitTextHoldout(classes) {
  const clean=trainingClasses(classes,5),test=[];
  const training=clean.map(c=>{const sorted=[...c.samples].sort((a,b)=>hash(signature(a))-hash(signature(b))||signature(a).localeCompare(signature(b)));const count=Math.max(1,Math.floor(sorted.length*.2));sorted.slice(0,count).forEach(text=>test.push({expected:c.name,text}));return {...c,samples:sorted.slice(count)};});
  return {training,test};
}
export function evaluateTextHoldout(classes) {
  let split;try{split=splitTextHoldout(classes);}catch(error){if(classes.some(c=>new Set(c.samples.map(signature)).size<5))return {available:false,message:'Add at least 5 different examples per class for a separate 20% holdout check.'};throw error;}
  const candidate=trainTextClassifier(split.training),labels=candidate.classes.map(c=>c.name),confusion=labels.map(()=>labels.map(()=>0)),rows=[];
  for(const sample of split.test){const result=predictText(candidate,sample.text),predicted=result.predictions[0]?.className||'Unknown';rows.push({...sample,predicted,probability:result.predictions[0]?.probability||0});if(labels.includes(predicted))confusion[labels.indexOf(sample.expected)][labels.indexOf(predicted)]++;}
  const perClass=labels.map((name,i)=>{const support=rows.filter(r=>r.expected===name).length,tp=confusion[i][i],predicted=rows.filter(r=>r.predicted===name).length,precision=predicted?tp/predicted:0,recall=support?tp/support:0;return {name,support,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0};});
  return {available:true,kind:'stratified-20-percent-holdout',trainCount:split.training.reduce((s,c)=>s+c.samples.length,0),testCount:rows.length,labels,confusion,accuracy:rows.filter(r=>r.predicted===r.expected).length/rows.length,macroF1:perClass.reduce((n,c)=>n+c.f1,0)/labels.length,perClass,rows};
}
export function cloneTextArtifact(artifact){return clone(validateTextArtifact(artifact));}

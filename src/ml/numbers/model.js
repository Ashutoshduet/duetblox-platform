// Original, dependency-free numerical learning. See docs/number-learning.md.
export const NUMBER_LIMITS = Object.freeze({features:8,rows:1000,classes:12,magnitude:1e9,modelBytes:100000});
const copy = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<=NUMBER_LIMITS.magnitude;
const name = value => typeof value==='string' && value===value.trim() && value.length>0 && value.length<=60 && !/[\x00-\x1f]/.test(value);
const names = values => Array.isArray(values)&&values.every(name)&&new Set(values.map(v=>v.toLocaleLowerCase('en'))).size===values.length;
export function numberValue(value,label='Value') {
  if(typeof value==='string' && !value.trim())throw new Error(`${label} is empty. Enter a number.`);
  if(typeof value!=='number' && (typeof value!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim())))throw new Error(`${label} must be a finite decimal number.`);
  const number=Number(value);if(!finite(number))throw new Error(`${label} must be between −1 billion and 1 billion.`);return Object.is(number,-0)?0:number;
}
export function validateNumberDataset(data) {
  if(data?.kind!=='duetblox-numbers-dataset'||data.version!==1||!['classification','regression'].includes(data.task))throw new Error('Choose a DUETBlox numbers dataset (version 1).');
  if(!names(data.features)||data.features.length<1||data.features.length>NUMBER_LIMITS.features)throw new Error('Use 1–8 different feature names, each 1–60 characters.');
  if(!name(data.targetName)||data.features.some(f=>f.toLocaleLowerCase('en')===data.targetName.toLocaleLowerCase('en')))throw new Error('Give the target a different name from every input feature.');
  if(!Array.isArray(data.rows)||data.rows.length>NUMBER_LIMITS.rows)throw new Error('Use at most 1,000 rows.');
  const labels=new Set();
  for(const [index,row] of data.rows.entries()){
    if(!Array.isArray(row?.inputs)||row.inputs.length!==data.features.length||!row.inputs.every(finite))throw new Error(`Row ${index+1} needs a finite number for every feature (−1 billion to 1 billion).`);
    if(data.task==='classification'){if(!name(row.target))throw new Error(`Row ${index+1} needs a class label of 1–60 characters.`);labels.add(row.target);}
    else if(!finite(row.target))throw new Error(`Row ${index+1} needs a finite numeric target (−1 billion to 1 billion).`);
  }
  if(labels.size>NUMBER_LIMITS.classes)throw new Error('Use at most 12 class labels.');
  if(new Set([...labels].map(v=>v.toLocaleLowerCase('en'))).size!==labels.size)throw new Error('Class names must differ by more than letter case.');
  return data;
}
export function cleanNumberDataset(data) {
  validateNumberDataset(data);const seen=new Map(),rows=[];
  for(const row of data.rows){const key=JSON.stringify(row.inputs.map(x=>Object.is(x,-0)?0:x));if(seen.has(key)){if(seen.get(key)!==row.target)throw new Error('Identical input rows have conflicting targets. Remove or correct the conflicting examples.');continue;}seen.set(key,row.target);rows.push(copy(row));}
  return {...copy(data),rows};
}
function trainingData(data) {
  const clean=cleanNumberDataset(data),labels=[...new Set(clean.rows.map(r=>r.target))];
  if(clean.task==='classification'){
    if(labels.length<2)throw new Error('Add at least two different classes.');
    for(const label of labels)if(clean.rows.filter(r=>r.target===label).length<3)throw new Error(`Add at least 3 different input rows for “${label}”. Duplicates count once.`);
  }else if(clean.rows.length<Math.max(4,clean.features.length+1))throw new Error(`Add at least ${Math.max(4,clean.features.length+1)} different input rows for regression.`);
  return clean;
}
function standardization(rows,count) {
  const means=Array(count).fill(0),variance=Array(count).fill(0);
  rows.forEach((r,n)=>r.inputs.forEach((value,j)=>{const delta=value-means[j];means[j]+=delta/(n+1);variance[j]+=delta*(value-means[j]);}));
  const scales=variance.map(v=>Math.sqrt(Math.max(0,v/rows.length))||1);
  return {means,scales};
}
const normalize=(model,inputs)=>inputs.map((x,j)=>(x-model.means[j])/model.scales[j]);
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
function softmax(scores){const largest=Math.max(...scores),exps=scores.map(s=>Math.exp(s-largest)),total=exps.reduce((a,b)=>a+b,0);return exps.map(s=>s/total);}
function solvePositive(matrix,rhs) {
  const n=rhs.length,L=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let value=matrix[i][j];for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];if(i===j){if(!(value>0)||!Number.isFinite(value))throw new Error('These inputs are numerically unstable. Rescale the data and try again.');L[i][j]=Math.sqrt(value);}else L[i][j]=value/L[j][j];}
  const temp=Array(n),answer=Array(n);
  for(let i=0;i<n;i++){let value=rhs[i];for(let k=0;k<i;k++)value-=L[i][k]*temp[k];temp[i]=value/L[i][i];}
  for(let i=n-1;i>=0;i--){let value=temp[i];for(let k=i+1;k<n;k++)value-=L[k][i]*answer[k];answer[i]=value/L[i][i];}return answer;
}
export function trainNumbers(data) {
  const clean=trainingData(data),{rows,features,task}=clean,n=rows.length,d=features.length,{means,scales}=standardization(rows,d);
  const base={format:'duetblox-numbers-model',version:1,task,features:[...features],targetName:clean.targetName,means,scales,inputRanges:features.map((_,j)=>[Math.min(...rows.map(r=>r.inputs[j])),Math.max(...rows.map(r=>r.inputs[j]))]),trainingRows:n};
  const xs=rows.map(r=>normalize(base,r.inputs));
  if(task==='classification'){
    const labels=[...new Set(rows.map(r=>r.target))].sort(),weights=labels.map(()=>Array(d).fill(0)),biases=labels.map(()=>0),targets=rows.map(r=>labels.indexOf(r.target));
    // Mean cross-entropy + L2 regularization; fixed full-batch updates are reproducible.
    const iterations=600,learningRate=.3/(d+1),regularization=.001;
    for(let epoch=0;epoch<iterations;epoch++){
      const dw=labels.map(()=>Array(d).fill(0)),db=labels.map(()=>0);
      for(let i=0;i<n;i++){const probs=softmax(weights.map((w,k)=>dot(w,xs[i])+biases[k]));for(let k=0;k<labels.length;k++){const error=probs[k]-(targets[i]===k?1:0);db[k]+=error;for(let j=0;j<d;j++)dw[k][j]+=error*xs[i][j];}}
      for(let k=0;k<labels.length;k++){biases[k]-=learningRate*db[k]/n;for(let j=0;j<d;j++)weights[k][j]-=learningRate*(dw[k][j]/n+regularization*weights[k][j]);}
    }
    return validateNumberArtifact({...base,algorithm:'standardized-softmax-v1',labels,weights,biases,regularization,iterations});
  }
  const regularization=.0001,targetMean=rows.reduce((s,r)=>s+r.target/n,0),matrix=Array.from({length:d},()=>Array(d).fill(0)),rhs=Array(d).fill(0);
  for(let i=0;i<n;i++)for(let j=0;j<d;j++){rhs[j]+=xs[i][j]*(rows[i].target-targetMean)/n;for(let k=0;k<d;k++)matrix[j][k]+=xs[i][j]*xs[i][k]/n;}
  for(let j=0;j<d;j++)matrix[j][j]+=regularization;
  const coefficients=solvePositive(matrix,rhs);
  return validateNumberArtifact({...base,algorithm:'standardized-ridge-v1',coefficients,intercept:targetMean,regularization});
}
export function validateNumberArtifact(model) {
  if(model?.format!=='duetblox-numbers-model'||model.version!==1||!['classification','regression'].includes(model.task))throw new Error('Choose a DUETBlox numbers model (version 1).');
  if(!names(model.features)||model.features.length<1||model.features.length>8||!name(model.targetName))throw new Error('The numbers model has invalid feature names.');
  const d=model.features.length,vector=(value,length,valid=finite)=>Array.isArray(value)&&value.length===length&&value.every(valid);
  if(!vector(model.means,d)||!vector(model.scales,d,x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=2e9)||!Number.isInteger(model.trainingRows)||model.trainingRows<4||model.trainingRows>1000)throw new Error('The numbers model has invalid standardization data.');
  if(!Array.isArray(model.inputRanges)||model.inputRanges.length!==d||model.inputRanges.some(r=>!vector(r,2)||r[0]>r[1]))throw new Error('The numbers model has invalid training ranges.');
  // Float C++ export is deliberately limited to coefficients safe for embedded inference.
  const coefficient=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12;
  if(model.task==='classification'){
    if(model.algorithm!=='standardized-softmax-v1'||!names(model.labels)||model.labels.length<2||model.labels.length>12||!Array.isArray(model.weights)||model.weights.length!==model.labels.length||model.weights.some(w=>!vector(w,d,coefficient))||!vector(model.biases,model.labels.length,coefficient)||model.regularization!==.001||model.iterations!==600)throw new Error('The classifier has invalid labels, weights or algorithm settings.');
  }else if(model.algorithm!=='standardized-ridge-v1'||!vector(model.coefficients,d,coefficient)||!coefficient(model.intercept)||model.regularization!==.0001)throw new Error('The regressor has invalid coefficients or algorithm settings.');
  if(JSON.stringify(model).length>NUMBER_LIMITS.modelBytes)throw new Error('The numbers model is too large.');return model;
}
export const cloneNumberArtifact = model => copy(validateNumberArtifact(model));
export function parseNumberInputs(values,features) {
  const list=Array.isArray(values)?values:typeof values==='string'?values.split(','):null;
  if(!list||list.length!==features.length)throw new Error(`Enter exactly ${features.length} input number${features.length===1?'':'s'} in this order: ${features.join(', ')}.`);
  return list.map((v,i)=>numberValue(v,features[i]));
}
export function predictNumbers(model,values) {
  validateNumberArtifact(model);const inputs=parseNumberInputs(values,model.features),xs=normalize(model,inputs);
  if(xs.some(x=>!Number.isFinite(x)||Math.abs(x)>1e12))throw new Error('These inputs are too far from the training range. Rescale the data.');
  const outsideRange=model.features.filter((_,j)=>inputs[j]<model.inputRanges[j][0]||inputs[j]>model.inputRanges[j][1]);
  if(model.task==='regression'){const value=dot(model.coefficients,xs)+model.intercept;if(!Number.isFinite(value)||Math.abs(value)>1e15)throw new Error('The predicted value is outside the supported numeric range.');return {task:model.task,value,predictions:[],outsideRange};}
  const probabilities=softmax(model.weights.map((w,k)=>dot(w,xs)+model.biases[k])),predictions=model.labels.map((className,k)=>({className,probability:probabilities[k]})).sort((a,b)=>b.probability-a.probability);
  return {task:model.task,label:predictions[0].className,predictions,outsideRange};
}
const hash=text=>{let h=2166136261;for(const c of text){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export function splitNumberHoldout(data) {
  const clean=trainingData(data),order=rows=>[...rows].sort((a,b)=>hash(JSON.stringify(a.inputs))-hash(JSON.stringify(b.inputs))||JSON.stringify(a.inputs).localeCompare(JSON.stringify(b.inputs))),training=[],test=[];
  const groups=clean.task==='classification'?[...new Set(clean.rows.map(r=>r.target))].map(label=>clean.rows.filter(r=>r.target===label)):[clean.rows];
  if(clean.task==='classification'&&groups.some(g=>g.length<5))return {available:false,message:'Add at least 5 different input rows per class for a separate 20% holdout check.'};
  if(clean.task==='regression'&&clean.rows.length<Math.max(10,clean.features.length+3))return {available:false,message:`Add at least ${Math.max(10,clean.features.length+3)} different input rows for a separate 20% holdout check.`};
  for(const group of groups){const sorted=order(group),count=Math.max(clean.task==='regression'?2:1,Math.floor(sorted.length*.2));test.push(...sorted.slice(0,count));training.push(...sorted.slice(count));}
  return {available:true,training:{...clean,rows:training},test};
}
export function evaluateNumbers(data) {
  const split=splitNumberHoldout(data);if(!split.available)return split;
  const candidate=trainNumbers(split.training),rows=split.test.map(row=>({...copy(row),result:predictNumbers(candidate,row.inputs)}));
  const base={available:true,kind:'deterministic-20-percent-holdout',task:data.task,trainCount:split.training.rows.length,testCount:rows.length,rows};
  if(data.task==='classification'){
    const labels=candidate.labels,confusion=labels.map(()=>labels.map(()=>0));for(const r of rows)confusion[labels.indexOf(r.target)][labels.indexOf(r.result.label)]++;
    const perClass=labels.map((label,i)=>{const support=confusion[i].reduce((a,b)=>a+b,0),tp=confusion[i][i],predicted=confusion.reduce((n,row)=>n+row[i],0),precision=predicted?tp/predicted:0,recall=support?tp/support:0;return {label,support,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0};});
    return {...base,labels,confusion,perClass,accuracy:rows.filter(r=>r.target===r.result.label).length/rows.length,macroF1:perClass.reduce((s,c)=>s+c.f1,0)/labels.length};
  }
  const mean=rows.reduce((s,r)=>s+r.target/rows.length,0),squared=rows.reduce((s,r)=>s+(r.target-r.result.value)**2,0),total=rows.reduce((s,r)=>s+(r.target-mean)**2,0);
  return {...base,mae:rows.reduce((s,r)=>s+Math.abs(r.target-r.result.value),0)/rows.length,rmse:Math.sqrt(squared/rows.length),r2:total>0?1-squared/total:null};
}

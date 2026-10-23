// Host-compiled C++ checks numerical semantics. This does not claim physical board validation.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {numbersRuntimeSource} from '../numbers-codegen.js';
import {numberProject} from './numbers-fixtures.mjs';
import {predictNumbers} from '../../ml/numbers/model.js';
import {decidePrediction} from '../../ml/decision.js';
const run=promisify(execFile),folder=resolve('work/release-070/numbers-parity');await mkdir(folder,{recursive:true});
const results=[];
for(const [name,task,inputs,policy] of [['classification-sun','classification',[740,29]],['classification-shade','classification',[48,19]],['classification-unknown','classification',[350,24],{minimumConfidence:1,minimumMargin:0}],['classification-tie','classification',[0,0],{minimumConfidence:0,minimumMargin:0}],['regression','regression',[37]],['regression-extrapolation','regression',[110]]]){
 const model=numberProject(task).duetbloxModels.numbers;if(policy)model.predictionPolicy=policy;if(name==='classification-tie'){model.weights=model.weights.map(w=>w.map(()=>0));model.biases=model.biases.map(()=>0);}
 const browser=predictNumbers(model,inputs),decision=task==='classification'?decidePrediction(browser.predictions,policy):{accepted:true},expected={value:browser.value||0,confidence:browser.predictions[0]?.probability*100||0,classIndex:task==='classification'&&decision.accepted?model.labels.indexOf(decision.label)+1:0,accepted:decision.accepted};
 const inputCode=inputs.map((value,i)=>`duetNumbersSetInput(${i+1}, ${value});`).join('\n');
 const main=`\nint main() {\n  ${inputCode}\n  bool ok = duetNumbersPredict();\n  std::printf("%d %.12g %.12g %d %d\\n", ok, duetNumbersValue, duetNumbersConfidence, duetNumbersClassIndex, duetNumbersAccepted);\n  duetNumbersSetInput(1, NAN);\n  ok = duetNumbersPredict();\n  std::printf("%d %.12g %.12g %d %d\\n", ok, duetNumbersValue, duetNumbersConfidence, duetNumbersClassIndex, duetNumbersAccepted);\n}\n`;
 for(const mode of ['double','float']){
   let code=numbersRuntimeSource(model);if(mode==='float')code=code.replace(/\bdouble\b/g,'float');
   const filename=join(folder,`${name}-${mode}.cpp`),binary=join(folder,`${name}-${mode}`);await writeFile(filename,`#include <cmath>\n#include <cstdio>\nusing std::isfinite;\n${code}${main}`);
   await run('c++',['-std=c++11','-Wall',filename,'-o',binary]);const output=(await run(binary,[])).stdout.trim().split('\n').map(line=>line.split(' ').map(Number));const [ok,value,confidence,classIndex,accepted]=output[0];assert.equal(ok,1);assert.equal(classIndex,expected.classIndex);assert.equal(Boolean(accepted),expected.accepted);assert.ok(Math.abs(value-expected.value)<(mode==='float'?.001:1e-8));assert.ok(Math.abs(confidence-expected.confidence)<(mode==='float'?.001:1e-8));assert.deepEqual(output[1],[0,0,0,0,0]);results.push({name,arithmetic:mode,browser:expected,cpp:{value,confidence,classIndex,accepted:Boolean(accepted)},invalidInputClearsResult:true,match:true});
 }
}
await writeFile(join(folder,'results.json'),JSON.stringify({physicalVerified:false,results},null,2));console.log(`${results.length} native C++ numeric/policy parity checks passed; invalid inputs cleared every result.`);

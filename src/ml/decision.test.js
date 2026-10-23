import test from 'node:test';
import assert from 'node:assert/strict';
import {decidePrediction, normalizePredictionPolicy, policyFromPercent} from './decision.js';

const scores=(a,b)=>[{className:'Left',probability:a},{className:'Right',probability:b}];
test('prediction policy abstains on low scores, ties, narrow leads and invalid outputs',()=>{
  assert.equal(decidePrediction(scores(.6,.4)).reason,'low-confidence');
  assert.equal(decidePrediction(scores(.72,.7)).reason,'ambiguous');
  assert.equal(decidePrediction(scores(.5,.5),{minimumConfidence:0,minimumMargin:0}).accepted,false);
  assert.equal(decidePrediction(scores(.9,.1)).label,'Left');
  assert.equal(decidePrediction(scores(.1,.9)).label,'Right');
  assert.equal(decidePrediction([]).label,'');
  assert.equal(decidePrediction(scores(NaN,.1)).reason,'invalid-prediction');
});
test('policy accepts only finite bounded settings and percentages',()=>{
  for(const bad of [-1,1.1,NaN,Infinity,'0.7']) assert.throws(()=>normalizePredictionPolicy({minimumConfidence:bad}));
  assert.throws(()=>normalizePredictionPolicy(null));
  assert.throws(()=>policyFromPercent({},'minimumMargin',101));
  assert.deepEqual(policyFromPercent({minimumConfidence:.7,minimumMargin:.1},'minimumConfidence',80),{minimumConfidence:.8,minimumMargin:.1});
});

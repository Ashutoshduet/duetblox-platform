import {cloneNumberArtifact} from '../ml/numbers/model.js';
import {normalizePredictionPolicy} from '../ml/decision.js';

export function portableNumbersModel(artifact) {
  const model=cloneNumberArtifact(artifact);model.predictionPolicy=normalizePredictionPolicy(model.predictionPolicy);
  // AVR double is 32-bit. Reject underflow/overflow in learned constants instead
  // of shipping a different model. Ordinary float rounding is still expected.
  const constants=[...model.means,...model.scales,...(model.weights?.flat()||[]),...(model.biases||[]),...(model.coefficients||[]),...(model.intercept===undefined?[]:[model.intercept])];
  if(constants.some(value=>!Number.isFinite(Math.fround(value))||(value!==0&&Math.fround(value)===0)))throw new Error('This model contains constants outside 32-bit float range. Rescale your training data before board export.');
  if(model.scales.some((scale,i)=>Math.abs(model.means[i])>0&&scale<Math.abs(model.means[i])*2**-22))throw new Error('An input varies too little relative to its offset for reliable 32-bit board arithmetic. Subtract that offset from the training and sensor values.');
  return model;
}
const number=value=>{const literal=Number(value).toString();return /[.e]/i.test(literal)?literal:`${literal}.0`;};
const vector=values=>`{${values.map(number).join(', ')}}`;
export function numbersRuntimeSource(artifact) {
  const model=portableNumbersModel(artifact),n=model.features.length;
  const common=`
// DUETBlox numerical model: ${model.task}; ${n} features; ${model.trainingRows} training rows.
// Standalone inference only. Training remains in the browser. Class index 0 means Unknown.
static const int DUET_NUMBERS_INPUTS = ${n};
static const double duetNumbersMeans[${n}] = ${vector(model.means)};
static const double duetNumbersScales[${n}] = ${vector(model.scales)};
static double duetNumbersInputs[${n}] = {0};
static bool duetNumbersInputSet[${n}] = {false};
static double duetNumbersValue = 0;
static double duetNumbersConfidence = 0;
static int duetNumbersClassIndex = 0;
static bool duetNumbersAccepted = false;
static void duetNumbersClearResult() { duetNumbersValue = 0; duetNumbersConfidence = 0; duetNumbersClassIndex = 0; duetNumbersAccepted = false; }
static bool duetNumbersSetInput(int index, double value) {
  if (index < 1 || index > DUET_NUMBERS_INPUTS) { duetNumbersClearResult(); return false; }
  duetNumbersInputSet[index - 1] = false;
  if (!isfinite(value) || fabs(value) > 1e9) { duetNumbersClearResult(); return false; }
  duetNumbersInputs[index - 1] = value; duetNumbersInputSet[index - 1] = true; return true;
}
`;
  const preparation=`
  duetNumbersClearResult();
  double z[${n}];
  for (int j = 0; j < DUET_NUMBERS_INPUTS; ++j) {
    if (!duetNumbersInputSet[j]) return false;
    z[j] = (duetNumbersInputs[j] - duetNumbersMeans[j]) / duetNumbersScales[j];
    if (!isfinite(z[j]) || fabs(z[j]) > 1e12) return false;
  }
`;
  if(model.task==='regression')return common+`static const double duetNumbersCoefficients[${n}] = ${vector(model.coefficients)};
static bool duetNumbersPredict() {${preparation}
  double result = ${number(model.intercept)};
  for (int j = 0; j < DUET_NUMBERS_INPUTS; ++j) result += duetNumbersCoefficients[j] * z[j];
  if (!isfinite(result) || fabs(result) > 1e15) return false;
  duetNumbersValue = result; duetNumbersAccepted = true; return true;
}
`;
  const k=model.labels.length,{minimumConfidence,minimumMargin}=model.predictionPolicy;
  return common+`static const int DUET_NUMBERS_CLASSES = ${k};
static const double duetNumbersWeights[${k}][${n}] = {${model.weights.map(vector).join(', ')}};
static const double duetNumbersBiases[${k}] = ${vector(model.biases)};
static bool duetNumbersPredict() {${preparation}
  double scores[${k}];
  for (int c = 0; c < DUET_NUMBERS_CLASSES; ++c) {
    scores[c] = duetNumbersBiases[c];
    for (int j = 0; j < DUET_NUMBERS_INPUTS; ++j) scores[c] += duetNumbersWeights[c][j] * z[j];
    if (!isfinite(scores[c])) return false;
  }
  int winner = 0;
  for (int c = 1; c < DUET_NUMBERS_CLASSES; ++c) if (scores[c] > scores[winner]) winner = c;
  const double maximum = scores[winner]; double total = 0;
  for (int c = 0; c < DUET_NUMBERS_CLASSES; ++c) { scores[c] = exp(scores[c] - maximum); total += scores[c]; }
  if (!isfinite(total) || total <= 0) return false;
  const double probability = scores[winner] / total; double second = 0;
  for (int c = 0; c < DUET_NUMBERS_CLASSES; ++c) if (c != winner && scores[c] / total > second) second = scores[c] / total;
  const double margin = probability - second;
  duetNumbersConfidence = probability * 100;
  duetNumbersAccepted = probability >= ${number(minimumConfidence)} && margin >= ${number(minimumMargin)} && margin > 0;
  duetNumbersClassIndex = duetNumbersAccepted ? winner + 1 : 0;
  return true;
}
`;
}

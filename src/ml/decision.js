// A model score is not a calibrated probability of being correct. This policy
// lets programs abstain when the score or lead is too small; it cannot detect
// every unfamiliar input or guarantee that accepted predictions are correct.
export const DEFAULT_PREDICTION_POLICY = Object.freeze({minimumConfidence: 0.7, minimumMargin: 0.1});

export function normalizePredictionPolicy(policy = DEFAULT_PREDICTION_POLICY) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('Invalid prediction settings.');
  const result = {};
  for (const key of ['minimumConfidence', 'minimumMargin']) {
    const value = policy[key] ?? DEFAULT_PREDICTION_POLICY[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Prediction settings must be numbers between 0 and 1.');
    }
    result[key] = value;
  }
  return result;
}

export function decidePrediction(predictions, policy = DEFAULT_PREDICTION_POLICY) {
  const settings = normalizePredictionPolicy(policy);
  const empty = {label: '', accepted: false, probability: 0, margin: 0, reason: 'no-prediction'};
  if (!Array.isArray(predictions) || !predictions.length) return empty;
  if (predictions.some(p => !p || typeof p.className !== 'string' || !p.className.trim() || !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 1)) {
    return {...empty, label: 'Unknown', reason: 'invalid-prediction'};
  }
  const ranked = [...predictions].sort((a, b) => b.probability - a.probability);
  const probability = ranked[0].probability;
  const margin = probability - (ranked[1]?.probability ?? 0);
  const reason = probability < settings.minimumConfidence ? 'low-confidence'
    : margin < settings.minimumMargin || (ranked.length > 1 && margin === 0) ? 'ambiguous' : 'accepted';
  return {label: reason === 'accepted' ? ranked[0].className : 'Unknown', accepted: reason === 'accepted', probability, margin, reason};
}

export function policyFromPercent(current, key, percent) {
  const value = Number(percent);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Choose a percentage from 0 to 100.');
  if (!['minimumConfidence', 'minimumMargin'].includes(key)) throw new Error('Unknown prediction setting.');
  return normalizePredictionPolicy({...current, [key]: value / 100});
}

import React, {useId, useState, useSyncExternalStore} from 'react';
import {DEFAULT_PREDICTION_POLICY, decidePrediction, policyFromPercent} from './decision.js';
import './prediction-controls.css';

export default function PredictionControls({service}) {
  const state = useSyncExternalStore(service.subscribe, service.snapshot);
  const id = useId();
  const [error, setError] = useState('');
  const policy = state.predictionPolicy || DEFAULT_PREDICTION_POLICY;
  const decision = state.decision || decidePrediction(state.predictions, policy);
  const change = async (key, value) => {
    try { setError(''); await service.setPredictionPolicy(policyFromPercent(policy, key, value)); }
    catch (e) { setError(e.message); }
  };
  return <section className="prediction-controls" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>When should the model say “Unknown”?</h3>
    <div className="prediction-settings">
      {[['minimumConfidence', 'Minimum top score'], ['minimumMargin', 'Minimum lead over second place']].map(([key, label]) => <label key={key} htmlFor={`${id}-${key}`}>
        {label}<select id={`${id}-${key}`} value={Math.round(policy[key] * 100)} disabled={state.busy} onChange={e => change(key, e.target.value)}>
          {[...new Set([...Array.from({length:21}, (_, i) => i * 5), Math.round(policy[key]*100)])].sort((a,b)=>a-b).map(v => <option key={v} value={v}>{v}%</option>)}
        </select>
      </label>)}
    </div>
    <p className="hint">Blocks return “Unknown” below either limit. Use “prediction accepted?” before triggering an action. Scores are model estimates, not a guarantee of correctness; unfamiliar inputs can still get high scores.</p>
    {state.predictions?.length > 0 && <p className={`prediction-decision ${decision.accepted ? 'accepted' : 'uncertain'}`} role="status">
      <strong>{decision.accepted ? `Accepted: ${decision.label}` : 'Unknown — do not trigger a class action'}</strong>
      <span>Top score {Math.round(decision.probability * 100)}% · lead {Math.round(decision.margin * 100)} percentage points</span>
    </p>}
    {error && <p role="alert" className="error-notice">{error}</p>}
  </section>;
}

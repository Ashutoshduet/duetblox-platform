import React, {useEffect, useId, useState} from 'react';

// A partially typed value is an editor draft, not a circuit edit. Commit once
// the learner finishes so clearing a field neither changes the circuit nor
// fills Undo with individual keystrokes.
export default function CircuitNumberField({label, value, min, max, disabled, onCommit}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const id = useId();
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  const finish = () => {
    if (disabled || draft === String(value)) return;
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) {
      setError(`Enter a value from ${min.toLocaleString()} to ${max.toLocaleString()}.`);
      return;
    }
    setError('');
    setDraft(String(number));
    if (number !== value) onCommit(number);
  };
  return <div className="circuit-number-field"><label htmlFor={id}>{label}</label>
    <input id={id} type="number" min={min} max={max} disabled={disabled} value={draft}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => { setDraft(event.target.value); setError(''); }}
      onBlur={finish} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); finish(); }
        if (event.key === 'Escape') { setDraft(String(value)); setError(''); }
      }}/>
    {error && <span id={`${id}-error`} className="circuit-field-error" role="alert">{error}</span>}
  </div>;
}

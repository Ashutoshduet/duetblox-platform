// This reports completed browser writes, not a promise that every open editor
// has already serialized its latest changes. Failures remain until that same
// record is successfully saved; an unrelated write must not hide lost work.
export function createWriteMonitor() {
  let sequence = 0;
  const pending = new Map(), outcomes = new Map(), listeners = new Set();
  let state = {pending: 0, errors: [], lastSavedAt: null};
  const publish = () => {
    state = {...state, pending: pending.size, errors: [...outcomes.values()].filter(v => v.error).map(v => v.error)};
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
    snapshot: () => state,
    begin(keys) {const token = ++sequence; pending.set(token, [...new Set(keys)]); publish(); return token;},
    finish(token, error) {
      const keys = pending.get(token);
      if (!keys) return;
      pending.delete(token);
      for (const key of keys) {
        if ((outcomes.get(key)?.token || 0) > token) continue;
        outcomes.set(key, {token, error: error ? (error.message || 'This browser could not save your work.') : null});
      }
      if (!error) state = {...state, lastSavedAt: Date.now()};
      publish();
    }
  };
}

export const localWrites = createWriteMonitor();

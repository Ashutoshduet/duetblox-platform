// Editing history belongs to the workspace service, not to a mounted panel.
// Weak keys keep separate app instances isolated and allow abandoned workspaces
// to be collected. Whole-project imports explicitly clear this registry.
const histories = new WeakMap();
const clone = value => structuredClone(value);
const fingerprint = circuit => JSON.stringify(circuit);

export class CircuitEditHistory {
  constructor(limit = 30) { this.limit = limit; this.boards = new Map(); }

  entry(circuit) {
    const key = fingerprint(circuit);
    let entry = this.boards.get(circuit.boardId);
    // An example, import or another editing surface can replace a circuit.
    // Do not offer an Undo that belongs to a different circuit revision.
    if (!entry || entry.key !== key) {
      entry = {key, past: [], future: []};
      this.boards.set(circuit.boardId, entry);
    }
    return entry;
  }

  canUndo(circuit) { return this.entry(circuit).past.length > 0; }
  canRedo(circuit) { return this.entry(circuit).future.length > 0; }

  commit(current, next, apply) {
    const entry = this.entry(current), key = fingerprint(next);
    if (key === entry.key) return false;
    apply(next);
    entry.past.push(clone(current));
    if (entry.past.length > this.limit) entry.past.shift();
    entry.future = [];
    entry.key = key;
    return true;
  }

  step(current, redo, apply) {
    const entry = this.entry(current);
    const from = entry[redo ? 'future' : 'past'];
    const to = entry[redo ? 'past' : 'future'];
    if (!from.length) return false;
    const next = clone(from.at(-1));
    apply(next);
    from.pop();
    to.push(clone(current));
    entry.key = fingerprint(next);
    return true;
  }
}

export function getCircuitHistory(service) {
  if (!histories.has(service)) histories.set(service, new CircuitEditHistory());
  return histories.get(service);
}

export function clearCircuitHistory(service) { histories.delete(service); }

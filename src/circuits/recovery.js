import {validateCircuit} from './model.js';

export const circuitRecoveryKey = boardId => `circuit-starter-recovery:${boardId}`;

// Persist before replacement. A concurrent import, board change or unmount must
// never apply a starter to a newer workspace after the storage await resolves.
export async function replaceCircuitSafely({service, next, persist, apply, isCurrent = () => true}) {
  const before = validateCircuit(service.getCircuit());
  const replacement = validateCircuit(next, {boardId: before.boardId});
  const fingerprint = JSON.stringify(before);
  if (fingerprint === JSON.stringify(replacement)) return false;
  await persist(circuitRecoveryKey(before.boardId), {kind: 'duetblox-circuit-recovery', version: 1, savedAt: Date.now(), circuit: before});
  if (!isCurrent() || JSON.stringify(service.getCircuit()) !== fingerprint) throw new Error('The circuit changed while its backup was saving. Your current circuit was kept. Try again.');
  apply(replacement);
  return before;
}

export function readCircuitRecovery(record, boardId) {
  if (!record || record.kind !== 'duetblox-circuit-recovery' || record.version !== 1) return null;
  return validateCircuit(record.circuit, {boardId});
}

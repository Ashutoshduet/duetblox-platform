// Native Scratch counters record completed Junior actions, including which
// conditional branch actually ran. They are compilation-only, never user data.
export const JUNIOR_COMPLETION_VERSION = 1;
export const JUNIOR_CANCEL_VARIABLE = '__duet_junior_cancelled';
export const JUNIOR_ACTION_TYPES = Object.freeze([
  'move', 'turn', 'turnLeft', 'right', 'left', 'up', 'down', 'hop',
  'grow', 'shrink', 'say', 'sound', 'stamp'
]);
export const juniorActionVariable = type => `__duet_junior_action_${type}`;

export function completedJuniorAction(source, value) {
  if (!JUNIOR_ACTION_TYPES.includes(source.type)) return null;
  if (source.type === 'say') return String(source.text || '').trim() && value > 0 ? source.type : null;
  if (source.type === 'sound' || source.type === 'stamp') return source.type;
  return Number.isFinite(value) && value !== 0 ? source.type : null;
}

function normalizeTracking(value) {
  if (value?.version !== JUNIOR_COMPLETION_VERSION || typeof value.sceneId !== 'string' || !value.sceneId) return null;
  return {version: JUNIOR_COMPLETION_VERSION, sceneId: value.sceneId};
}

const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const copyTargets = targets => (targets || []).filter(target => !target.isStage).map(target => ({
  id: target.id, name: target.name, x: target.x, y: target.y,
  direction: target.direction, size: target.size, visible: target.visible
}));

/**
 * A run is explicitly armed by the bridge after greenFlag has stopped the old
 * run. A running:false status by itself never implies success. readState reads
 * actual VM counters and target values; no DOM or timer guesses are involved.
 */
export function createJuniorCompletionTracker({readState, onComplete}) {
  let tracking = null, run = null, initialTargets = [];
  return {
    configure(value) {
      run = null; tracking = normalizeTracking(value);
      initialTargets = tracking ? copyTargets(readState()?.targets) : [];
    },
    begin(runId) {
      run = null;
      if (!tracking || typeof runId !== 'string' || !runId || runId.length > 160) return;
      const initial = readState();
      if (!initial || safeCount(initial.cancelled) === null) return;
      const counts = {};
      for (const type of JUNIOR_ACTION_TYPES) {
        const value = safeCount(initial.actions?.[type]);
        if (value === null) return;
        counts[type] = value;
      }
      run = {runId, counts, cancelled: initial.cancelled, initialTargets, started: Boolean(initial.running)};
    },
    started() {if (run) run.started = true;},
    cancel() {run = null;},
    finish() {
      const completed = run;
      run = null;
      if (!completed?.started || !tracking) return null;
      const final = readState();
      if (!final || final.running || final.sceneId !== tracking.sceneId ||
          final.cancelled !== completed.cancelled) return null;
      const actions = {};
      for (const type of JUNIOR_ACTION_TYPES) {
        const value = safeCount(final.actions?.[type]);
        if (value === null || value < completed.counts[type]) return null;
        const count = value - completed.counts[type];
        if (count) actions[type] = count;
      }
      const actionCount = Object.values(actions).reduce((sum, count) => sum + count, 0);
      if (!Number.isSafeInteger(actionCount) || actionCount < 1) return null;
      const event = {version: JUNIOR_COMPLETION_VERSION, runId: completed.runId, outcome: 'completed',
        sceneId: final.sceneId, actionCount, actions,
        initialTargets: completed.initialTargets, targets: copyTargets(final.targets)};
      onComplete?.(event);
      return event;
    }
  };
}

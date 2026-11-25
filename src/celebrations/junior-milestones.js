export const JUNIOR_CHALLENGES = {
  right: {title: 'Move 3 squares right', hint: 'Use Motion → Go right with 3 squares. Finish 60 pixels to the right, on the same row.', success: 'Your character finished exactly 3 squares to the right.', dance: 'shuffle'},
  turn: {title: 'Make a quarter turn', hint: 'Use Turn with 90 degrees. Finish facing a quarter turn clockwise from the starting direction.', success: 'Your character finished a quarter turn clockwise.', dance: 'spin'}
};

export function completedRunMatches(result, run) {
  return Boolean(run && result?.version === 1 && result.outcome === 'completed' && result.runId === run.id &&
    result.sceneId === run.sceneId && Number.isSafeInteger(result.actionCount) && result.actionCount > 0);
}

// Read actual VM positions, not the presence of a block or the Run button.
export function checkJuniorChallenge(result, run) {
  const challenge = JUNIOR_CHALLENGES[run?.challenge];
  if (!challenge || !completedRunMatches(result, run)) return false;
  const before = result.initialTargets?.[run.targetIndex];
  const after = result.targets?.find(target => target.id === before?.id);
  if (!before || !after || !before.visible || !after.visible) return false;
  if (run.challenge === 'right') {
    if (![before.x, before.y, after.x, after.y].every(Number.isFinite)) return false;
    return Math.abs(after.x - before.x - 60) < .01 && Math.abs(after.y - before.y) < .01;
  }
  if (![before.direction, after.direction].every(Number.isFinite)) return false;
  const clockwise = ((after.direction - before.direction) % 360 + 360) % 360;
  return Math.abs(clockwise - 90) < .01;
}

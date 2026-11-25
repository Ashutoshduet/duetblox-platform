export const JUNIOR_CANVAS_LIMIT = 10000;

/** Optional v2 editor metadata; it never changes a script's execution order. */
export function normalizeJuniorScriptPosition(value) {
  if (!value || typeof value !== 'object' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return {
    x: Math.round(Math.max(0, Math.min(JUNIOR_CANVAS_LIMIT, value.x))),
    y: Math.round(Math.max(0, Math.min(JUNIOR_CANVAS_LIMIT, value.y)))
  };
}

export function juniorScriptPosition(script, index) {
  return normalizeJuniorScriptPosition(script.canvas) || {x: 20 + (index % 2) * 350, y: 20 + Math.floor(index / 2) * 100};
}

export function moveJuniorScriptPosition(position, dx, dy) {
  return normalizeJuniorScriptPosition({x: position.x + dx, y: position.y + dy});
}

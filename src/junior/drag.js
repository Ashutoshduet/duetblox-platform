import {BLOCK_TYPES, TRIGGERS} from './model.js';
import {normalizeJuniorScriptPosition} from './script-layout.js';

// Separate payloads keep files, external text and stale project drags out of the editor.
export const JUNIOR_DRAG_TYPE = 'application/x-duetblox-junior';
export function readJuniorDrag(transfer) {
  try {
    const raw = transfer.getData(JUNIOR_DRAG_TYPE);
    if (!raw || raw.length > 500) return null;
    const value = JSON.parse(raw);
    if (value?.kind === 'palette' && Object.hasOwn(BLOCK_TYPES, value.type)) return {kind: 'palette', type: value.type};
    if (value?.kind === 'trigger' && Object.hasOwn(TRIGGERS, value.trigger)) return {kind: 'trigger', trigger: value.trigger};
    if (value?.kind === 'block' && typeof value.id === 'string' && value.id.length > 0 && typeof value.scriptId === 'string' && value.scriptId.length > 0) return {kind: 'block', id: value.id, scriptId: value.scriptId};
  } catch { /* Unsupported drops leave the project unchanged. */ }
  return null;
}

export function writeJuniorDrag(transfer, value) {
  transfer.setData(JUNIOR_DRAG_TYPE, JSON.stringify(value));
  transfer.effectAllowed = value.kind === 'block' ? 'move' : 'copy';
}

/** Browser pointer coordinates become stable project coordinates at any zoom. */
export function juniorCanvasPoint({clientX, clientY, left, top, scrollLeft = 0, scrollTop = 0, zoom = 1}) {
  if (![clientX, clientY, left, top, scrollLeft, scrollTop, zoom].every(Number.isFinite) || zoom <= 0) return null;
  return normalizeJuniorScriptPosition({
    x: (clientX - left + scrollLeft) / zoom,
    y: (clientY - top + scrollTop) / zoom
  });
}

/** Move a block to a gap in the original list (0 = before first, length = after last). */
export function moveJuniorBlockToGap(blocks, id, gap) {
  const from = blocks.findIndex(block => block.id === id);
  if (from < 0 || !Number.isInteger(gap) || gap < 0 || gap > blocks.length) return blocks;
  const to = gap > from ? gap - 1 : gap;
  if (to === from) return blocks;
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(to, 0, block);
  return next;
}

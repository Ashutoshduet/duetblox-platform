import {BLOCK_TYPES} from './model.js';

// Separate payloads keep files, external text and stale project drags out of the editor.
export const JUNIOR_DRAG_TYPE = 'application/x-duetblox-junior';
export function readJuniorDrag(transfer) {
  try {
    const raw = transfer.getData(JUNIOR_DRAG_TYPE);
    if (!raw || raw.length > 500) return null;
    const value = JSON.parse(raw);
    if (value?.kind === 'palette' && Object.hasOwn(BLOCK_TYPES, value.type)) return {kind: 'palette', type: value.type};
    if (value?.kind === 'block' && typeof value.id === 'string' && typeof value.scriptId === 'string') return {kind: 'block', id: value.id, scriptId: value.scriptId};
  } catch { /* Unsupported drops leave the project unchanged. */ }
  return null;
}

export function writeJuniorDrag(transfer, value) {
  transfer.setData(JUNIOR_DRAG_TYPE, JSON.stringify(value));
  transfer.effectAllowed = value.kind === 'palette' ? 'copy' : 'move';
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

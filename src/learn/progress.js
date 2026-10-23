import {LESSONS, lessonById} from './lessons.js';

export const PROGRESS_KEY = 'duetblox-learning-v1';
export const emptyProgress = () => ({version: 1, locale: 'en', selected: LESSONS[0].id, active: null, steps: {}, completed: {}});

export function normalizeProgress(value) {
  const next = emptyProgress();
  if (!value || value.version !== 1) return next;
  if (value.locale === 'hi') next.locale = 'hi';
  if (lessonById(value.selected)) next.selected = value.selected;
  if (lessonById(value.active)) next.active = value.active;
  for (const lesson of LESSONS) {
    const index = value.steps?.[lesson.id];
    next.steps[lesson.id] = Number.isInteger(index) ? Math.max(0, Math.min(index, lesson.steps.length - 1)) : 0;
    const done = Array.isArray(value.completed?.[lesson.id]) ? value.completed[lesson.id] : [];
    next.completed[lesson.id] = lesson.steps.filter(step => done.includes(step.id)).map(step => step.id);
  }
  return next;
}

export function updateProgress(value, action) {
  const next = normalizeProgress(value);
  if (action.type === 'locale') return {...next, locale: action.locale === 'hi' ? 'hi' : 'en'};
  if (action.type === 'pause') return {...next, active: null};
  const lesson = lessonById(action.lessonId);
  if (!lesson) return next;
  if (action.type === 'select') return {...next, selected: lesson.id};
  if (action.type === 'start') return {...next, selected: lesson.id, active: lesson.id};
  if (action.type === 'step' && Number.isInteger(action.index)) {
    return {...next, steps: {...next.steps, [lesson.id]: Math.max(0, Math.min(action.index, lesson.steps.length - 1))}};
  }
  if (action.type === 'check' && lesson.steps.some(step => step.id === action.stepId)) {
    const done = new Set(next.completed[lesson.id]);
    if (action.checked === true) done.add(action.stepId); else done.delete(action.stepId);
    return {...next, completed: {...next.completed, [lesson.id]: lesson.steps.filter(step => done.has(step.id)).map(step => step.id)}};
  }
  if (action.type === 'reset') {
    return {...next, steps: {...next.steps, [lesson.id]: 0}, completed: {...next.completed, [lesson.id]: []}};
  }
  return next;
}

export function lessonProgress(state, lessonId) {
  const lesson = lessonById(lessonId);
  if (!lesson) return {completed: 0, total: 0, index: 0, finished: false};
  const safe = normalizeProgress(state), completed = safe.completed[lessonId].length;
  return {completed, total: lesson.steps.length, index: safe.steps[lessonId], finished: completed === lesson.steps.length};
}

// A factory keeps tests independent and lets both the Learn page and the small
// companion observe the same state without reading or changing project storage.
export function createProgressStore(storage) {
  let state = emptyProgress(), storageError = false;
  const listeners = new Set();
  try { const saved = storage?.getItem(PROGRESS_KEY); if (saved) state = normalizeProgress(JSON.parse(saved)); }
  catch { storageError = true; }
  let snapshot = {progress: state, storageError};
  const emit = () => {snapshot = {progress: state, storageError}; for (const listener of listeners) listener();};
  return {
    snapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispatch(action) {
      state = updateProgress(state, action);
      try {
        if (!storage) throw new Error('Local storage is unavailable.');
        storage.setItem(PROGRESS_KEY, JSON.stringify(state)); storageError = false;
      } catch { storageError = true; }
      emit();
    },
    refresh(raw) {
      try {state = raw === null ? emptyProgress() : normalizeProgress(JSON.parse(raw)); storageError = false;}
      catch {storageError = true;}
      emit();
    }
  };
}

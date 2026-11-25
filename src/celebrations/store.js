export const CELEBRATION_KEY = 'duetblox-celebrations-v1';
export const DANCES = ['bounce', 'shuffle', 'spin', 'high-five', 'victory'];
export const DEFAULT_PREFERENCES = Object.freeze({enabled: true, sound: false, reduceMotion: false, mascot: 'zuni', dance: 'surprise', palette: 'lilac'});

export function normalizePreferences(value = {}) {
  const next = {...DEFAULT_PREFERENCES};
  for (const key of ['enabled', 'sound', 'reduceMotion']) if (typeof value?.[key] === 'boolean') next[key] = value[key];
  for (const [key, choices] of Object.entries({mascot: ['zuni', 'duvi', 'tiko'], dance: ['surprise', ...DANCES], palette: ['lilac', 'ocean', 'sunset']})) {
    if (choices.includes(value?.[key])) next[key] = value[key];
  }
  return next;
}

// Separate from student project data. Only preferences and bounded milestone IDs
// are persisted; no names, code, scores, or usage telemetry are collected.
export function createCelebrationStore(storage) {
  let preferences = {...DEFAULT_PREFERENCES}, seen = [], event = null, serial = 0, storageError = false;
  const listeners = new Set();
  const read = raw => {
    const saved = raw ? JSON.parse(raw) : null;
    preferences = normalizePreferences(saved?.version === 1 ? saved.preferences : null);
    seen = saved?.version === 1 && Array.isArray(saved.seen) ? [...new Set(saved.seen.filter(key => typeof key === 'string' && key.length <= 220))].slice(-500) : [];
  };
  try {read(storage?.getItem(CELEBRATION_KEY));} catch {storageError = true;}
  let snapshot = {preferences, event, storageError};
  const emit = () => {snapshot = {preferences, event, storageError}; for (const listener of listeners) listener();};
  const persist = () => {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(CELEBRATION_KEY, JSON.stringify({version: 1, preferences, seen})); storageError = false;
    } catch {storageError = true;}
  };
  return {
    snapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
    setPreferences(patch) {
      preferences = normalizePreferences({...preferences, ...patch});
      if (!preferences.enabled) event = null;
      persist(); emit();
    },
    hasSeen(key) {return seen.includes(key);},
    publish({key, scope, title, message, dance}) {
      if (!preferences.enabled || typeof key !== 'string' || !key || key.length > 220 || seen.includes(key)) return false;
      if (typeof scope !== 'string' || typeof title !== 'string' || typeof message !== 'string') return false;
      const nextDance = preferences.dance === 'surprise' ? (DANCES.includes(dance) ? dance : DANCES[seen.length % DANCES.length]) : preferences.dance;
      seen = [...seen, key].slice(-500);
      event = {id: ++serial, key, scope, title, message, dance: nextDance};
      persist(); emit(); return true;
    },
    clear(scope) {if (event && (!scope || event.scope === scope)) {event = null; emit();}},
    refresh(raw) {
      try {read(raw); storageError = false; event = null;} catch {storageError = true;}
      emit();
    }
  };
}

let storage;
try {storage = globalThis.localStorage;} catch { /* Memory-only support for restricted browsers. */ }
export const celebrations = createCelebrationStore(storage);

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.storageArea === storage && (event.key === CELEBRATION_KEY || event.key === null)) celebrations.refresh(event.newValue);
});

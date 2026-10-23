// A workspace import can begin and finish before React cleans up an old timer.
// Capture both the operation epoch and dataset identity; neither busy alone nor
// a component render generation alone can identify that completed import.
export const datasetEpoch = service => service.operationEpoch ?? service.epoch ?? 0;
const idle = service => !service.operation && !service.snapshot?.().busy;
export function datasetGuard(service, isCurrent = () => true) {
  const epoch = datasetEpoch(service), dataset = service.dataset;
  return ({requireIdle = true} = {}) => isCurrent() && datasetEpoch(service) === epoch && service.dataset === dataset && (!requireIdle || idle(service));
}
export function scheduleDatasetSave({service, dataset, write, onError = () => {}, isCurrent = () => true, delay = 350, setTimer = setTimeout, clearTimer = clearTimeout}) {
  const current = datasetGuard(service, isCurrent);
  let cancelled = false;
  const timer = setTimer(async () => {
    if (cancelled || !current() || service.dataset !== dataset) return;
    try { await write(dataset); }
    catch (error) { if (!cancelled && current()) onError(error); }
  }, delay);
  return () => { cancelled = true; clearTimer(timer); };
}
function waitUntilIdle(service, signal) {
  if (signal?.aborted || idle(service)) return Promise.resolve();
  return new Promise(resolve => {
    let unsubscribe = () => {};
    const finish = () => { unsubscribe(); signal?.removeEventListener('abort', finish); resolve(); };
    unsubscribe = service.subscribe(() => { if (idle(service)) finish(); });
    signal?.addEventListener('abort', finish, {once:true});
    if (signal?.aborted || idle(service)) finish();
  });
}
// apply is synchronous, so no operation can interleave between the last guard
// and replacement of component/service state. Abort superseded refreshes.
export async function hydrateDataset({service, read, apply, signal}) {
  while (!signal.aborted) {
    await waitUntilIdle(service, signal);
    if (signal.aborted) return false;
    const current = datasetGuard(service, () => !signal.aborted);
    let value;
    try { value = await read(); }
    catch (error) { if (signal.aborted) return false; if (!current()) continue; throw error; }
    if (signal.aborted) return false;
    if (!current()) continue;
    apply(value);
    return true;
  }
  return false;
}
// Dataset loaders do not call prediction/model import APIs while holding this
// lock. Those APIs own their own operation token and must not be nested.
export async function loadDatasetOperation({service, message, load, apply, isCurrent = () => true}) {
  const token = service.beginOperation(message), epoch = datasetEpoch(service);
  let failure;
  try {
    const value = await load();
    if (service.operation !== token || datasetEpoch(service) !== epoch || !isCurrent()) return false;
    apply(value);
    return true;
  } catch (error) { failure = error; throw error; }
  finally { service.endOperation(token, failure); }
}

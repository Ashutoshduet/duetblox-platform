// Scratch's upstream minimum layout is 1024px wide. An embedded editor has
// less room than the browser window, so choose its public small-stage mode
// from the iframe's own width. Keep a student's explicit size choice whenever
// it fits, and restore it after a temporarily narrow viewport becomes wider.
export function createResponsiveStage(state, setStageSize) {
  let preferred = null;
  let applying = false;
  let disposed = false;
  let previous = state.store.getState().scratchGui.stageSize.stageSize;
  function update() {
    if (disposed || window.innerWidth <= 0) return;
    const width = window.innerWidth;
    const desired = width < 850 ? 'small' : preferred || (width < 1024 ? 'small' : 'large');
    if (state.store.getState().scratchGui.stageSize.stageSize === desired) return;
    applying = true;
    try {state.dispatch(setStageSize(desired));}
    finally {applying = false;}
  }
  const unsubscribe = state.store.subscribe(() => {
    const current = state.store.getState().scratchGui.stageSize.stageSize;
    if (current === previous) return;
    previous = current;
    if (!applying) {
      preferred = current;
      // Avoid dispatching inside another reducer notification.
      queueMicrotask(update);
    }
  });
  window.addEventListener('resize', update);
  update();
  return () => {disposed = true; unsubscribe(); window.removeEventListener('resize', update);};
}

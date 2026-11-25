import {UnoFirmwareRunner} from './uno-runner.js';
let runner, running = false, timer, lastPublished = 0;
const pause = () => { running = false; clearTimeout(timer); };
const publish = () => { if (runner) { postMessage({type: 'state', running, ...runner.getState()}); lastPublished = performance.now(); } };
const fail = error => { pause(); postMessage({type: 'error', message: error.message}); };
const tick = () => {
  if (!running || !runner) return;
  try {
    const started = performance.now(), previousCycles = runner.cpu.cycles;
    runner.runCycles(160000, {timeBudgetMs: 12});
    if (performance.now() - lastPublished >= 80) publish();
    const simulatedMilliseconds = (runner.cpu.cycles - previousCycles) / 16000;
    timer = setTimeout(tick, Math.max(0, simulatedMilliseconds - (performance.now() - started)));
  } catch (error) { fail(error); }
};
self.onmessage = ({data}) => {
  try {
    if (data.type === 'load') { pause(); runner = new UnoFirmwareRunner({hex: data.hex, circuit: data.circuit}); publish(); }
    else if (data.type === 'run') { if (!runner) throw new Error('Load Uno HEX firmware first.'); if (!running) { running = true; publish(); tick(); } }
    else if (data.type === 'pause') { pause(); publish(); }
    else if (data.type === 'step') { if (!runner) throw new Error('Load Uno HEX firmware first.'); pause(); runner.runCycles(160000); publish(); }
    else if (data.type === 'circuit') { runner?.setCircuit(data.circuit); publish(); }
  } catch (error) { fail(error); }
};

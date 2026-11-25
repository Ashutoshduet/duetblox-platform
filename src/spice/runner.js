import {RUN_TIMEOUT_MS, validateNetlist} from './model.js';

export class SpiceRunner {
  constructor({onChange = () => {}, createWorker = () => new Worker(new URL('./worker.js', import.meta.url), {type: 'module'}), timeoutMs = RUN_TIMEOUT_MS, retryDelayMs = 250} = {}) {
    this.onChange = onChange;
    this.createWorker = createWorker;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.worker = null;
    this.timer = null;
    this.retryTimer = null;
    this.id = 0;
    this.state = {errorKind: null, status: 'idle', message: 'Choose an example or describe your circuit.', result: null, log: '', warnings: [], elapsed: null};
  }
  emit(patch) { this.state = {...this.state, ...patch}; this.onChange(this.state); }
  release() {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
    this.worker?.terminate();
    this.worker = null;
  }
  run(netlist) {
    this.release();
    const id = ++this.id;
    try {
      validateNetlist(netlist);
      this.emit({errorKind: null, status: 'loading', message: 'Loading the local ngspice solver…', result: null, log: '', warnings: [], elapsed: null});
      let solverStarted = false;
      const startWorker = (retried = false) => {
        if (id !== this.id) return;
        const worker = this.createWorker();
        this.worker = worker;
        let started = false;
        worker.onmessage = ({data}) => {
          if (id !== this.id || data?.id !== id || worker !== this.worker) return;
          // The worker's first message proves its module has loaded. From here
          // onward, failures belong to solver execution and must not be retried.
          started = true;
          solverStarted = true;
          if (data.type === 'loading' || data.type === 'running') this.emit({status: data.type, message: data.message});
          else if (data.type === 'done') {
            this.release();
            this.emit({status: 'completed', message: `Solved ${data.result.points.toLocaleString()} data points.`, result: data.result, log: data.log || '', warnings: data.warnings || [], elapsed: data.elapsed});
          } else if (data.type === 'error') {
            this.release();
            this.emit({status: 'error', message: data.message, log: data.log || '', warnings: data.warnings || []});
          }
        };
        worker.onerror = event => {
          if (id !== this.id || worker !== this.worker) return;
          event.preventDefault?.();
          if (!started && !retried) {
            worker.terminate();
            this.worker = null;
            this.emit({status: 'loading', message: 'Solver loading was interrupted. Retrying once…', log: String(event.message || 'The browser could not finish loading the solver worker.')});
            this.retryTimer = setTimeout(() => {
              this.retryTimer = null;
              if (id !== this.id) return;
              try { startWorker(true); }
              catch (error) { this.release(); this.emit({errorKind: 'startup', status: 'error', message: 'The solver could not start. Check your connection or offline pack, then run again.', log: String(error.message || error)}); }
            }, this.retryDelayMs);
            return;
          }
          this.release();
          this.emit({errorKind: started ? 'solver' : 'startup', status: 'error', message: started ? 'The solver stopped unexpectedly. Check the circuit, then run again.' : 'The solver could not start after one retry. Check your connection or offline pack, then run again.', log: String(event.message || 'The browser did not provide further worker error details.')});
        };
        worker.postMessage({id, netlist});
      };
      // One deadline covers the initial download, the single retry, and solving.
      // A failed worker must never reset or invalidate the overall time limit.
      this.timer = setTimeout(() => {
        if (id !== this.id) return;
        this.release();
        this.id++;
        this.emit({status: 'timeout', message: solverStarted ? `Stopped after ${Math.round(this.timeoutMs / 1000)} seconds. Simplify the circuit or increase its time step.` : `The solver did not start within ${Math.round(this.timeoutMs / 1000)} seconds. Check your connection or offline pack, then run again.`});
      }, this.timeoutMs);
      startWorker();
    } catch (error) {
      this.release();
      this.emit({errorKind: null, status: 'error', message: String(error.message || error), result: null, log: '', warnings: [], elapsed: null});
    }
  }
  stop(message = 'Simulation stopped. Your circuit is kept.') {
    const busy = !!this.worker || this.retryTimer !== null;
    this.id++;
    this.release();
    if (busy) this.emit({status: 'stopped', message});
  }
  clear() { this.stop(); this.emit({errorKind: null, status: 'idle', message: 'Run the circuit to measure it.', result: null, log: '', warnings: [], elapsed: null}); }
  dispose() { this.id++; this.release(); this.onChange = () => {}; }
}

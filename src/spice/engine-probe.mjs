// Node-only regression harness: each real WASM run owns a disposable thread.
import {parentPort,workerData} from 'node:worker_threads';
import {Simulation} from 'eecircuit-engine';
import {validateNetlist,normalizeSpiceResult} from './model.js';
try{
  const input=validateNetlist(workerData.netlist),simulation=new Simulation();
  await simulation.start();simulation.setNetList(input.netlist);
  const raw=await simulation.runSim();
  parentPort.postMessage({result:normalizeSpiceResult(raw,input.analysis),errors:simulation.getError(),log:simulation.getInfo()});
}catch(error){parentPort.postMessage({error:String(error.stack||error)});}

import {Simulation} from 'eecircuit-engine';
import {validateNetlist, normalizeSpiceResult} from './model.js';

// The engine and its embedded WASM are bundled locally by Vite. One worker owns one run.
self.onmessage=async ({data})=>{
  const send=(type,extra={})=>self.postMessage({id:data.id,type,...extra});
  let simulation;
  try{
    const input=validateNetlist(data.netlist);
    simulation=new Simulation();
    send('loading',{message:'Loading the local ngspice solver…'});
    await simulation.start();
    send('running',{message:'Solving circuit equations…'});
    simulation.setNetList(input.netlist);
    const started=performance.now();
    const raw=await simulation.runSim();
    const result=normalizeSpiceResult(raw,input.analysis);
    send('done',{result,elapsed:Math.round(performance.now()-started),log:simulation.getInfo().slice(-16000),warnings:simulation.getError().slice(0,20).map(String)});
  }catch(error){send('error',{message:String(error?.message||error).slice(0,2000),log:String(simulation?.getInfo()||'').slice(-16000),warnings:simulation?.getError()?.slice(0,20).map(String)||[]});}
};

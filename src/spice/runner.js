import {RUN_TIMEOUT_MS,validateNetlist} from './model.js';

export class SpiceRunner {
  constructor({onChange=()=>{},createWorker=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),timeoutMs=RUN_TIMEOUT_MS}={}) {
    this.onChange=onChange;this.createWorker=createWorker;this.timeoutMs=timeoutMs;this.worker=null;this.timer=null;this.id=0;
    this.state={status:'idle',message:'Choose an example or describe your circuit.',result:null,log:'',warnings:[],elapsed:null};
  }
  emit(patch){this.state={...this.state,...patch};this.onChange(this.state);}
  release(){clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;}
  run(netlist){
    this.release();const id=++this.id;
    try{
      validateNetlist(netlist);
      this.emit({status:'loading',message:'Loading the local ngspice solver…',result:null,log:'',warnings:[],elapsed:null});
      const worker=this.createWorker();this.worker=worker;
      worker.onmessage=({data})=>{
        if(id!==this.id||data?.id!==id||worker!==this.worker)return;
        if(data.type==='loading'||data.type==='running')this.emit({status:data.type,message:data.message});
        else if(data.type==='done'){
          this.release();this.emit({status:'completed',message:`Solved ${data.result.points.toLocaleString()} data points.`,result:data.result,log:data.log||'',warnings:data.warnings||[],elapsed:data.elapsed});
        }else if(data.type==='error'){
          this.release();this.emit({status:'error',message:data.message,log:data.log||'',warnings:data.warnings||[]});
        }
      };
      worker.onerror=event=>{if(id!==this.id||worker!==this.worker)return;event.preventDefault?.();this.release();this.emit({status:'error',message:'The solver could not load or stopped unexpectedly. Check the circuit, then run again.',log:String(event.message||'Worker error')});};
      this.timer=setTimeout(()=>{if(id!==this.id||worker!==this.worker)return;this.release();this.id++;this.emit({status:'timeout',message:`Stopped after ${Math.round(this.timeoutMs/1000)} seconds. Simplify the circuit or increase its time step.`});},this.timeoutMs);
      worker.postMessage({id,netlist});
    }catch(error){this.release();this.emit({status:'error',message:String(error.message||error),result:null,log:'',warnings:[],elapsed:null});}
  }
  stop(message='Simulation stopped. Your circuit is kept.'){
    const busy=!!this.worker;this.id++;this.release();if(busy)this.emit({status:'stopped',message});
  }
  clear(){this.stop();this.emit({status:'idle',message:'Run the circuit to measure it.',result:null,log:'',warnings:[],elapsed:null});}
  dispose(){this.id++;this.release();this.onChange=()=>{};}
}

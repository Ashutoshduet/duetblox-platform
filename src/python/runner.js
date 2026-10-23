import {validatePythonProject} from './project.js';

export const RUN_TIMEOUT_MS=30000;
export const LOAD_TIMEOUT_MS=60000;
export const OUTPUT_LIMIT=64000;

export class PythonRunner {
  constructor({workerFactory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),onChange=()=>{},runTimeout=RUN_TIMEOUT_MS,loadTimeout=LOAD_TIMEOUT_MS}={}){
    this.workerFactory=workerFactory;this.onChange=onChange;this.runTimeout=runTimeout;this.loadTimeout=loadTimeout;
    this.worker=null;this.timer=null;this.id=0;this.disposed=false;
    this.state={status:'idle',output:[],characters:0,message:'Ready to run Python.',elapsed:null};
  }
  update(patch){this.state={...this.state,...patch};this.onChange(this.state);return this.state;}
  clear(){if(this.worker)throw new Error('Stop the running program before clearing output.');this.update({output:[],characters:0,message:'Output cleared.',status:'idle',elapsed:null});}
  finish(status,message){clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;this.id++;this.update({status,message});}
  run(value){
    if(this.disposed)throw new Error('The Python workspace has closed.');
    if(this.worker)throw new Error('A Python program is already running.');
    const project=validatePythonProject(value);const id=++this.id;
    this.update({status:'loading',message:'Loading the local Python runtime…',output:[],characters:0,elapsed:null});
    let worker;
    try{worker=this.workerFactory();}catch(error){this.finish('error',`Could not start Python: ${error.message}`);return;}
    this.worker=worker;
    this.timer=setTimeout(()=>{if(this.id===id)this.finish('error','The Python runtime did not load in time. Prepare the offline pack, then try again.');},this.loadTimeout);
    worker.onmessage=({data})=>{
      if(this.disposed||this.id!==id||this.worker!==worker||!data||data.id!==id)return;
      if(data.type==='running'){
        clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.id===id)this.finish('timeout','Stopped after 30 seconds. Shorten the program or add a finite loop.');},this.runTimeout);
        this.update({status:'running',message:'Running Python…'});
      }else if(data.type==='output'&&typeof data.text==='string'){
        const text=data.text.slice(0,Math.max(0,OUTPUT_LIMIT-this.state.characters));
        const stream=data.stream==='stderr'?'stderr':'stdout';
        const output=this.state.output.slice(),last=output.at(-1);
        if(last?.stream===stream)output[output.length-1]={stream,text:last.text+text};else output.push({stream,text});
        this.update({output,characters:this.state.characters+text.length});
        if(data.text.length>text.length||this.state.characters>=OUTPUT_LIMIT)this.finish('limit','Stopped at the 64,000-character output limit. Print fewer values.');
      }else if(data.type==='done'){
        this.update({elapsed:Number.isFinite(data.elapsed)?data.elapsed:null});this.finish('completed','Program finished. Each Run starts with fresh variables and files.');
      }else if(data.type==='error')this.finish('error',String(data.message||'Python could not run.').slice(0,12000));
    };
    worker.onerror=event=>{if(this.id!==id)return;event.preventDefault?.();this.finish('error','Python could not load or its worker stopped. Check that the offline runtime is installed, then try again.');};
    worker.onmessageerror=()=>{if(this.id===id)this.finish('error','The Python worker could not return its result.');};
    worker.postMessage({id,project});
  }
  stop(message='Stopped. Your code and input are kept.'){
    if(this.worker)this.finish('stopped',message);
  }
  dispose(){this.disposed=true;this.stop('Python workspace closed.');this.onChange=()=>{};}
}

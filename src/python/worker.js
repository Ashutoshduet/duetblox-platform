import {inputLines,validatePythonProject} from './project.js';

// Only the pinned local core distribution is loaded. No import-based package downloads.
const runtimeBase=new URL('/python/runtime/',self.location.origin).href;
const runtimeLoader=runtimeBase+'pyodide.mjs';
const rawFetch=self.fetch.bind(self);
self.fetch=(url,options)=>{
  const target=new URL(typeof url==='string'?url:url instanceof URL?url.href:url.url,self.location.href);
  if(!target.href.startsWith(runtimeBase))return Promise.reject(new Error('Network access is disabled in the Python workspace.'));
  return rawFetch(url,options);
};

self.onmessage=async({data})=>{
  const {id}=data||{};
  const send=(type,extra={})=>self.postMessage({id,type,...extra});
  let pending='',pendingStream='stdout',lastFlush=0;
  const flush=()=>{if(pending){send('output',{stream:pendingStream,text:pending});pending='';lastFlush=performance.now();}};
  const append=(stream,text)=>{if(stream!==pendingStream)flush();pendingStream=stream;pending+=text;if(pending.length>=2048||performance.now()-lastFlush>35)flush();};
  const streamWriter=stream=>{const decoder=new TextDecoder();return {write:bytes=>{append(stream,decoder.decode(bytes,{stream:true}));return bytes.length;},isatty:false};};
  try{
    const project=validatePythonProject(data.project);
    const {loadPyodide}=await import(/* @vite-ignore */ runtimeLoader);
    const pyodide=await loadPyodide({indexURL:runtimeBase,jsglobals:Object.freeze({})});
    const lines=inputLines(project.input);let line=0;
    pyodide.setStdin({stdin:()=>line<lines.length?lines[line++]:null,isatty:false});
    pyodide.setStdout(streamWriter('stdout'));pyodide.setStderr(streamWriter('stderr'));
    // Core Python can normally reach the worker's JavaScript global through `js`.
    // The workspace turns off ordinary network APIs before user code executes.
    // This is a learning runtime, not a security boundary for hostile code.
    const blocked=()=>{throw new Error('Network access is disabled in the Python workspace.');};
    self.fetch=async()=>blocked();
    for(const name of ['XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','importScripts']){
      try{Object.defineProperty(self,name,{value:blocked,writable:false,configurable:false});}catch{}
    }
    send('running');const started=performance.now();
    const globals=pyodide.toPy({__name__:'__main__'});
    try{
      const result=await pyodide.runPythonAsync(project.code,{globals,filename:project.name});
      result?.destroy?.();
    }finally{globals.destroy();flush();}
    send('done',{elapsed:Math.round(performance.now()-started)});
  }catch(error){flush();send('error',{message:String(error?.message||error)});}
};

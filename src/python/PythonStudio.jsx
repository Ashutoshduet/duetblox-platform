import React,{useEffect,useRef,useState} from 'react';
import {Play,Square,FolderOpen,Download,Code2,RotateCcw} from 'lucide-react';
import {downloadBlob} from '../storage.js';
import {defaultPythonProject,validatePythonProject,pythonFilename,PYTHON_EXAMPLES,MAX_CODE_LENGTH,MAX_INPUT_LENGTH} from './project.js';
import {PythonRunner} from './runner.js';
import './python.css';

export default function PythonStudio({project=defaultPythonProject(),onProjectChange,onStatus,active=true}){
  const [state,setState]=useState({status:'idle',output:[],characters:0,message:'Ready to run Python.',elapsed:null});
  const [notice,setNotice]=useState(''),[example,setExample]=useState('hello'),[undo,setUndo]=useState(null);
  const runner=useRef(null),fileInput=useRef(null),editor=useRef(null),mounted=useRef(false),revision=useRef(0),escapeTab=useRef(false);
  const busy=['loading','running'].includes(state.status);
  useEffect(()=>{mounted.current=true;runner.current=new PythonRunner({onChange:setState});return()=>{mounted.current=false;revision.current++;runner.current?.dispose();runner.current=null;};},[]);
  useEffect(()=>{if(!active){revision.current++;runner.current?.stop('Stopped when you left Python. Your code and input are kept.');}},[active]);
  useEffect(()=>{revision.current++;runner.current?.stop('Stopped because the Python project changed.');},[project.code,project.input,project.name]);
  const edit=patch=>onProjectChange?.({...project,...patch});
  const attempt=fn=>{setNotice('');try{fn();}catch(error){setNotice(error.message);onStatus?.(error.message);}};
  const replace=next=>{runner.current?.stop();setUndo(project);onProjectChange?.(validatePythonProject(next));};
  const loadFile=async file=>{
    const generation=++revision.current;setNotice('');
    try{
      if(file.size>MAX_CODE_LENGTH*4)throw new Error('Use a Python file smaller than 800 KB and 200,000 characters.');
      const code=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const next=validatePythonProject({kind:'duetblox-python',version:1,name:pythonFilename(file.name),code,input:''});
      if(!mounted.current||revision.current!==generation||!active)return;
      replace(next);setNotice(`Opened ${next.name}. Add any input lines before Run.`);
    }catch(error){if(mounted.current&&revision.current===generation)setNotice(`Could not open Python file: ${error.message}`);}
  };
  const keyDown=event=>{
    if(event.key==='Escape'){escapeTab.current=true;return;}
    if(event.key==='Tab'&&escapeTab.current){escapeTab.current=false;return;}
    escapeTab.current=false;
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(!busy)attempt(()=>runner.current.run(project));return;}
    if(event.key!=='Tab'||event.shiftKey)return;
    event.preventDefault();const start=event.currentTarget.selectionStart,end=event.currentTarget.selectionEnd;
    if(project.code.length-(end-start)+4>MAX_CODE_LENGTH)return;
    edit({code:project.code.slice(0,start)+'    '+project.code.slice(end)});
    requestAnimationFrame(()=>editor.current?.setSelectionRange(start+4,start+4));
  };
  return <div className="python-studio">
    <div className="page-heading"><div><div className="eyebrow">PYTHON · CODE IN YOUR BROWSER</div><h1>Turn an idea into a program.</h1><p>Write real Python, try an input, and understand the result. Your code stays in this project.</p></div><span className="pill mint"><Code2 size={15}/> Local Python runtime</span></div>
    <div className="python-toolbar">
      <button className="button primary" disabled={busy||!active||!onProjectChange} onClick={()=>attempt(()=>runner.current.run(project))}><Play size={16}/>{state.status==='loading'?'Loading Python…':'Run Python'}</button>
      <button className="button secondary" disabled={!busy} onClick={()=>runner.current.stop()}><Square size={15}/> Stop Python</button>
      <span className="python-toolbar-spacer"/>
      <button className="button secondary" disabled={busy||!active} onClick={()=>fileInput.current.click()}><FolderOpen size={16}/> Open .py</button>
      <button className="button secondary" onClick={()=>attempt(()=>downloadBlob(new Blob([project.code],{type:'text/x-python;charset=utf-8'}),pythonFilename(project.name)))}><Download size={16}/> Download .py</button>
    </div>
    <input hidden ref={fileInput} type="file" accept=".py,text/x-python,text/plain" onChange={event=>{const file=event.target.files[0];event.target.value='';if(file)loadFile(file);}}/>
    {notice&&<div className="notice" role="status">{notice}<button aria-label="Dismiss Python message" onClick={()=>setNotice('')}>×</button></div>}
    <div className="python-example-bar"><label htmlFor="python-example">Start with an example</label><select id="python-example" value={example} disabled={busy} onChange={e=>setExample(e.target.value)}>{PYTHON_EXAMPLES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="text-button" disabled={busy||!active} onClick={()=>attempt(()=>{const item=PYTHON_EXAMPLES.find(v=>v.id===example);replace({kind:'duetblox-python',version:1,name:`${item.id}.py`,code:item.code,input:item.input});setNotice('Example loaded. Change it, then Run Python. Undo restores your previous code.');})}>Load example</button>{undo&&<button className="text-button" disabled={busy} onClick={()=>{onProjectChange?.(undo);setUndo(null);setNotice('Previous Python code restored.');}}><RotateCcw size={14}/> Undo replacement</button>}</div>
    <div className="python-grid">
      <section className="python-editor-card" aria-label="Python code editor"><div className="python-card-heading"><strong>{pythonFilename(project.name)}</strong><span>{project.code.split('\n').length} lines</span></div><label className="sr-only" htmlFor="python-source">Python code</label><textarea id="python-source" className="python-source" ref={editor} value={project.code} maxLength={MAX_CODE_LENGTH} disabled={busy||!active} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" aria-describedby="python-keyboard-help" onKeyDown={keyDown} onChange={e=>edit({code:e.target.value})}/><p id="python-keyboard-help" className="python-editor-help">Tab inserts 4 spaces. Esc then Tab leaves the editor. Ctrl/⌘ + Enter runs. Indentation matters in Python.</p></section>
      <div className="python-results-column">
        <section className="python-input-card"><div className="python-card-heading"><label htmlFor="python-input"><strong>Input for input()</strong></label><span>One answer per line</span></div><textarea id="python-input" value={project.input} maxLength={MAX_INPUT_LENGTH} rows={4} disabled={busy||!active} placeholder="Write answers before Run" onChange={e=>edit({input:e.target.value})}/><p className="hint">Answers are read from top to bottom. Running out gives EOFError; add the missing answer and run again.</p></section>
        <section className="python-output-card" aria-label="Python output"><div className="python-card-heading"><strong>Output</strong><button className="text-button" disabled={busy||!state.output.length} onClick={()=>runner.current.clear()}>Clear output</button></div><pre className="python-output" tabIndex={0} aria-label="Python console">{state.output.length?state.output.map((item,index)=><span key={index} className={item.stream==='stderr'?'python-stderr':undefined}>{item.text}</span>):<span className="python-output-placeholder">Your program’s print() output appears here.</span>}</pre><div className={`python-run-status python-status-${state.status}`} role="status"><strong>{({idle:'Ready',loading:'Loading',running:'Running',completed:'Finished',stopped:'Stopped',error:'Check your program',timeout:'Time limit',limit:'Output limit'})[state.status]}</strong><span>{state.message}</span>{state.elapsed!==null&&<span>{state.elapsed} ms execution time</span>}</div></section>
      </div>
    </div>
    <details className="python-help"><summary>What works here?</summary><p>Variables, loops, functions, classes, nested lists and the included Python standard library. No account is needed. Prepare DUETBlox’s offline pack once to use this workspace without internet.</p><p>Each Run starts a fresh Python worker. Stop ends that worker immediately. Programs stop after 30 seconds or 64,000 output characters. The browser controls available memory; large programs can exhaust it.</p><p>Installable Python packages, terminal commands, a graphical Python canvas and board uploads are not provided here. The workspace does not automatically download packages, and its usual network APIs are disabled. Run code you understand; this is a learning environment, not a sandbox for hostile programs. Files created by Python are temporary and are discarded when the run ends.</p></details>
  </div>;
}

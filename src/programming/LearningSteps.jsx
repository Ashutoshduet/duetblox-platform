import React, {useEffect, useRef, useState} from 'react';
import {Footprints, Play, Square, ArrowRight, CheckCircle2} from 'lucide-react';
import {sendEditor} from '../bridge.js';
import {blockLabel} from './project-map.js';

const idle = {active:false,status:'idle',stepCount:0,last:null,next:null,threadCount:0,reason:null};
export default function LearningSteps({iframe, ready, active}) {
  const [state,setState]=useState(idle),[busy,setBusy]=useState(false),[error,setError]=useState(''),[issues,setIssues]=useState([]),[values,setValues]=useState([]);
  const generation=useRef(0),operation=useRef(null),current=useRef(state),enabled=useRef(false),stateVersion=useRef(0);
  enabled.current=Boolean(ready&&active);
  const acceptState=value=>{stateVersion.current++;current.current=value;setState(value);};
  useEffect(()=>{
    const epoch=++generation.current,frame=iframe.current;
    const isCurrent=()=>generation.current===epoch&&enabled.current&&iframe.current===frame;
    acceptState(idle);setBusy(false);setValues([]);
    const listener=event=>{
      if(!isCurrent()||event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.channel!=='duetblox')return;
      if(event.data.type==='learningStatus'){
        const value=event.data.payload;
        // Run/Stop can also come from the studio toolbar or native editor.
        // Their newer intent wins over a delayed check, start or step reply.
        if(['stopped','running'].includes(value.status)||(value.status==='completed'&&value.reason)){
          operation.current=null;setBusy(false);setValues([]);
        }
        acceptState(value);setIssues([]);
      }
      if(event.data.type==='changed'){
        stateVersion.current++;
        const pending=operation.current;operation.current=null;
        if(pending?.startSent)sendEditor(frame,'learningStop').catch(()=>{});
        setBusy(false);setIssues([]);setError('');setValues([]);
      }
    };
    window.addEventListener('message',listener);
    const initialVersion=stateVersion.current;
    if(ready&&active)sendEditor(frame,'learningStatus').then(value=>{if(isCurrent()&&stateVersion.current===initialVersion)acceptState(value);}).catch(e=>{if(isCurrent()&&stateVersion.current===initialVersion)setError(e.message);});
    return()=>{
      generation.current++;
      const pending=operation.current;operation.current=null;
      window.removeEventListener('message',listener);
      // Requests already posted to the editor cannot be withdrawn. Its bridge
      // serializes commands, so this stop follows any queued start even when
      // that start has not published its active state yet.
      if(current.current.active||pending?.startSent)sendEditor(frame,'learningStop').catch(()=>{});
      current.current=idle;
    };
  },[iframe,ready,active]);
  const run=async type=>{
    if(!enabled.current||operation.current)return;
    const frame=iframe.current,epoch=generation.current,request={startSent:false};
    operation.current=request;stateVersion.current++;
    const isCurrent=()=>generation.current===epoch&&enabled.current&&iframe.current===frame&&operation.current===request;
    setBusy(true);setError('');
    try{
      let expectedRevision;
      if(type==='learningStart'){
        setValues([]);
        const check=await sendEditor(frame,'learningCheck');
        if(!isCurrent())return;
        setIssues(check.issues||[]);if(!check.ok)return;
        if(!Number.isSafeInteger(check.revision))throw new Error('Reload DUETBlox to update the Learning steps editor.');
        expectedRevision=check.revision;
        await sendEditor(frame,'setEditorTab',{tab:'code'});
        if(!isCurrent())return;
        request.startSent=true;
      }
      const next=await sendEditor(frame,type,type==='learningStart'?{expectedRevision}:{});
      if(!isCurrent())return;
      request.startSent=false;acceptState(next);
      const observed=await sendEditor(frame,'watchValues');
      if(isCurrent())setValues(observed.values.slice(0,12));
    }catch(e){if(isCurrent()){
      // A lost/timed-out reply does not prove that the queued start failed.
      if(request.startSent){request.startSent=false;sendEditor(frame,'learningStop').catch(()=>{});}
      setError(e.message);
    }}
    finally{if(isCurrent()){operation.current=null;setBusy(false);}}
  };
  return <div className="learning-steps">
    <div className="studio-starter"><a href="/examples/learning-steps.sb3" download>Download a learning example</a><span>Save your project first, then use Open. Predict: counter 5 → 7; character moves 10.</span></div>
    <p>Follow a program one execution step at a time. Watch the highlighted script and variable values as you go.</p>
    <div className="learning-state" role="status"><span className={`studio-state-dot ${state.active?'paused':''}`}/><strong>{state.status==='paused'?'Paused for you':state.status==='completed'?'Program completed':state.status==='running'?'Running normally':state.status==='stopped'?'Learning run stopped':'Ready to explore'}</strong><span>{state.stepCount} steps</span></div>
    {error&&<p role="alert" className="coding-error">{error}</p>}
    {state.reason&&<p>{state.reason}</p>}
    <div className="coding-actions">
      {!state.active?<button className="small-button" disabled={!ready||!active||busy} onClick={()=>run('learningStart')}><Footprints size={15}/> Start learning run</button>:<>
        <button className="small-button learning-next" disabled={!ready||!active||busy} onClick={()=>run('learningStep')}><ArrowRight size={16}/> Next step</button>
        <button className="small-button" disabled={!ready||!active||busy} onClick={()=>run('learningResume')}><Play size={15}/> Continue normally</button>
        <button className="small-button" disabled={!ready||!active||busy} onClick={()=>run('learningStop')}><Square size={14}/> Stop learning run</button>
      </>}
    </div>
    {(state.last||state.next)&&<div className="learning-sequence">{state.last&&<div><small>JUST VISITED</small><strong>{blockLabel(state.last)}</strong><span>{state.last.targetName}</span></div>}{state.next&&<div><small>UP NEXT</small><strong>{blockLabel(state.next)}</strong><span>{state.next.targetName}</span></div>}{!state.next&&state.status==='completed'&&<div><CheckCircle2 size={22}/><strong>All selected scripts finished.</strong></div>}</div>}
    {values.length>0&&['paused','completed'].includes(state.status)&&<div className="learning-values"><small>VALUES AT THIS STEP · up to 12 variables/lists</small><dl className="coding-values">{values.map(item=><div key={item.id}><dt>{item.name}<small>{item.targetName}</small></dt><dd>{item.type==='list'?item.value.join(', '):item.value}</dd></div>)}</dl></div>}
    {issues.length>0&&<div className="learning-scope-issues"><strong>This project needs normal Run</strong><ul>{issues.slice(0,6).map((issue,i)=><li key={`${issue.blockId}-${i}`}>{issue.targetName}: {issue.message}</li>)}</ul>{issues.length>6&&<p>And {issues.length-6} more unsupported blocks.</p>}<p>You can keep this project intact and use Run. To learn in steps, open a core-block example or remove the listed blocks.</p></div>}
    <details className="coding-scope"><summary>Which programs can I step through?</summary><p>Green-flag programs using supported motion, looks, variables, lists, conditions, loops and non-warp My Blocks. Each step executes the next command with its reporter inputs. The green-flag hat is skipped; loop tests and My Block calls can take their own step.</p><p>Waits, glides, sound, clones, other event hats, hardware, ML and other extensions need normal Run. The whole project is checked, including unused blocks, before a learning run starts. Editing or closing this view stops the learning run.</p><p>Multiple green-flag scripts take turns. This mode teaches program logic; it does not reproduce the timing of normal execution.</p></details>
  </div>;
}

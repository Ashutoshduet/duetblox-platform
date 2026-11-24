import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Play,Square,Download,FolderOpen,RotateCcw,Activity} from 'lucide-react';
import {downloadBlob} from '../storage.js';
import {defaultSpiceProject,MAX_NETLIST_LENGTH,SPICE_EXAMPLES,validateSpiceProject,traceValues,resultCsv} from './model.js';
import {SpiceRunner} from './runner.js';
import './spice.css';

const format=value=>Number.isFinite(value)?Number(value.toPrecision(5)).toString():'—';
const filename=name=>(name||'circuit').replace(/[^a-z0-9_-]+/gi,'-').slice(0,80)||'circuit';
function unit(signal,mode){return mode==='phase'?'°':mode==='db'?'dB':signal?.type==='voltage'?'V':signal?.type==='current'?'A':'';}

function TraceChart({result,signal,mode,selected,onSelect}) {
  const values=useMemo(()=>traceValues(signal,mode),[signal,mode]);
  const x=result.axis.values,logX=result.analysis==='ac'&&x.every(v=>v>0),tx=value=>logX?Math.log10(value):value;
  const xmin=tx(x[0]),xmax=tx(x.at(-1)),ymin=Math.min(...values),ymax=Math.max(...values);
  const yrange=ymax-ymin||Math.max(1,Math.abs(ymax)*.1),low=ymin-yrange*.08,high=ymax+yrange*.08;
  const px=i=>64+((tx(x[i])-xmin)/(xmax-xmin||1))*620,py=value=>216-(value-low)/(high-low)*190;
  // Display at most 1,200 vertices; the readout, table and CSV keep every measured sample.
  const stride=Math.max(1,Math.ceil(x.length/1200));
  const indices=x.map((_,i)=>i).filter(i=>i%stride===0||i===x.length-1);
  const points=indices.map(i=>`${px(i)},${py(values[i])}`).join(' ');
  const chartClick=event=>{const box=event.currentTarget.getBoundingClientRect(),target=(event.clientX-box.left)/box.width*720;let closest=0;for(let i=1;i<x.length;i++)if(Math.abs(px(i)-target)<Math.abs(px(closest)-target))closest=i;onSelect(closest);};
  return <div className="spice-chart">
    <svg viewBox="0 0 720 260" role="img" aria-label={`${signal.name} measured ${mode} trace, ${x.length} samples`} onClick={chartClick}>
      {[0,.25,.5,.75,1].map(ratio=><g key={ratio}><line x1="64" x2="684" y1={26+ratio*190} y2={26+ratio*190} stroke="#dce4ea"/><text x="57" y={30+ratio*190} textAnchor="end">{format(high-ratio*(high-low))}</text></g>)}
      <line x1="64" y1="216" x2="684" y2="216" stroke="#738699"/>
      <polyline points={points} fill="none" stroke="#176a73" strokeWidth="2"/>
      <line x1={px(selected)} x2={px(selected)} y1="26" y2="216" stroke="#c27d13" strokeDasharray="4 3"/>
      <circle cx={px(selected)} cy={py(values[selected])} r="4" fill="#176a73"/>
      <text x="64" y="238">{format(x[0])}</text><text x="684" y="238" textAnchor="end">{format(x.at(-1))}</text>
      <text x="374" y="256" textAnchor="middle">{result.axis.name}{result.axis.type==='time'?' (s)':result.axis.type==='frequency'?' (Hz, log scale)':''}</text>
      <text x="64" y="16">{signal.name} ({unit(signal,mode)||mode})</text>
    </svg>
    <label className="spice-sample-label" htmlFor="spice-sample">Measured sample {selected+1} of {x.length}</label>
    <input id="spice-sample" type="range" min="0" max={x.length-1} step="1" value={selected} disabled={x.length<2} onChange={event=>onSelect(Number(event.target.value))}/>
    <output className="spice-readout" aria-live="polite">{result.axis.name}: <strong>{format(x[selected])}</strong> · {signal.name}: <strong>{format(values[selected])} {unit(signal,mode)}</strong></output>
  </div>;
}

export default function SpiceStudio({project=defaultSpiceProject(),onProjectChange,onStatus,active=true}) {
  const [state,setState]=useState({status:'idle',message:'Choose an example or describe your circuit.',result:null,log:'',warnings:[],elapsed:null});
  const [notice,setNotice]=useState(''),[example,setExample]=useState('divider'),[undo,setUndo]=useState(null),[signalIndex,setSignalIndex]=useState(0),[mode,setMode]=useState('real'),[sample,setSample]=useState(0),[page,setPage]=useState(0);
  const runner=useRef(null),fileInput=useRef(null),revision=useRef(0),mounted=useRef(false);
  const busy=state.status==='loading'||state.status==='running',result=state.result,editable=active&&!!onProjectChange&&!busy;
  useEffect(()=>{mounted.current=true;runner.current=new SpiceRunner({onChange:setState});return()=>{mounted.current=false;revision.current++;runner.current?.dispose();runner.current=null;};},[]);
  useEffect(()=>{if(!active){revision.current++;runner.current?.stop('Stopped when you left the analog circuit workspace.');}},[active]);
  useEffect(()=>{revision.current++;runner.current?.clear();setSample(0);setPage(0);setSignalIndex(0);},[project.netlist]);
  useEffect(()=>{if(result){setSignalIndex(0);setSample(0);setPage(0);setMode(result.complex?'magnitude':'real');}},[result]);
  const edit=patch=>onProjectChange?.({...project,...patch});
  const report=message=>{setNotice(message);onStatus?.(message);};
  const attempt=fn=>{setNotice('');try{fn();}catch(error){report(error.message);}};
  const replace=next=>{runner.current?.stop();setUndo(project);onProjectChange?.(validateSpiceProject(next));};
  const openFile=async file=>{
    const generation=++revision.current;
    try{
      if(file.size>MAX_NETLIST_LENGTH*4)throw new Error('Use a netlist file smaller than 96 KB.');
      const netlist=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const next=validateSpiceProject({kind:'duetblox-spice',version:1,name:file.name.replace(/\.(cir|spice|txt)$/i,'').slice(0,100),netlist});
      if(!mounted.current||revision.current!==generation||!active)return;
      replace(next);report('Netlist opened. Review the connections, then run the circuit.');
    }catch(error){if(mounted.current&&revision.current===generation)report(`Could not open circuit: ${error.message}`);}
  };
  const signal=result?.signals[Math.min(signalIndex,result.signals.length-1)],values=signal?traceValues(signal,mode):[];
  const selected=Math.min(sample,(result?.points||1)-1),first=page*25,last=Math.min(first+25,result?.points||0);
  return <div className="spice-studio">
    <div className="page-heading"><div><div className="eyebrow">CIRCUIT LAB · ANALOG</div><h1>Measure what your circuit does.</h1><p>Explore real circuit equations with DC, AC and transient analysis. Try an example, change a component, then compare the measured result.</p></div><span className="pill mint"><Activity size={16}/> ngspice in your browser</span></div>
    <div className="spice-toolbar">
      <button className="button primary" disabled={!editable} onClick={()=>attempt(()=>runner.current.run(project.netlist))}><Play size={16}/>{state.status==='loading'?'Loading solver…':'Run circuit'}</button>
      <button className="button secondary" disabled={!busy} onClick={()=>runner.current.stop()}><Square size={16}/> Stop simulation</button>
      <span className="spice-spacer"/>
      <button className="button secondary" disabled={!editable} onClick={()=>fileInput.current.click()}><FolderOpen size={16}/> Open netlist</button>
      <button className="button secondary" onClick={()=>attempt(()=>downloadBlob(new Blob([project.netlist],{type:'text/plain;charset=utf-8'}),filename(project.name)+'.cir'))}><Download size={16}/> Save netlist</button>
    </div>
    <input ref={fileInput} type="file" hidden accept=".cir,.spice,.txt,text/plain" onChange={event=>{const file=event.target.files[0];event.target.value='';if(file)openFile(file);}}/>
    {notice&&<div className="notice" role="status">{notice}<button aria-label="Dismiss circuit message" onClick={()=>setNotice('')}>×</button></div>}
    <div className="spice-examples"><label htmlFor="spice-example">Start with an example</label><select id="spice-example" value={example} disabled={!editable} onChange={event=>setExample(event.target.value)}>{SPICE_EXAMPLES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button secondary" disabled={!editable} onClick={()=>attempt(()=>{const item=SPICE_EXAMPLES.find(item=>item.id===example);replace({kind:'duetblox-spice',version:1,name:item.name,netlist:item.netlist});report(item.description);})}>Load circuit</button>{undo&&<button className="text-button" disabled={!editable} onClick={()=>{onProjectChange?.(undo);setUndo(null);report('Previous netlist restored.');}}><RotateCcw size={15}/> Undo replacement</button>}</div>
    <div className="spice-layout">
      <section className="spice-editor" aria-label="SPICE circuit editor">
        <label htmlFor="spice-name">Circuit name</label><input id="spice-name" value={project.name} maxLength={100} disabled={!editable} onChange={event=>edit({name:event.target.value})}/>
        <label htmlFor="spice-netlist">SPICE netlist</label><textarea id="spice-netlist" value={project.netlist} disabled={!editable} maxLength={MAX_NETLIST_LENGTH} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" aria-describedby="spice-netlist-help" onChange={event=>edit({netlist:event.target.value})} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(editable)attempt(()=>runner.current.run(project.netlist));}}}/>
        <p id="spice-netlist-help" className="hint">First line: a title. Each component lists its connected nodes and value. Ground is <code>0</code>. Use <code>k</code> for kilo, <code>u</code> for micro; <code>m</code> means milli. Ctrl/⌘ + Enter runs.</p>
      </section>
      <section className="spice-results" aria-label="Circuit measurements">
        <div className={`spice-status spice-status-${state.status}`} role="status"><strong>{({idle:'Ready',loading:'Loading',running:'Running',completed:'Solved',stopped:'Stopped',error:state.errorKind==='startup'?'Solver unavailable':'Check the circuit',timeout:'Time limit'})[state.status]}</strong><span>{state.message}</span>{state.elapsed!==null&&<small>{state.elapsed} ms solving time</small>}</div>
        {result&&signal?<>
          <div className="spice-trace-controls"><label htmlFor="spice-signal">Measure</label><select id="spice-signal" value={signalIndex} onChange={event=>{setSignalIndex(Number(event.target.value));setSample(0);}}>{result.signals.map((item,index)=><option key={item.name} value={index}>{item.name}</option>)}</select>{result.complex&&<><label htmlFor="spice-display">Display</label><select id="spice-display" value={mode} onChange={event=>setMode(event.target.value)}><option value="magnitude">Magnitude</option><option value="db">Magnitude (dB, reference 1 unit)</option><option value="phase">Phase (degrees)</option><option value="real">Real part</option></select></>}<button className="text-button" onClick={()=>attempt(()=>downloadBlob(new Blob([resultCsv(result)],{type:'text/csv;charset=utf-8'}),filename(project.name)+'-measurements.csv'))}><Download size={15}/> Export CSV</button></div>
          <TraceChart result={result} signal={signal} mode={mode} selected={selected} onSelect={setSample}/>
          <details className="spice-table"><summary>All measured samples ({result.points.toLocaleString()})</summary><div className="spice-table-scroll"><table><thead><tr><th>Sample</th><th>{result.axis.name}</th><th>{signal.name} ({unit(signal,mode)||mode})</th></tr></thead><tbody>{result.axis.values.slice(first,last).map((x,index)=><tr key={first+index}><td>{first+index+1}</td><td>{format(x)}</td><td>{format(values[first+index])}</td></tr>)}</tbody></table></div><div className="spice-pagination"><button className="text-button" disabled={!page} onClick={()=>setPage(page-1)}>Previous samples</button><span>{first+1}–{last} of {result.points}</span><button className="text-button" disabled={last>=result.points} onClick={()=>setPage(page+1)}>Next samples</button></div></details>
        </>:<div className="spice-empty"><Activity size={32}/><h2>Your measurements appear here</h2><p>Run the voltage divider first. Select <strong>v(out)</strong> to see the expected 2.5 V output.</p></div>}
        {(state.log||state.warnings.length>0)&&<details className="spice-log"><summary>Solver log{state.warnings.length?' and warnings':''}</summary><pre tabIndex={0}>{state.warnings.join('\n')}{state.warnings.length?'\n':''}{state.log}</pre></details>}
      </section>
    </div>
    <details className="spice-help"><summary>Connections, supported parts and limits</summary><p>Nodes with the same name are electrically connected. Examples: <code>R1 supply out 1k</code> connects a resistor between supply and out; <code>C1 out 0 1u</code> connects a capacitor to ground. A voltage source’s positive terminal is first. Source current is positive flowing into that terminal.</p><p>Supported: resistors, capacitors, inductors, independent voltage/current sources, diodes, BJTs and MOSFETs with inline numeric models. Run one operating point, DC sweep, AC sweep or transient analysis at a time. Imported file references, control scripts and arbitrary expressions are disabled. Maximum: 64 parts, 64 nodes and 20 seconds per run.</p><p>This is a standalone analog solver. It does not execute Arduino firmware or co-simulate a microcontroller. Prepare the app’s offline pack before going offline; the bundled solver needs no cloud service. Browser memory and model quality still limit circuit size and accuracy.</p></details>
  </div>;
}

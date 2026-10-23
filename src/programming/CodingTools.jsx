import {appPath} from '../app-paths.js';
import React, {useEffect, useRef, useState} from 'react';
import {CheckCircle2, Code2, Cpu, Eye, RefreshCw, X, Download, AlertCircle, Play, Square, Map, Footprints, Settings2, FlaskConical, Search, Plus} from 'lucide-react';
import BlockLibrary from './BlockLibrary.jsx';
import {boardRegistry, getBoard} from '../hardware/boards.js';
import {exportArduino} from '../hardware/generator.js';
import {sendEditor} from '../bridge.js';
import {downloadBlob} from '../storage.js';
import {uploadAdvice} from './advice.js';
import LearningSteps from './LearningSteps.jsx';
import ProjectMap from './ProjectMap.jsx';
import VirtualBoardLab from '../hardware/VirtualBoardLab.jsx';
import './coding-tools.css';

export default function CodingTools({getHardwareProject,modelRevision,iframe, ready, active, boardId, onBoardChange, boardLocked, onOpenBoards, onStatus,
  virtualBoard, simulationEnabled, destinationBusy, onSimulationChange, onVirtualStop, onVirtualReset, connected, onAddStarter, onRestartEditor}) {
  const [panel, setPanel] = useState(null), [revision, setRevision] = useState(0);
  const [check, setCheck] = useState(null), [checking, setChecking] = useState(false), [error, setError] = useState('');
  const [watch, setWatch] = useState({values: [], total: 0}), [showCode, setShowCode] = useState(false);
  const [toolBusy,setToolBusy]=useState(false),[menuShown,setMenuShown]=useState(false),[running,setRunning]=useState(false),[learningPaused,setLearningPaused]=useState(false);
  const board = getBoard(boardId), latest = useRef(0), callbacks = useRef({onStatus}); callbacks.current = {onStatus};
  const command = (type, payload) => sendEditor(iframe.current, type, payload);
  const toolEpoch=useRef(0);
  useEffect(()=>{if(!ready){toolEpoch.current++;setToolBusy(false);setRunning(false);setLearningPaused(false);setMenuShown(false);}},[ready]);

  useEffect(() => {
    if (!ready || !board?.live) return;
    let cancelled = false;
    sendEditor(iframe.current, 'setBoard', {boardId}).catch(e => { if (!cancelled) callbacks.current.onStatus(e.message); });
    return () => { cancelled = true; };
  }, [ready, boardId, iframe]);
  useEffect(() => {
    const listener = event => {
      if(event.origin !== location.origin || event.source !== iframe.current?.contentWindow || event.data?.channel !== 'duetblox')return;
      if(event.data.type==='status')setRunning(Boolean(event.data.payload?.running));
      if(event.data.type==='learningStatus')setLearningPaused(Boolean(event.data.payload?.active));
      if (event.origin === location.origin && event.source === iframe.current?.contentWindow && event.data?.channel === 'duetblox' && ['changed', 'ready'].includes(event.data.type)) {
        latest.current++; setCheck(null); setWatch({values: [], total: 0}); setRevision(v => v + 1);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [iframe]);
  useEffect(() => {
    const generation = ++latest.current; setCheck(null); setShowCode(false); setError('');
    if (!ready || !active || panel !== 'upload') { setChecking(false); return; }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const project = getHardwareProject ? await getHardwareProject() : (await sendEditor(iframe.current, 'getProject')).project;
        const result = exportArduino(project, {boardId});
        if (generation === latest.current) setCheck({...result, diagnostics: result.diagnostics.map(d => uploadAdvice(d, project))});
      } catch (e) { if (generation === latest.current) setError(e.message); }
      finally { if (generation === latest.current) setChecking(false); }
    }, 650);
    return () => { clearTimeout(timer); if (latest.current === generation) latest.current++; };
  }, [revision, ready, active, panel, boardId, iframe, modelRevision]);
  useEffect(() => {
    if (!active || !ready || panel !== 'watch') return;
    setWatch({values: [], total: 0});
    let cancelled = false, timer;
    const poll = async () => {
      try { const result = await sendEditor(iframe.current, 'watchValues'); if (!cancelled) { setWatch(result); setError(''); } }
      catch (e) { if (!cancelled) { setWatch({values: [], total: 0}); setError(`Values unavailable: ${e.message}`); } }
      if (!cancelled) timer = setTimeout(poll, 600);
    };
    poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, [active, ready, panel, iframe]);
  useEffect(()=>{if(simulationEnabled)setPanel('virtual');else setPanel(value=>value==='virtual'?null:value);},[simulationEnabled]);
  const toggle = name => { setError(''); setPanel(p => p === name ? null : name); };
  const runEditor=async(type,payload)=>{const epoch=++toolEpoch.current,target=iframe.current;const current=()=>epoch===toolEpoch.current&&target===iframe.current;setToolBusy(true);try{await sendEditor(target,type,payload);if(current()&&type==='setEditorMenu')setMenuShown(payload.visible);}catch(e){if(current())onStatus(e.message);}finally{if(current())setToolBusy(false);}};
  const titles={library:'Find your blocks',examples:'Start with a working example',recovery:'Restart the block editor',upload:'Can this run on your board?',watch:'See your variables change',map:'Your project at a glance',learning:'Understand each step',virtual:'Try your board logic here'};
  const regions={library:'Block library',examples:'Block examples',recovery:'Editor recovery',upload:'Board upload check',watch:'Watch values',map:'Project map',learning:'Learning steps',virtual:'Virtual board lab'};
  return <>
    <div className="studio-heading"><div><span className="studio-eyebrow">DUETBLOX STUDIO</span><strong>Create. Try. Understand.</strong></div><span className={`studio-destination ${simulationEnabled?'virtual':''}`}><span className={`studio-state-dot ${learningPaused?'paused':''}`}/>{learningPaused?'Learning run paused':simulationEnabled?'Virtual board · no USB':connected?'Connected live board':running?'Running in browser':'Browser workspace'}</span><div className="studio-run-actions"><button className="studio-run" disabled={!ready||toolBusy||destinationBusy} onClick={()=>runEditor('greenFlag')} title="Restart this project from the green flag"><Play size={16} fill="currentColor"/> Run</button><button disabled={!ready} onClick={()=>runEditor('stopAll')}><Square size={14} fill="currentColor"/> Stop</button><button aria-label="More editor tools" aria-expanded={menuShown} disabled={!ready||toolBusy} onClick={()=>runEditor('setEditorMenu',{visible:!menuShown})}><Settings2 size={17}/></button></div></div>
    <div className="block-startbar"><button disabled={!ready} aria-expanded={panel==='library'} onClick={()=>toggle('library')}><Search size={17}/> Find blocks & extensions</button><button disabled={!ready||toolBusy} aria-expanded={panel==='examples'} onClick={()=>toggle('examples')}><Plus size={17}/> Add an example</button><span>Drag blocks → connect them under an Event → Run</span><button className="editor-recovery-link" onClick={()=>toggle('recovery')}>Editor stuck?</button></div>
    <div className="coding-toolbar">
      <button disabled={!ready} aria-expanded={panel==='map'} onClick={()=>toggle('map')}><Map size={16}/> Project map</button>
      <button disabled={!ready} aria-expanded={panel==='learning'} onClick={()=>toggle('learning')}><Footprints size={16}/> Learning steps</button>
      <button disabled={!ready} aria-expanded={panel === 'watch'} onClick={() => toggle('watch')}><Eye size={16}/> Watch values</button>
      <label><Cpu size={15}/> Board <select aria-label="Coding board" value={boardId} disabled={boardLocked} onChange={e => onBoardChange(e.target.value)}>
        {!board?.live && <option value={boardId}>{board?.name || 'Select a board'} · planned</option>}
        {boardRegistry.filter(b => b.live).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
      <button disabled={!ready} aria-expanded={panel === 'upload'} onClick={() => toggle('upload')}><Code2 size={16}/> Board upload check</button>
      <button disabled={!ready||destinationBusy||(!simulationEnabled&&boardLocked)} aria-expanded={panel==='virtual'} className={simulationEnabled?'virtual-selected':''} onClick={()=>simulationEnabled?toggle('virtual'):onSimulationChange(true)}><FlaskConical size={16}/>{simulationEnabled?'Virtual board on':'Try virtual board'}</button>
    </div>
    {panel && <section className="coding-inspector" aria-label={regions[panel]}>
      <div className="coding-inspector-heading"><h2>{titles[panel]}</h2><button aria-label="Close coding help" onClick={() => setPanel(null)}><X size={18}/></button></div>
      {error && <p role="alert" className="coding-error">{error}</p>}
      {panel==='library'&&<BlockLibrary command={command} onStatus={onStatus} onClose={()=>setPanel(null)}/>}
      {panel==='examples'&&<><p>Adds a separate sprite and keeps your existing work. All green-flag scripts run together; Stop other test scripts if their outputs conflict.</p><div className="example-cards"><button disabled={toolBusy} onClick={()=>onAddStarter('motion')}><strong>Animate a sprite</strong><span>Say hello, repeat and move. No setup needed.</span></button><button disabled={toolBusy||boardLocked} onClick={()=>onAddStarter('blink')}><strong>Blink an LED</strong><span>{board?.name}: alternate HIGH/LOW every half second. Enable Virtual Board Lab to test without USB.</span></button><button disabled={toolBusy||boardLocked||!board?.analogPins?.length} onClick={()=>onAddStarter('sensor')}><strong>Sensor → LED</strong><span>Move the virtual analog slider. Above halfway turns the LED on.</span></button></div></>}
      {panel==='recovery'&&<><p>Try Stop first. If the editor still does not respond, restart it from the last saved snapshot. Recent edits since the last autosave may be lost. Your ML models, Junior story and downloaded projects are kept.</p><div className="coding-actions"><button className="small-button" disabled={!ready} onClick={()=>runEditor('stopAll')}>Stop all scripts</button><button className="small-button" disabled={destinationBusy} onClick={()=>{setPanel(null);onRestartEditor();}}>Restart from saved snapshot</button></div></>}
      {panel==='map'&&<ProjectMap iframe={iframe} ready={ready} active={active} revision={revision}/>}
      {panel==='learning'&&<LearningSteps iframe={iframe} ready={ready} active={active} onStatus={onStatus}/>}
      {panel==='virtual'&&simulationEnabled&&<><div className="studio-starter"><button className="small-button" onClick={()=>onAddStarter('blink')}>Add LED test blocks</button><button className="small-button" disabled={!board?.analogPins?.length} onClick={()=>onAddStarter('sensor')}>Add sensor test blocks</button><span>Add an example, then Run. Change inputs below and watch output commands.</span></div><VirtualBoardLab service={virtualBoard} onStop={onVirtualStop} onReset={onVirtualReset} onDisable={()=>onSimulationChange(false)}/></>}
      {panel === 'upload' ? <>
        <p>Checks the current blocks for <strong>{board?.name}</strong>. This does not compile or upload. Your existing block values are preserved when changing boards.</p>
        <div className="coding-check-heading" role="status">{checking ? <span>Checking current blocks…</span> : check?.ok ? <strong className="coding-success"><CheckCircle2 size={18}/> Supported for code generation</strong> : check ? <strong><AlertCircle size={18}/> {check.diagnostics.length} {check.diagnostics.length === 1 ? 'issue' : 'issues'} to resolve</strong> : <span>Waiting for the editor…</span>}<button aria-label="Check program again" disabled={checking} onClick={() => setRevision(v => v + 1)}><RefreshCw size={15}/></button></div>
        {check?.ok && <><p className="coding-boundary">Next: compile with the local Arduino toolchain, then upload and test on your board. A supported program is not a hardware test result.</p><div className="coding-actions"><button className="small-button" onClick={() => setShowCode(v => !v)}>{showCode ? 'Hide C++' : 'View C++'}</button><button className="small-button" onClick={() => downloadBlob(new Blob([check.code], {type: 'text/plain'}), check.filename)}><Download size={14}/> Download .ino</button><button className="small-button" onClick={onOpenBoards}>Compile & upload</button></div>{showCode && <pre className="coding-preview" tabIndex={0}>{check.code}</pre>}</>}
        {check?.diagnostics.length > 0 && <ol className="coding-issues">{check.diagnostics.map((item, i) => <li key={`${item.blockId || item.code}-${i}`}><strong>{item.message}</strong><p>{item.next}</p>{item.blockId && <><button className="small-button" onClick={() => command('showBlock', {blockId: item.blockId, targetName: item.targetName}).catch(e => setError(e.message))}>Select sprite{item.targetName ? ` · ${item.targetName}` : ''}</button><small className="coding-locate-note">Opens Code and briefly highlights the script. Scroll the workspace if it is outside view.</small></>}</li>)}</ol>}
        <details className="coding-scope"><summary>Live control or upload?</summary><p><strong>Live:</strong> Scratch, Junior and ML run here. Connected-board actions need this browser and USB cable.</p><p><strong>Upload:</strong> One start script, numeric variables, conditions, loops and supported hardware actions become C++. Numeric/boolean My Blocks are supported. Small numbers models can run on the board. Lists, parallel scripts, stage graphics and image/sound/pose models remain browser-only.</p><p>“When board starts” is an upload entry. Use the green flag for live browser programs.</p></details>
      </> : panel==='watch' ? <>
        <div className="studio-starter"><a href={appPath('/examples/nested-data-lists.sb3')} download><Download size={14}/> Nested data list example</a><span>Data lists keep JSON values inside ordinary variables. Save first, Open this example, then Run: the second row’s first item is 23.</span></div><p>Live values from original sprites and the stage. Lists show their first ten items. This view observes the program; it does not pause execution.</p>
        {!watch.values.length ? <p className="coding-empty">Create a variable in Scratch’s Variables category, then run your program.</p> : <dl className="coding-values">{watch.values.map(item => <div key={item.id}><dt>{item.name}<small>{item.targetName}{item.type === 'list' ? ` · ${item.length} items` : ''}</small></dt><dd>{item.type === 'list' ? item.value.map((value, i) => <span key={i}>{i + 1}. {value}<br/></span>) : item.value}</dd></div>)}</dl>}
        {watch.total > 200 && <p>Showing 200 of {watch.total} values.</p>}
      </> : null}
    </section>}
  </>;
}

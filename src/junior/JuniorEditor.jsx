import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock3, Download, Flag, Image, MessageCircle,
  Play, Plus, Repeat2, RotateCcw, RotateCw, Square, Trash2, Upload, Volume2, X, ArrowUp, ArrowDown, Home, Eye, EyeOff, Maximize, Minimize, Gauge, Send, Hand, Infinity, Paintbrush, Pen, Mic, BrainCircuit, Cpu, Layers, Undo2, Redo2, Copy, GitBranch, Search, Keyboard, CornerUpLeft} from 'lucide-react';
import {artDataURL, BACKDROP_ART, SPRITE_ART} from './assets.js';
import {BLOCK_TYPES, compileJuniorProject, makeJuniorBlock, makeJuniorProject, makeJuniorScene,
  makeJuniorSprite, makeJuniorScript, MESSAGE_COLORS, TRIGGERS, parseJuniorProject, removeJuniorBlock, serializeJuniorProject, updateBlockList,
  CONDITION_TYPES,JUNIOR_MODEL_TYPES,JUNIOR_KEYS,makeJuniorCondition,resolveJuniorBranch,JUNIOR_BLOCK_HELP,findJuniorBlocks,countJuniorBlocks,copyJuniorBlock,copyJuniorScript,juniorSequenceWarning} from './model.js';
import {importImage,mediaURL} from './media.js';
import PaintEditor from './PaintEditor.jsx';
import {createJuniorStageQueue} from './stage-queue.js';
import AudioLibrary from './AudioLibrary.jsx';
import './junior.css';

export {compileJuniorProject, makeJuniorProject, parseJuniorProject, serializeJuniorProject} from './model.js';
const BLOCK_ICONS = {bounce:CornerUpLeft,direction:ArrowUp,setX:ArrowRight,setY:ArrowUp,rotationStyle:RotateCw,waitUntil:Clock3,repeatUntil:Repeat2,messageWait:Send,startSound:Volume2,stopSounds:Square,volume:Volume2,move:ArrowRight,turn:RotateCw,right:ArrowRight,left:ArrowLeft,up:ArrowUp,down:ArrowDown,turnLeft:RotateCcw,hop:ArrowUp,home:Home,random:Maximize,say:MessageCircle,grow:Maximize,shrink:Minimize,resetSize:RotateCcw,show:Eye,hide:EyeOff,nextCostume:Layers,costume:Image,wait:Clock3,repeat:Repeat2,forever:Infinity,if:GitBranch,ifElse:GitBranch,stop:Square,end:Square,speed:Gauge,scene:Image,message:Send,sound:Volume2,penDown:Pen,penUp:Pen,clear:Trash2,penColor:Paintbrush,penSize:Pen,stamp:Image,predict:BrainCircuit,sayPrediction:MessageCircle};
const CATEGORIES = [{id:'events',name:'Events',icon:Flag},{id:'motion',name:'Motion',icon:ArrowRight},{id:'looks',name:'Looks',icon:MessageCircle},{id:'control',name:'Control',icon:Repeat2},{id:'sound',name:'Sound',icon:Volume2},{id:'pen',name:'Pen',icon:Pen},{id:'ai',name:'AI',icon:BrainCircuit},{id:'devices',name:'Devices',icon:Cpu}];
function choicesFor(block,project,sprite){
 const pairs = block.type==='rotationStyle'?[['left-right','Flip left / right'],['all around','Turn all around'],["don't rotate",'Stay upright']]:['message','messageWait'].includes(block.type)?MESSAGE_COLORS.map(c=>[c,c]):block.type==='speed'?[['slow','Slow'],['normal','Normal'],['fast','Fast']]:block.type==='stop'?[['all','All scripts'],['this script','This script'],['other scripts in sprite','Other scripts here']]:block.type==='scene'?project.scenes.map(s=>[s.id,s.name]):['sound','startSound'].includes(block.type)?[['chime','Chime'],...(project.assets||[]).filter(a=>a.dataFormat==='wav').map(a=>[a.id,a.name])]:block.type==='costume'?[['first','Original'],...(sprite.costumeAssetIds||[]).map(id=>[id,project.assets?.find(a=>a.id===id)?.name||'Costume'])]:['predict','sayPrediction'].includes(block.type)?[['image','Image'],['sound','Sound'],['pose','Pose']]:null;
 return pairs;
}

function DecisionControls({condition,onChange,waiting=false}){
  return <div className="junior-decision-condition">
    <label>Check<select aria-label="Decision condition" value={condition.kind} onChange={event=>onChange(makeJuniorCondition(event.target.value))}>{Object.entries(CONDITION_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {condition.kind.startsWith('ml')&&<label>Model<select aria-label="Decision model" value={condition.model} onChange={event=>onChange({...condition,model:event.target.value})}>{Object.entries(JUNIOR_MODEL_TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
    {condition.kind==='mlLabel'&&<label>Class label<input aria-label="Decision class label" maxLength={80} value={condition.label} onChange={event=>onChange({...condition,label:event.target.value})}/></label>}
    {condition.kind==='keyPressed'&&<label>Key<select aria-label="Decision key" value={condition.key} onChange={event=>onChange({...condition,key:event.target.value})}>{JUNIOR_KEYS.map(key=><option key={key} value={key}>{key==='space'?'Space':key==='any'?'Any key':key}</option>)}</select></label>}
    {condition.kind.startsWith('ml')&&<p>{waiting?'This checks the latest result. Use Recognize in a running script to update it; this condition does not sample the camera or microphone.':'Put Recognize before this block. A rejected prediction does not run Then.'}</p>}
    {condition.kind==='keyPressed'&&<p>{waiting?'Click the stage before pressing a key. This block keeps checking until the key is pressed.':'Click the stage before pressing a key. Put this check in a loop to keep listening.'}</p>}
  </div>;
}
function BranchPreview({blocks,label,onEdit}){
  return <button className="junior-branch-preview" aria-label={`Edit ${label.toLowerCase()} branch`} onClick={onEdit}>
    <span><strong>{label}</strong><small>{blocks.length} {blocks.length===1?'step':'steps'}</small><ChevronRight size={14}/></span>
    <span className="junior-branch-steps">{blocks.length?blocks.slice(0,3).map((block,index)=><span key={block.id}>{index>0?' → ':''}{BLOCK_TYPES[block.type].label}</span>):'Add steps here'}{blocks.length>3?' …':''}</span>
  </button>;
}
function BlockCard({block, index, total, project, sprite, onChange, onDelete, onMove, onEditBranch, onDropBlock,onCopy,canCopy}) {
  const definition = BLOCK_TYPES[block.type];
  const Icon = BLOCK_ICONS[block.type] || Cpu;
  const choices = choicesFor(block,project,sprite);
  return <div className={`junior-block junior-block-${definition.category}${definition.decision||definition.predicate?' junior-decision-block':''}`} draggable
    onDragStart={event => {if(event.target.closest('input,select,button')){event.preventDefault();return;}event.dataTransfer.setData('text/duetblox-block', block.id);}}
    onDragOver={event => {if (event.dataTransfer.types.includes('text/duetblox-block')) event.preventDefault();}}
    onDrop={event => {event.preventDefault(); onDropBlock(event.dataTransfer.getData('text/duetblox-block'), block.id);}}
    aria-label={`${index + 1}. ${definition.label} block`}>
    <div className="junior-block-tools">
      <button title="Move block earlier" aria-label={`Move ${definition.label} earlier`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronLeft size={13}/></button>
      <span>{index + 1}</span>
      <button title="Move block later" aria-label={`Move ${definition.label} later`} disabled={index === total - 1} onClick={() => onMove(1)}><ChevronRight size={13}/></button>
      <button title="Duplicate block" aria-label={`Duplicate ${definition.label} block`} disabled={!canCopy} onClick={onCopy}><Copy size={13}/></button>
      <button className="junior-block-delete" title="Remove block" aria-label={`Remove ${definition.label} block`} onClick={onDelete}><X size={13}/></button>
    </div>
    <Icon className="junior-block-icon" size={31} strokeWidth={2.5}/>
    <strong title={JUNIOR_BLOCK_HELP[block.type]}>{definition.label}</strong>
    {(definition.decision||definition.predicate)&&<DecisionControls condition={block.condition} waiting={definition.predicate} onChange={condition=>onChange({condition})}/>}
    {block.type === 'say' && <input className="junior-say-input" aria-label="Words to say" maxLength={160} value={block.text} onChange={event => onChange({text: event.target.value})} draggable={false}/>}
    {choices && <select aria-label={`${definition.label} choice`} value={block.choice || choices[0]?.[0]} onChange={e=>onChange({choice:e.target.value})}>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}
    {block.type==='penColor'&&<input aria-label="Pen color" type="color" value={block.choice} onChange={e=>onChange({choice:e.target.value})}/>}
    {definition.category==='devices'&&<label className="junior-pin-input">Pin<input aria-label={`${definition.label} pin`} value={block.choice} maxLength={4} onChange={e=>onChange({choice:e.target.value})}/></label>}
    {definition.value !== undefined && <label className="junior-block-value">
      <input type="number" aria-label={`${definition.label} ${definition.unit}`} min={definition.min} max={definition.max}
        step={['say', 'wait'].includes(block.type) ? 0.1 : 1} value={block.value}
        onChange={event => onChange({value: event.target.value === '' ? '' : Number(event.target.value)})}
        onBlur={event => {const number = Number(event.target.value); let value = Math.min(definition.max, Math.max(definition.min, Number.isFinite(number) ? number : definition.value));
          if (block.type === 'repeat') value = Math.round(value); if (value !== block.value) onChange({value});}}/>
      <span>{definition.unit}</span>
    </label>}
    {definition.decision?<div className="junior-decision-branches"><BranchPreview label="Then" blocks={block.children||[]} onEdit={()=>onEditBranch('children')}/>{definition.otherwise?<BranchPreview label="Otherwise" blocks={block.elseChildren||[]} onEdit={()=>onEditBranch('elseChildren')}/>:<p>If false, go to the next block.</p>}</div>:definition.container&&<button className="junior-repeat-open" onClick={()=>onEditBranch('children')}>{countJuniorBlocks(block.children)} {countJuniorBlocks(block.children)===1?'step':'steps'} inside <ChevronRight size={13}/></button>}
  </div>;
}

export default function JuniorEditor({project, onProjectChange, onStatus}) {
  const [internal, setInternal] = useState(makeJuniorProject);
  const current = project || internal;
  const scene = current.scenes.find(item => item.id === current.selectedSceneId) || current.scenes[0];
  const sprite = scene.sprites.find(item => item.id === current.selectedSpriteId) || scene.sprites[0];
  const script = sprite.scripts.find(item => item.id === current.selectedScriptId) || sprite.scripts[0];
  const [category, setCategory] = useState('motion');
  const [blockSearch,setBlockSearch]=useState('');
  const paletteInput=useRef(null);
  const [editingPath, setEditingPath] = useState([]);
  const [addingSprite, setAddingSprite] = useState(false);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stageRevision,setStageRevision]=useState(0);
  const [previewDirty,setPreviewDirty]=useState(false);
  const [notice, setNotice] = useState('Starting the Scratch engine…');
  const [error, setError] = useState('');
  const [painting,setPainting]=useState(null),[audioOpen,setAudioOpen]=useState(false),[mediaBusy,setMediaBusy]=useState(false),[historyVersion,setHistoryVersion]=useState(0);
  const imageInput=useRef(null),imageTarget=useRef('costume'),undoStack=useRef([]),redoStack=useRef([]),currentRef=useRef(current);
  currentRef.current=current;
  const frame = useRef(null);
  const input = useRef(null);
  const pending = useRef(new Map());
  const serial = useRef(0);
  const previewTimer = useRef(null);
  const stageQueue=useRef(null),actionEpoch=useRef(0),mounted=useRef(true),loadedPreview=useRef(null),stageWindow=useRef(null);
  const actionInProgress = useRef(false);
  const runningRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const allBlocks = script.blocks;
  const branchView = resolveJuniorBranch(allBlocks,editingPath);
  const parentBranch = branchView.breadcrumbs.at(-1);
  const visibleBlocks = branchView.blocks;
  const totalBlocks=current.scenes.reduce((count,item)=>count+item.sprites.reduce((sum,character)=>sum+character.scripts.reduce((n,story)=>n+countJuniorBlocks(story.blocks),0),0),0);
  const sequenceWarning=juniorSequenceWarning(visibleBlocks);
  const searching=!!blockSearch.trim(),paletteBlocks=findJuniorBlocks(blockSearch,searching?'all':category);
  const paletteTriggers=Object.entries(TRIGGERS).filter(([,label])=>!searching||blockSearch.trim().toLowerCase().split(/\s+/).every(term=>`${label} start event ${label===TRIGGERS.key?'keyboard':''}`.toLowerCase().includes(term)));
  function chooseCategory(next){setCategory(next);setBlockSearch('');}
  function addBlock(type){const block=makeJuniorBlock(type);if(type==='scene')block.choice=current.scenes[(current.scenes.indexOf(scene)+1)%current.scenes.length].id;changeVisibleBlocks([...visibleBlocks,block]);announce(`Added ${BLOCK_TYPES[type].label}${parentBranch?' inside this branch':''}.`);}
  function copyScript(){const copied=copyJuniorScript(script);setEditingPath([]);change({...current,selectedScriptId:copied.id,scenes:current.scenes.map(item=>item.id===scene.id?{...item,sprites:item.sprites.map(character=>character.id===sprite.id?{...character,scripts:[...character.scripts,copied]}:character)}:item)});announce('Copied this script. You are editing the new copy.');}

  function announce(message, failure = false) {
    setNotice(message); setError(failure ? message : ''); onStatusRef.current?.(message);
  }
  function change(next) {
    undoStack.current.push(current);if(undoStack.current.length>30)undoStack.current.shift();redoStack.current=[];setHistoryVersion(n=>n+1);
    setInternal(next);
    onProjectChange?.(next);
  }
  function historyMove(back){const from=back?undoStack:redoStack,to=back?redoStack:undoStack;if(!from.current.length)return;to.current.push(current);const next=from.current.pop();setInternal(next);onProjectChange?.(next);setEditingPath([]);setHistoryVersion(historyVersion+1);}
  function changeScene(patch) {
    change({...current, scenes: current.scenes.map(item => item.id === scene.id ? {...item, ...patch} : item)});
  }
  function changeSprite(patch) {
    changeScene({sprites: scene.sprites.map(item => item.id === sprite.id ? {...item, ...patch} : item)});
  }
  function changeBlocks(next) {
    changeSprite({scripts:sprite.scripts.map(item=>item.id===script.id?{...item,blocks:next}:item)});
  }
  function changeVisibleBlocks(next) {
    changeBlocks(parentBranch ? updateBlockList(allBlocks, parentBranch.id, {[parentBranch.branch]: next}) : next);
  }
  function selectScene(nextScene) {
    setEditingPath([]);
    change({...current, selectedSceneId: nextScene.id, selectedSpriteId: nextScene.sprites[0].id,selectedScriptId:nextScene.sprites[0].scripts[0].id});
  }
  function addSprite(kind) {
    const newSprite = makeJuniorSprite(kind, scene.sprites.length);
    newSprite.name = `${newSprite.name}${scene.sprites.some(item => item.name === newSprite.name) ? ` ${scene.sprites.length + 1}` : ''}`;
    setAddingSprite(false); setEditingPath([]);
    change({...current, selectedSpriteId: newSprite.id,selectedScriptId:newSprite.scripts[0].id, scenes: current.scenes.map(item => item.id === scene.id ? {...item, sprites: [...item.sprites, newSprite]} : item)});
  }
  const assetURL=id=>{const asset=current.assets?.find(a=>a.id===id);return asset?mediaURL(asset):null;};
  const spriteURL=item=>assetURL(item.costumeAssetIds?.[(item.initialCostume||0)-1])||artDataURL(SPRITE_ART[item.kind]);
  const sceneURL=item=>assetURL(item.backdropAssetId)||artDataURL(BACKDROP_ART[item.background]);
  function addMedia(asset,target='sound'){
    const latest=currentRef.current;const assets=[...(latest.assets||[]).filter(a=>a.id!==asset.id),asset];
    if(assets.length>100){announce('Use at most 100 custom media assets.',true);return;}
    if(target==='sound'){change({...latest,assets});announce(`Added ${asset.name}. Choose it in a Play sound block.`);return;}
    let selectedSpriteId=latest.selectedSpriteId,selectedScriptId=latest.selectedScriptId;
    const scenes=latest.scenes.map(item=>{if(item.id!==scene.id)return item;if(target==='backdrop')return {...item,backdropAssetId:asset.id};if(target==='character'){const created=makeJuniorSprite();created.name=asset.name;created.costumeAssetIds=[asset.id];created.initialCostume=1;selectedSpriteId=created.id;selectedScriptId=created.scripts[0].id;return {...item,sprites:[...item.sprites,created]};}return {...item,sprites:item.sprites.map(p=>{if(p.id!==sprite.id)return p;const ids=[...(p.costumeAssetIds||[]).filter(id=>id!==asset.id),asset.id];return {...p,costumeAssetIds:ids,initialCostume:ids.length};})};});
    change({...latest,assets,scenes,selectedSpriteId,selectedScriptId});setPainting(null);setAddingSprite(false);announce(`Added ${asset.name}.`);
  }
  function chooseImage(target){imageTarget.current=target;imageInput.current?.click();}
  async function imageChosen(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;setMediaBusy(true);try{addMedia(await importImage(file,imageTarget.current==='backdrop'),imageTarget.current);}catch(e){announce(e.message,true);}finally{setMediaBusy(false);}}
  function addScript(trigger='flag'){const next=makeJuniorScript(trigger);setEditingPath([]);change({...current,selectedScriptId:next.id,scenes:current.scenes.map(s=>s.id===scene.id?{...s,sprites:s.sprites.map(p=>p.id===sprite.id?{...p,scripts:[...p.scripts,next]}:p)}:s)});}

  const command = useCallback((type, payload = {}) => new Promise((resolve, reject) => {
    if (!frame.current?.contentWindow) {reject(new Error('The Scratch stage is not ready.')); return;}
    const requestId = `junior-${++serial.current}`;
    const timeout = setTimeout(() => {
      pending.current.delete(requestId);
      reject(new Error('The Scratch stage took too long to respond. Try resetting it.'));
    }, type==='stopAll'?5000:25000);
    pending.current.set(requestId, {resolve, reject, timeout});
    frame.current.contentWindow.postMessage({channel: 'duetblox', requestId, type, payload}, window.location.origin);
  }), []);

  const loadScene = useCallback(async nextProject => {
    if(!stageQueue.current)stageQueue.current=createJuniorStageQueue(async next=>{
      const payload={...compileJuniorProject(next),encoding:'json'};
      await command('loadProject',payload);
    });
    const applied=await stageQueue.current.load(nextProject);
    if(applied&&mounted.current){loadedPreview.current={scenes:nextProject.scenes,assets:nextProject.assets,sceneId:nextProject.selectedSceneId};setPreviewDirty(currentRef.current.scenes!==nextProject.scenes||currentRef.current.assets!==nextProject.assets||currentRef.current.selectedSceneId!==nextProject.selectedSceneId);}
    return applied;
  }, [command]);

  function restartStage(message='Stage restarted. Your story and edits are safe. Press Play when it is ready.') {
    actionEpoch.current++;stageQueue.current?.reset();clearTimeout(previewTimer.current);loadedPreview.current=null;
    for(const task of pending.current.values()){clearTimeout(task.timeout);task.reject(new Error('The stage was restarted.'));}pending.current.clear();
    actionInProgress.current=false;runningRef.current=false;setRunning(false);setBusy(false);setReady(false);setPreviewDirty(false);setStageRevision(value=>value+1);announce(message);
  }

  useEffect(() => {
    mounted.current=true;
    function handleMessage(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== 'duetblox') return;
      const {type, requestId, payload} = event.data;
      if (type === 'ready') {stageWindow.current=event.source;setReady(true);setError('');setNotice('Ready to make something wonderful.');return;}
      if (type === 'status') {
        const nextRunning = typeof payload?.running === 'boolean' ? payload.running : payload?.isRunning;
        if (typeof nextRunning === 'boolean') {
          if (nextRunning) setNotice('Story is running. Tap Stop to end it.');
          if (runningRef.current && !nextRunning) setNotice('Story finished. Play again or try another block.');
          runningRef.current = nextRunning;
          setRunning(nextRunning);
        }
        return;
      }
      if(type==='error'&&!requestId){setBusy(false);announce(payload?.message||'The stage could not start. Try Restart stage.',true);return;}
      const task = pending.current.get(requestId);
      if (!task) return;
      clearTimeout(task.timeout); pending.current.delete(requestId);
      if (type === 'error') task.reject(new Error(payload?.message || event.data.error?.message || event.data.error || 'The Scratch stage could not run this project.'));
      else if (type === 'result') task.resolve(payload);
    }
    window.addEventListener('message', handleMessage);
    return () => {mounted.current=false;actionEpoch.current++;stageQueue.current?.cancel();stageWindow.current?.postMessage({channel:'duetblox',type:'stopAll',requestId:`junior-close-${++serial.current}`},window.location.origin);window.removeEventListener('message', handleMessage); clearTimeout(previewTimer.current);
      for (const task of pending.current.values()) {clearTimeout(task.timeout); task.reject(new Error('The Junior stage was closed.'));}
      pending.current.clear();};
  }, []);

  useEffect(()=>{if(ready)return;const timer=setTimeout(()=>setError('The stage is taking longer to start. Use Restart stage to try again; your story is kept.'),20000);return()=>clearTimeout(timer);},[ready,stageRevision]);

  // Edits during playback are saved without tearing down a running VM.
  // Idle previews coalesce; they never build an unbounded queue of full projects.
  useEffect(() => {
    if(!ready)return;
    const loaded=loadedPreview.current;
    if(loaded?.scenes===current.scenes&&loaded?.assets===current.assets&&loaded?.sceneId===current.selectedSceneId)return;
    if(running||actionInProgress.current){setPreviewDirty(true);return;}
    const epoch=actionEpoch.current;
    previewTimer.current = setTimeout(async () => {
      try {if(await loadScene(current)&&mounted.current&&epoch===actionEpoch.current)setError('');}
      catch (failure) {if(mounted.current&&epoch===actionEpoch.current)setError(failure.message);}
    }, 180);
    return () => clearTimeout(previewTimer.current);
  }, [current.scenes,current.selectedSceneId,current.assets,ready,running,busy,loadScene]);

  useEffect(() => {
    if(editingPath.length!==branchView.path.length)setEditingPath(branchView.path);
  }, [allBlocks,editingPath]);

  async function run() {
    const epoch=++actionEpoch.current;
    actionInProgress.current = true; clearTimeout(previewTimer.current); setBusy(true);
    try {
      if(!await loadScene(current)||epoch!==actionEpoch.current||!mounted.current)return;
      runningRef.current=true;setRunning(true);announce(`Running ${scene.name}. All characters start together.`);
      await command('greenFlag');
    } catch(failure) {
      if(epoch===actionEpoch.current&&mounted.current){runningRef.current=false;setRunning(false);announce(failure.message,true);}
    } finally {
      if(epoch===actionEpoch.current&&mounted.current){actionInProgress.current=false;setBusy(false);}
    }
  }
  async function stop(reset = false) {
    const epoch=++actionEpoch.current;
    stageQueue.current?.cancel();actionInProgress.current=true;clearTimeout(previewTimer.current);setBusy(true);
    // Stop is sent immediately, without waiting for preview or Play promises.
    try {
      await command('stopAll');
      if(epoch!==actionEpoch.current||!mounted.current)return;
      runningRef.current=false;setRunning(false);
      if(reset&&!await loadScene(current))return;
      if(epoch===actionEpoch.current)announce(reset?'Back to the starting positions.':'Program stopped.');
    } catch(failure) {
      if(epoch===actionEpoch.current&&mounted.current)restartStage('The stage did not stop in time, so it was restarted. Your story and edits are safe.');
    } finally {
      if(epoch===actionEpoch.current&&mounted.current){actionInProgress.current=false;setBusy(false);}
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([serializeJuniorProject(current)], {type: 'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${current.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'My story'}.junior.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Junior project saved to your device.');
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {if (file.size > 35_000_000) throw new Error('Choose a Junior project smaller than 35 MB.');
      const next = parseJuniorProject(await file.text()); setEditingPath([]); change(next); announce(`Opened ${next.title}.`);}
    catch (failure) {announce(failure.message, true);}
  }
  function moveBlock(index, offset) {
    const next = [...visibleBlocks]; const [block] = next.splice(index, 1); next.splice(index + offset, 0, block); changeVisibleBlocks(next);
  }
  function dropBlock(source, target) {
    const from = visibleBlocks.findIndex(block => block.id === source), to = visibleBlocks.findIndex(block => block.id === target);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...visibleBlocks]; const [block] = next.splice(from, 1); next.splice(to, 0, block); changeVisibleBlocks(next);
  }

  return <section className="junior-editor" aria-label="Junior coding editor">
    <div className="junior-topbar">
      <div className="junior-project-heading"><span className="junior-mode-badge">JUNIOR STUDIO</span>
        <input aria-label="Junior project title" value={current.title} maxLength={80} onChange={event => change({...current, title: event.target.value})}/></div>
      <div className="junior-file-actions"><button onClick={() => input.current?.click()}><Upload size={16}/>Open story</button><button onClick={download}><Download size={16}/>Save story</button></div>
      <input ref={input} type="file" accept=".json,.junior.json" hidden onChange={importFile}/>
      <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={imageChosen}/>
    </div>

    <div className="junior-layout">
      <div className="junior-code-panel">
        <div className="junior-scene-strip" aria-label="Scenes">
          <span className="junior-strip-label">Scenes</span>
          {current.scenes.map((item, index) => <button key={item.id} className={`junior-scene-tab ${item.id === scene.id ? 'junior-active' : ''}`} onClick={() => selectScene(item)} aria-pressed={item.id === scene.id}>
            <img src={sceneURL(item)} alt=""/><span>{index + 1}. {item.name}</span></button>)}
          <button className="junior-add-scene" aria-label="Add scene" title="Add scene" disabled={current.scenes.length >= 12} onClick={() => {
            const next = makeJuniorScene(current.scenes.length); setEditingPath([]);
            change({...current, scenes: [...current.scenes, next], selectedSceneId: next.id, selectedSpriteId: next.sprites[0].id,selectedScriptId:next.sprites[0].scripts[0].id});
          }}><Plus size={17}/></button>
        </div>

        <div className="junior-coding-area">
          <aside className="junior-characters" aria-label="Characters">
            <span className="junior-strip-label">Cast</span>
            {scene.sprites.map(item => <button key={item.id} className={`junior-character ${item.id === sprite.id ? 'junior-selected' : ''}`} aria-pressed={item.id === sprite.id}
              onClick={() => {setEditingPath([]); change({...current, selectedSpriteId: item.id,selectedScriptId:item.scripts[0].id});}}>
              <img src={spriteURL(item)} alt=""/><span>{item.name}</span></button>)}
            <button className="junior-add-character" disabled={scene.sprites.length >= 12} onClick={() => setAddingSprite(!addingSprite)} aria-expanded={addingSprite}><Plus size={20}/><span>Add</span></button>
          </aside>
          <div className="junior-workspace">
            <div className="junior-script-heading"><div><span className="junior-eyebrow">LET'S MAKE IT MOVE</span><h2>{sprite.name}’s story</h2></div><div className="junior-history"><button aria-label="Undo edit" disabled={!undoStack.current.length} onClick={()=>historyMove(true)}><Undo2 size={16}/></button><button aria-label="Redo edit" disabled={!redoStack.current.length} onClick={()=>historyMove(false)}><Redo2 size={16}/></button><span className="junior-block-count">{countJuniorBlocks(allBlocks)} blocks</span></div></div>
            {addingSprite && <div className="junior-character-picker" aria-label="Choose a character">
              <span>Pick a new friend</span>{Object.entries(SPRITE_ART).map(([kind, svg]) => <button key={kind} onClick={() => addSprite(kind)}><img src={artDataURL(svg)} alt=""/>{kind}</button>)}
              <button disabled={mediaBusy} onClick={()=>chooseImage('character')}><Upload size={22}/>Upload character</button>
              <button className="junior-icon-button" aria-label="Close character picker" onClick={() => setAddingSprite(false)}><X size={17}/></button>
            </div>}
            <div className="junior-scripts" aria-label="Character scripts">{sprite.scripts.map((item,index)=><button key={item.id} aria-pressed={script.id===item.id} onClick={()=>{setEditingPath([]);change({...current,selectedScriptId:item.id});}}>{index+1}. {`${TRIGGERS[item.trigger].replace('When ','')}${item.trigger==='key'?` · ${item.key||'space'}`:''}`}</button>)}<button disabled={sprite.scripts.length>=20} onClick={()=>addScript()}><Plus size={14}/>Add script</button></div>
            <div className="junior-trigger-settings"><label>Start <select aria-label="Script start event" value={script.trigger} onChange={e=>changeSprite({scripts:sprite.scripts.map(s=>s.id===script.id?{...s,trigger:e.target.value}:s)})}>{Object.entries(TRIGGERS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{script.trigger==='message'&&<select aria-label="Start message color" value={script.message||'orange'} onChange={e=>changeSprite({scripts:sprite.scripts.map(s=>s.id===script.id?{...s,message:e.target.value}:s)})}>{MESSAGE_COLORS.map(c=><option key={c}>{c}</option>)}</select>}{script.trigger==='key'&&<label>Key<select aria-label="Start key" value={script.key||'space'} onChange={e=>changeSprite({scripts:sprite.scripts.map(s=>s.id===script.id?{...s,key:e.target.value}:s)})}>{JUNIOR_KEYS.map(key=><option key={key} value={key}>{key}</option>)}</select></label>}<button aria-label="Copy script" disabled={sprite.scripts.length>=20||totalBlocks+countJuniorBlocks(allBlocks)>1000} onClick={copyScript}><Copy size={14}/></button><button aria-label="Remove selected script" disabled={sprite.scripts.length<=1} onClick={()=>{setEditingPath([]);const scripts=sprite.scripts.filter(s=>s.id!==script.id);change({...current,selectedScriptId:scripts[0].id,scenes:current.scenes.map(item=>item.id===scene.id?{...item,sprites:item.sprites.map(character=>character.id===sprite.id?{...character,scripts}:character)}:item)});}}><Trash2 size={14}/></button></div>
            <p className="junior-workspace-hint">Each script follows its own start event. Blocks run from left to right. One square is 20 pixels.</p>
            {parentBranch && <nav className="junior-branch-navigation" aria-label="Nested block path">
              <button onClick={()=>setEditingPath([])}>Script</button>{branchView.breadcrumbs.map((entry,index)=><React.Fragment key={`${entry.id}-${entry.branch}`}><ChevronRight size={13}/><button aria-current={index===branchView.breadcrumbs.length-1?'location':undefined} onClick={()=>setEditingPath(branchView.path.slice(0,index+1))}>{BLOCK_TYPES[entry.block.type].label}{BLOCK_TYPES[entry.block.type].decision?` · ${entry.branch==='elseChildren'?'Otherwise':'Then'}`:''}</button></React.Fragment>)}
              <button className="junior-branch-back" onClick={()=>setEditingPath(branchView.path.slice(0,-1))}><ArrowLeft size={14}/>Back one level</button>
            </nav>}
            {parentBranch&&<p className="junior-branch-context">{BLOCK_TYPES[parentBranch.block.type].decision?`These steps run when the condition is ${parentBranch.branch==='elseChildren'?'false (Otherwise)':'true (Then)'}.`:parentBranch.block.type==='repeatUntil'?'These steps repeat while the condition is false. They stop when it becomes true.':'These steps repeat together.'} Add blocks below, then go back to continue your story.</p>}
            <div className="junior-program" aria-label={parentBranch ? `Blocks inside ${BLOCK_TYPES[parentBranch.block.type].label}${BLOCK_TYPES[parentBranch.block.type].decision?` ${parentBranch.branch==='elseChildren'?'Otherwise':'Then'}`:''}` : 'Program blocks'}>
              {!parentBranch && <div className="junior-start-block">{script.trigger==='tap'?<Hand size={29}/>:script.trigger==='message'?<Send size={29}/>:script.trigger==='key'?<Keyboard size={29}/>:<Flag size={29}/>}<strong>Start</strong><span>{TRIGGERS[script.trigger]}{script.trigger==='message'?` · ${script.message}`:script.trigger==='key'?` · ${script.key||'space'}`:''}</span><ChevronRight className="junior-start-arrow" size={20}/></div>}
              {visibleBlocks.map((block, index) => <BlockCard key={block.id} block={block} index={index} total={visibleBlocks.length} project={current} sprite={sprite}
                onChange={patch => changeBlocks(updateBlockList(allBlocks, block.id, patch))}
                onDelete={() => changeBlocks(removeJuniorBlock(allBlocks, block.id))} onMove={offset => moveBlock(index, offset)}
                onEditBranch={branch=>setEditingPath([...branchView.path,{id:block.id,branch}])} onDropBlock={dropBlock} canCopy={totalBlocks+countJuniorBlocks([block])<=1000} onCopy={()=>{const next=[...visibleBlocks];next.splice(index+1,0,copyJuniorBlock(block));changeVisibleBlocks(next);announce(`Duplicated ${BLOCK_TYPES[block.type].label}.`);}}/>)}
              <button className="junior-drop-hint" onClick={()=>paletteInput.current?.focus()}><Plus size={23}/><span>{visibleBlocks.length ? 'Add the next block' : 'Find your first block'}</span></button>
            </div>
            {sequenceWarning&&<p className="junior-sequence-warning" role="status">{sequenceWarning}</p>}
            <div className="junior-tip"><span>✦</span><p>Make a little magic.<br/><strong>Try Repeat, open “steps inside”, then add Move and Turn.</strong></p></div>
          </div>
        </div>

        <div className="junior-palette">
          <div className="junior-palette-search"><label><Search size={17}/><input ref={paletteInput} type="search" aria-label="Find a Junior block" placeholder="Find a block… try bounce, key, sound" value={blockSearch} onChange={event=>setBlockSearch(event.target.value)}/></label>{blockSearch&&<button onClick={()=>{setBlockSearch('');paletteInput.current?.focus();}}>Clear search</button>}<span role="status">{searching?`${paletteBlocks.length+paletteTriggers.length} results across all categories`:`${Object.keys(BLOCK_TYPES).length} blocks · ${Object.keys(TRIGGERS).length} start events`}</span></div>
          <div className="junior-palette-tabs" role="tablist" aria-label="Block categories">{[{id:'all',name:'All blocks',icon:Layers},...CATEGORIES].map((item,index,items) => <button role="tab" aria-selected={!searching&&category === item.id} tabIndex={category===item.id?0:-1}
            className={`junior-category junior-category-${item.id} ${!searching&&category === item.id ? 'junior-active' : ''}`} key={item.id} onClick={() => chooseCategory(item.id)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;chooseCategory(items[next].id);event.currentTarget.parentElement.children[next].focus();}}><item.icon size={17}/>{item.name}<span className="junior-category-count">{(item.id==='all'?Object.keys(BLOCK_TYPES).length:findJuniorBlocks('',item.id).length)+(item.id==='events'||item.id==='all'?Object.keys(TRIGGERS).length:0)}</span></button>)}</div>
          <div className="junior-palette-content" role="tabpanel" aria-label={searching?'Junior block search results':`${category} blocks`}>
            {(searching||category==='all'||category==='events')&&paletteTriggers.map(([trigger,label])=><button key={trigger} className="junior-palette-block junior-palette-events" disabled={sprite.scripts.length>=20} onClick={()=>{addScript(trigger);announce(`Added a script: ${label}.`);}}>{trigger==='key'?<Keyboard size={25}/>:<Flag size={25}/>}<strong>{label}</strong><span>Start a new script</span></button>)}
            {paletteBlocks.map(([type, info]) => {
              const Icon = BLOCK_ICONS[type] || Cpu;
              return <button key={type} className={`junior-palette-block junior-palette-${info.category}`} disabled={totalBlocks>=1000||(info.container&&branchView.path.length>=8)} onClick={() => addBlock(type)}
                title={totalBlocks>=1000?'Use no more than 1,000 blocks in a Junior project':info.container&&branchView.path.length>=8?'Use no more than eight nested loops or decisions':JUNIOR_BLOCK_HELP[type]} aria-label={`Add ${info.label} block`}><Icon size={28}/><strong>{info.label}</strong><span>{searching?JUNIOR_BLOCK_HELP[type]:info.value!==undefined?`${info.value} ${info.unit}`:info.choice||'Add block'}</span><Plus className="junior-palette-plus" size={14}/></button>;
            })}
            {searching&&!paletteBlocks.length&&!paletteTriggers.length&&<p className="junior-palette-description">No matching blocks. Try “move”, “wait”, “sound” or choose All blocks.</p>}
            {!searching&&category==='control'&&<p className="junior-palette-description">If chooses what happens next. Put steps in Then for a true condition, and Otherwise for a false one. After that, the story continues.</p>}
            {!searching&&category==='sound'&&<button className="junior-palette-block junior-palette-sound" onClick={()=>setAudioOpen(true)}><Mic size={25}/><strong>Your sounds</strong><span>Record / upload</span></button>}
            {!searching&&category==='ai'&&<p className="junior-palette-description">Train or import a model in ML Studio first. Recognition uses the latest test sample or a microphone/camera started there. To react to a result, add Recognize, then a Control → If / otherwise block. This palette does not turn devices on.</p>}
            {!searching&&category==='devices'&&<p className="junior-palette-description">Connect and configure a supported board in Boards & robots first. Pin numbers depend on the selected board.</p>}
            <p className="junior-palette-help">Click a block to add it.<br/>Change its number to experiment.</p>
          </div>
        </div>
      </div>

      <aside className="junior-stage-panel" aria-label="Stage and character settings">
        <div className="junior-stage-heading"><div><span className="junior-eyebrow">THE BIG PICTURE</span><h2>Your stage</h2></div><span className={`junior-engine-status ${ready ? 'junior-engine-ready' : ''}`}><i/>{ready ? 'Scratch engine' : 'Loading engine'}</span></div>
        <div className="junior-stage-frame"><iframe key={stageRevision} ref={frame} data-duet-editor="junior" src="/scratch/index.html?mode=stage" title="Junior Scratch stage" allow="autoplay"/>
          {!ready && <div className="junior-stage-loading"><span className="junior-loading-dot"/>Getting the stage ready…</div>}</div>
        <div className="junior-runbar"><button className="junior-run" disabled={!ready || busy} onClick={run}><Play size={18} fill="currentColor"/>{busy ? 'One moment…' : 'Play story'}</button>
          <button className="junior-control-button" disabled={!ready} onClick={() => stop()} aria-label="Stop story" title="Stop story"><Square size={17} fill="currentColor"/></button>
          <button className="junior-control-button" disabled={!ready || busy} onClick={() => stop(true)} aria-label="Reset starting positions" title="Reset starting positions"><RotateCcw size={19}/></button>
          <span className="junior-run-caption">{running ? 'Watch it go!' : 'Your story starts here'}</span></div>
        <div className="junior-status" role="status" aria-live="polite">{error || notice}{previewDirty&&<span className="junior-pending-edits">Edits saved. They appear after Stop or the next Play.</span>}</div><button className="junior-stage-restart" onClick={()=>restartStage()}><RotateCcw size={14}/>Restart stage</button>

        <div className="junior-character-settings"><div className="junior-settings-heading"><img src={spriteURL(sprite)} alt=""/><div><label htmlFor="junior-sprite-name">YOUR CHARACTER</label><input id="junior-sprite-name" aria-label="Character name" maxLength={40} value={sprite.name} onChange={event => changeSprite({name: event.target.value})}/></div>
          <button className="junior-icon-button" disabled={scene.sprites.length < 2} aria-label="Remove selected character" title="Remove character" onClick={() => {
            const sprites = scene.sprites.filter(item => item.id !== sprite.id); setEditingPath([]);
            change({...current, selectedSpriteId: sprites[0].id, selectedScriptId:sprites[0].scripts[0].id, scenes: current.scenes.map(item => item.id === scene.id ? {...item, sprites} : item)});
          }}><Trash2 size={16}/></button></div>
          <div className="junior-property-grid">{[{key: 'x', label: 'Start X', min: -240, max: 240}, {key: 'y', label: 'Start Y', min: -180, max: 180}, {key: 'size', label: 'Size %', min: 20, max: 200}, {key: 'direction', label: 'Direction °', min: -180, max: 180}].map(property => <label key={property.key}>{property.label}<input type="number" min={property.min} max={property.max} value={sprite[property.key]}
            onChange={event => changeSprite({[property.key]: event.target.value === '' ? '' : Number(event.target.value)})}
            onBlur={event => {const value = Math.min(property.max, Math.max(property.min, Number(event.target.value) || 0)); if (value !== sprite[property.key]) changeSprite({[property.key]: value});}}/></label>)}</div>
          <div className="junior-media-tools"><label>Starting costume <select aria-label="Starting costume" value={sprite.initialCostume||0} onChange={e=>changeSprite({initialCostume:Number(e.target.value)})}><option value="0">Original</option>{(sprite.costumeAssetIds||[]).map((id,i)=><option key={id} value={i+1}>{current.assets?.find(a=>a.id===id)?.name||'Costume'}</option>)}</select></label><button disabled={mediaBusy||(sprite.costumeAssetIds?.length||0)>=20} onClick={()=>chooseImage('costume')}><Upload size={14}/>Upload costume</button><button disabled={(sprite.costumeAssetIds?.length||0)>=20} onClick={()=>setPainting('costume')}><Paintbrush size={14}/>Paint costume</button></div>
        </div>
        <div className="junior-backdrop-settings"><div className="junior-backdrop-heading"><Image size={16}/><label htmlFor="junior-scene-name">Scene</label><input id="junior-scene-name" aria-label="Scene name" value={scene.name} maxLength={40} onChange={event => changeScene({name: event.target.value})}/>
          <button className="junior-icon-button" title="Remove scene" aria-label="Remove selected scene" disabled={current.scenes.length < 2} onClick={() => {
            const scenes = current.scenes.filter(item => item.id !== scene.id); setEditingPath([]);
            change({...current, scenes, selectedSceneId: scenes[0].id, selectedSpriteId: scenes[0].sprites[0].id,selectedScriptId:scenes[0].sprites[0].scripts[0].id});
          }}><Trash2 size={15}/></button></div>
          <div className="junior-backdrop-options">{Object.entries(BACKDROP_ART).map(([kind, svg]) => <button key={kind} aria-pressed={!scene.backdropAssetId&&scene.background === kind} className={!scene.backdropAssetId&&scene.background === kind ? 'junior-selected' : ''} onClick={() => changeScene({background: kind,backdropAssetId:undefined})}><img src={artDataURL(svg)} alt=""/><span>{kind}</span></button>)}</div>
          <div className="junior-media-tools"><button disabled={mediaBusy} onClick={()=>chooseImage('backdrop')}><Upload size={14}/>Upload backdrop</button><button onClick={()=>setPainting('backdrop')}><Paintbrush size={14}/>Paint backdrop</button>{(current.assets||[]).some(a=>a.dataFormat==='png')&&<label>Saved image <select aria-label="Saved backdrop image" value={scene.backdropAssetId||''} onChange={e=>changeScene({backdropAssetId:e.target.value||undefined})}><option value="">Built-in backdrop</option>{current.assets.filter(a=>a.dataFormat==='png').map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}</div>
        </div>
        <p className="junior-stage-note">Play starts at the selected scene. Go to scene blocks switch scenes and stop the old scene’s scripts. Tap characters to run their tap scripts. Click the stage, then press a key to run key scripts.</p>
      </aside>
    </div>
    {painting&&<PaintEditor backdrop={painting==='backdrop'} onClose={()=>setPainting(null)} onSave={asset=>addMedia(asset,painting)}/>}
    {audioOpen&&<AudioLibrary assets={current.assets||[]} onAdd={asset=>addMedia(asset)} onClose={()=>setAudioOpen(false)} onError={message=>announce(message,true)}/>}
  </section>;
}

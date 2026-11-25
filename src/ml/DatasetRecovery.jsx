import React,{useEffect,useId,useRef,useState} from 'react';
import {readRecord,writeRecords} from '../storage.js';
import Dialog from '../components/Dialog.jsx';
import {datasetRecoveryKey,replaceDatasetWithRecovery} from './dataset-recovery.js';
import './dataset-recovery.css';

export function useDatasetRecovery(kind,service,onError) {
  const [snapshot,setSnapshot]=useState(null),revision=useRef(0),mounted=useRef(false);
  useEffect(()=>{
    mounted.current=true;const version=revision.current;
    readRecord(datasetRecoveryKey(kind)).then(saved=>{if(mounted.current&&revision.current===version&&saved?.version===1)setSnapshot(saved);}).catch(error=>onError?.(`Could not open dataset recovery: ${error.message}`));
    const reset=()=>{revision.current++;setSnapshot(null);};
    const event=kind==='image'?'duetblox:dataset-import':`duetblox:${kind}-dataset-import`;
    window.addEventListener(event,reset);
    return()=>{mounted.current=false;revision.current++;window.removeEventListener(event,reset);};
  },[kind,service]);
  const change=(load,apply,recover=true)=>replaceDatasetWithRecovery({kind,service,load,write:writeRecords,isCurrent:()=>mounted.current,recover,apply:(next,saved)=>{revision.current++;setSnapshot(saved);apply(next);}});
  return {snapshot,replace:(load,apply)=>change(load,apply),restore:apply=>snapshot&&change(()=>structuredClone(snapshot.dataset),apply,false)};
}

export default function DatasetRecovery({recovery,busy,onRestore}) {
  if(!recovery.snapshot)return null;
  const dataset=recovery.snapshot.dataset,count=dataset?.images?.length??dataset?.rows?.length??dataset?.classes?.reduce((n,c)=>n+(c.samples?.length||0),0)??0;
  return <div className="ml-dataset-recovery" role="status"><div><strong>Previous dataset saved</strong><span>{count} examples · recovery stays available after reloading. Undo replaces the current examples; export them first if you need both. Retrain to update your model.</span></div><button className="button secondary" disabled={busy} onClick={onRestore}>Undo dataset replacement</button></div>;
}

export function ModelReadyAction({ready,busy,changed,onUseModel,label='Use in Blocks'}) {
  if(!ready)return null;
  return <div className="ml-model-ready"><div><strong>Your model is ready for Blocks</strong><span>{changed?'Examples changed. Train again to use the updated dataset.':'Test with a new example, then use predictions in your project.'}</span></div><button className="button primary" disabled={busy} onClick={onUseModel}>{label} <span aria-hidden="true">→</span></button></div>;
}

export function ClearModelButton({disabled,onClear,label='Clear model'}) {
  const [open,setOpen]=useState(false),[clearing,setClearing]=useState(false),title=useId(),cancel=useRef(null);
  return <><button className="text-button full" disabled={disabled} onClick={()=>setOpen(true)}>{label}</button><Dialog open={open} onClose={()=>{if(!clearing)setOpen(false);}} labelledBy={title} initialFocusRef={cancel} className="ml-import-dialog"><h2 id={title}>Clear the trained model?</h2><p>This removes the model from this browser and from Blocks. Your training examples stay. Export the model first if you want to keep it, or train again later.</p><div className="ml-confirm-actions"><button ref={cancel} className="button secondary" disabled={clearing} onClick={()=>setOpen(false)}>Keep model</button><button className="button primary" disabled={clearing||disabled} onClick={async()=>{setClearing(true);try{await onClear();setOpen(false);}finally{setClearing(false);}}}>{clearing?'Clearing…':'Clear trained model'}</button></div></Dialog></>;
}

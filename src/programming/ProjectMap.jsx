import React,{useEffect,useMemo,useState} from 'react';
import {Search,ArrowUpRight,Layers3} from 'lucide-react';
import {sendEditor} from '../bridge.js';
import {projectMap} from './project-map.js';

export default function ProjectMap({iframe,ready,active,revision}){
  const [project,setProject]=useState(null),[query,setQuery]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let cancelled=false;setProject(null);setLoading(true);setError('');
    if(!ready||!active)return()=>{cancelled=true;};
    const timer=setTimeout(()=>sendEditor(iframe.current,'getProject').then(({project:value})=>{if(!cancelled)setProject(value);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);}),200);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[iframe,ready,active,revision]);
  const map=useMemo(()=>projectMap(project,query),[project,query]);
  const select=async script=>{try{await sendEditor(iframe.current,'showBlock',{blockId:script.id,targetName:script.targetName});setError('');}catch(e){setError(e.message);}};
  return <div className="project-map">
    <p>Find a script by character, block name, variable or words inside a block. Select its character and highlight the script.</p>
    <label className="studio-search"><Search size={17}/><input aria-label="Search project scripts" type="search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “score”, “repeat” or a character name…"/></label>
    <div className="project-map-summary"><Layers3 size={15}/>{map.spriteCount} characters · {map.scriptCount} stacks · {map.blockCount} blocks</div>
    {error&&<p role="alert" className="coding-error">{error}</p>}
    {loading?<p role="status">Reading your project…</p>:!map.matches.length?<p className="coding-empty">{query?'No matching script. Try a block or character name.':'Add blocks to start your project map.'}</p>:<div className="project-map-results">{map.matches.map(script=><button key={`${script.targetName}:${script.id}`} onClick={()=>select(script)}><div><small>{script.targetName} · {script.blockCount} blocks</small><strong>{script.title}</strong><span>{script.preview.slice(1).join(' → ')||'Add the next block to this stack.'}</span></div><ArrowUpRight size={17}/></button>)}</div>}
    {map.matchCount>100&&<p>Showing 100 of {map.matchCount} matching stacks. Narrow your search.</p>}
    {map.truncated&&<p>This large project has a partial map. Up to 500 stacks and 20,000 blocks per target are inspected.</p>}
    <small className="coding-locate-note">Selection opens Code and highlights the stack. Scroll the workspace if the stack is outside view.</small>
  </div>;
}

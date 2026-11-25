import React, {useEffect, useRef, useState} from 'react';
import {LayoutGrid, ZoomIn, ZoomOut, MousePointer2} from 'lucide-react';
import {normalizeJuniorScriptPosition, moveJuniorScriptPosition} from './script-layout.js';
import {JUNIOR_DRAG_TYPE, readJuniorDrag, juniorCanvasPoint} from './drag.js';

/** Canvas layout is presentation metadata; moving or zooming never changes a sequence. */
export default function ScriptCanvas({scripts, selectedId, renderScript, onSelect, onPosition, onArrange, onCanvasDrop, onEndDrag, toolbar}) {
  const [draft, setDraft] = useState(null), [dropPoint, setDropPoint] = useState(null);
  const [sizes, setSizes] = useState({}), [viewSize, setViewSize] = useState({width:0,height:0});
  const [zoom, setZoom] = useState(1);
  const nodes=useRef(new Map()),drag=useRef(null),suppressClick=useRef(false),viewport=useRef(null);

  useEffect(()=>{
    // A palette drag starts outside this section and can finish outside it too.
    const clear=()=>setDropPoint(null);
    window.addEventListener('dragend',clear,true);window.addEventListener('drop',clear,true);
    return()=>{window.removeEventListener('dragend',clear,true);window.removeEventListener('drop',clear,true);};
  },[]);

  useEffect(()=>{
    const measure=()=>{
      const next=Object.fromEntries([...nodes.current].map(([id,node])=>[id,{width:node.offsetWidth,height:node.offsetHeight}]));
      setSizes(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
      const element=viewport.current;
      if(element)setViewSize(previous=>previous.width===element.clientWidth&&previous.height===element.clientHeight?previous:{width:element.clientWidth,height:element.clientHeight});
    };
    const observer=new ResizeObserver(measure);
    for(const node of nodes.current.values())observer.observe(node);
    if(viewport.current)observer.observe(viewport.current);
    measure();return()=>observer.disconnect();
  },[scripts]);

  useEffect(()=>{
    const task=requestAnimationFrame(()=>{
      const node=nodes.current.get(selectedId),surface=viewport.current;if(!node||!surface)return;
      const top=node.offsetTop*zoom,left=node.offsetLeft*zoom,height=node.offsetHeight*zoom,width=Math.min(node.offsetWidth,200)*zoom;
      if(top<surface.scrollTop)surface.scrollTop=top;
      else if(top+height>surface.scrollTop+surface.clientHeight)surface.scrollTop=top+Math.min(height,surface.clientHeight)-surface.clientHeight;
      if(left<surface.scrollLeft)surface.scrollLeft=left;
      else if(left+width>surface.scrollLeft+surface.clientWidth)surface.scrollLeft=left;
    });
    return()=>cancelAnimationFrame(task);
  },[selectedId,scripts.length]);

  let nextY=12;
  const positions=scripts.map(script=>{
    const automatic={x:12,y:nextY};nextY+=(sizes[script.id]?.height||160)+28;
    return draft?.id===script.id?draft.position:normalizeJuniorScriptPosition(script.canvas)||automatic;
  });
  const width=Math.max(580,viewSize.width/zoom,...positions.map((position,index)=>position.x+(sizes[scripts[index].id]?.width||500)+80));
  const height=Math.max(280,viewSize.height/zoom,...positions.map((position,index)=>position.y+(sizes[scripts[index].id]?.height||160)+80));

  function changeZoom(next) {
    next=Math.max(.6,Math.min(1.4,Math.round(next*10)/10));
    const element=viewport.current;
    const center=element?{x:(element.scrollLeft+element.clientWidth/2)/zoom,y:(element.scrollTop+element.clientHeight/2)/zoom}:null;
    setZoom(next);setDropPoint(null);
    if(center)requestAnimationFrame(()=>{if(viewport.current===element){element.scrollLeft=center.x*next-element.clientWidth/2;element.scrollTop=center.y*next-element.clientHeight/2;}});
  }
  function arrange() {
    onArrange();setDropPoint(null);
    // Arranging should reveal the start blocks even after a long sideways scroll.
    if(viewport.current){viewport.current.scrollLeft=0;viewport.current.scrollTop=0;}
  }
  function pointerPosition(event) {
    const element=viewport.current;if(!element)return null;
    const bounds=element.getBoundingClientRect();
    return juniorCanvasPoint({clientX:event.clientX,clientY:event.clientY,left:bounds.left+element.clientLeft,top:bounds.top+element.clientTop,scrollLeft:element.scrollLeft,scrollTop:element.scrollTop,zoom});
  }
  function dragOverCanvas(event) {
    if(!onCanvasDrop||!event.dataTransfer.types.includes(JUNIOR_DRAG_TYPE)||event.target.closest('.junior-canvas-stack'))return;
    event.preventDefault();setDropPoint(pointerPosition(event));
  }
  function dropOnCanvas(event) {
    if(event.target.closest('.junior-canvas-stack'))return;
    const payload=readJuniorDrag(event.dataTransfer),position=pointerPosition(event);setDropPoint(null);
    if(!payload||!position||!onCanvasDrop)return;
    event.preventDefault();event.stopPropagation();onCanvasDrop(payload,position);onEndDrag?.();
  }
  function start(event,script,position) {
    if(event.button!==0)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={id:script.id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,position,zoom,scrollLeft:viewport.current?.scrollLeft||0,scrollTop:viewport.current?.scrollTop||0,moved:false};
    suppressClick.current=false;
  }
  function movedPosition(active,event) {
    return moveJuniorScriptPosition(active.position,
      (event.clientX-active.x+(viewport.current?.scrollLeft||0)-active.scrollLeft)/active.zoom,
      (event.clientY-active.y+(viewport.current?.scrollTop||0)-active.scrollTop)/active.zoom);
  }
  function move(event) {
    const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
    if(!active.moved&&Math.hypot(event.clientX-active.x,event.clientY-active.y)<5)return;
    active.moved=true;
    const element=viewport.current;
    if(element){const bounds=element.getBoundingClientRect();
      if(event.clientX>bounds.right-28)element.scrollLeft+=12;else if(event.clientX<bounds.left+28)element.scrollLeft-=12;
      if(event.clientY>bounds.bottom-28)element.scrollTop+=12;else if(event.clientY<bounds.top+28)element.scrollTop-=12;
    }
    setDraft({id:active.id,position:movedPosition(active,event)});
  }
  function finish(event) {
    const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
    if(active.moved){onPosition(active.id,movedPosition(active,event));suppressClick.current=true;}
    drag.current=null;setDraft(null);
  }

  return <section className="junior-script-canvas" aria-label="All scripts canvas">
    <div ref={viewport} className={`junior-canvas-viewport${dropPoint?' junior-canvas-drop-target':''}`} role="region" aria-label="Scrollable script canvas" tabIndex={0}
      onDragOver={dragOverCanvas} onDrop={dropOnCanvas}
      onDragOverCapture={event=>{if(event.target.closest('.junior-canvas-stack'))setDropPoint(null);}}
      onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDropPoint(null);}}
      onDragEnd={()=>{setDropPoint(null);onEndDrag?.();}}>
      <div className="junior-canvas-scaled" style={{width:width*zoom,height:height*zoom,minWidth:'100%',minHeight:'100%'}}>
        <div className="junior-canvas-surface" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'0 0'}}>
          {scripts.map((script,index)=>{
            const position=positions[index];
            const handle={
              'aria-label':`Move script ${index+1}`,title:'Drag the start block to move this script. Arrow keys move it too.',
              onPointerDown:event=>start(event,script,position),onPointerMove:move,onPointerUp:finish,
              onPointerCancel:()=>{drag.current=null;setDraft(null);},
              onLostPointerCapture:()=>{drag.current=null;setDraft(null);},
              onClick:()=>{if(suppressClick.current){suppressClick.current=false;return;}onSelect(script.id);},
              onKeyDown:event=>{const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];if(!delta)return;event.preventDefault();onPosition(script.id,moveJuniorScriptPosition(position,delta[0]*(event.shiftKey?5:1),delta[1]*(event.shiftKey?5:1)));}
            };
            return <div key={script.id} ref={node=>{if(node)nodes.current.set(script.id,node);else nodes.current.delete(script.id);}} className={`junior-canvas-stack ${selectedId===script.id?'junior-canvas-selected':''}`} data-script-id={script.id} style={{left:position.x,top:position.y}}>{renderScript(script,index,handle)}</div>;
          })}
          {dropPoint&&<div className="junior-canvas-drop-preview" aria-hidden="true" style={{left:dropPoint.x,top:dropPoint.y,pointerEvents:'none'}}>Drop to start a script</div>}
        </div>
      </div>
      {scripts.every(script=>!script.blocks.length)&&!dropPoint&&<div className="junior-canvas-empty" style={{pointerEvents:'none'}}><MousePointer2 size={22}/><strong>Pick a block. Make something happen.</strong><span>Drag blocks here, or click one below to connect it to your start block.</span></div>}
    </div>
    <div className="junior-canvas-tools" role="toolbar" aria-label="Script canvas tools">
      {toolbar}
      <button type="button" aria-label="Zoom in scripts" title="Zoom in" disabled={zoom>=1.4} onClick={()=>changeZoom(zoom+.2)}><ZoomIn size={20}/></button>
      <button type="button" aria-label="Zoom out scripts" title="Zoom out" disabled={zoom<=.6} onClick={()=>changeZoom(zoom-.2)}><ZoomOut size={20}/></button>
      <button type="button" aria-label="Reset script zoom" title="Reset zoom to 100%" onClick={()=>changeZoom(1)}>{Math.round(zoom*100)}%</button>
      <button type="button" aria-label="Arrange scripts" title="Arrange scripts" onClick={arrange}><LayoutGrid size={20}/></button>
    </div>
  </section>;
}

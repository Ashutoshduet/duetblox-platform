import React, {useEffect, useRef, useState} from 'react';
import {LayoutGrid} from 'lucide-react';
import {normalizeJuniorScriptPosition, moveJuniorScriptPosition} from './script-layout.js';

/** All stacks remain editable. Canvas positions are presentation metadata only. */
export default function ScriptCanvas({scripts, selectedId, renderScript, onSelect, onPosition, onArrange}) {
  const [draft, setDraft] = useState(null);
  const [sizes, setSizes] = useState({});
  const nodes=useRef(new Map()),drag=useRef(null),suppressClick=useRef(false),viewport=useRef(null);
  useEffect(()=>{
    const measure=()=>{
      const next=Object.fromEntries([...nodes.current].map(([id,node])=>[id,{width:node.offsetWidth,height:node.offsetHeight}]));
      setSizes(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const observer=new ResizeObserver(measure);
    for(const node of nodes.current.values())observer.observe(node);
    measure();return()=>observer.disconnect();
  },[scripts]);
  useEffect(()=>{
    const task=requestAnimationFrame(()=>{
      const node=nodes.current.get(selectedId),surface=viewport.current;if(!node||!surface)return;
      if(node.offsetTop<surface.scrollTop)surface.scrollTop=node.offsetTop;
      else if(node.offsetTop+node.offsetHeight>surface.scrollTop+surface.clientHeight)surface.scrollTop=node.offsetTop+Math.min(node.offsetHeight,surface.clientHeight)-surface.clientHeight;
      if(node.offsetLeft<surface.scrollLeft)surface.scrollLeft=node.offsetLeft;
      else if(node.offsetLeft+Math.min(node.offsetWidth,200)>surface.scrollLeft+surface.clientWidth)surface.scrollLeft=node.offsetLeft;
    });
    return()=>cancelAnimationFrame(task);
  },[selectedId,scripts.length]);
  let nextY=12;
  const positions=scripts.map(script=>{
    const automatic={x:12,y:nextY};nextY+=(sizes[script.id]?.height||210)+18;
    return draft?.id===script.id?draft.position:normalizeJuniorScriptPosition(script.canvas)||automatic;
  });
  const width=Math.max(580,...positions.map((position,index)=>position.x+(sizes[scripts[index].id]?.width||500)+24));
  const height=Math.max(240,...positions.map((position,index)=>position.y+(sizes[scripts[index].id]?.height||210)+24));

  function start(event,script,position) {
    if(event.button!==0)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={id:script.id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,position,moved:false};
    suppressClick.current=false;
  }
  function move(event) {
    const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
    const dx=event.clientX-active.x,dy=event.clientY-active.y;
    if(!active.moved&&Math.hypot(dx,dy)<5)return;
    active.moved=true;setDraft({id:active.id,position:moveJuniorScriptPosition(active.position,dx,dy)});
  }
  function finish(event) {
    const active=drag.current;if(!active||event.pointerId!==active.pointerId)return;
    if(active.moved){onPosition(active.id,moveJuniorScriptPosition(active.position,event.clientX-active.x,event.clientY-active.y));suppressClick.current=true;}
    drag.current=null;setDraft(null);
  }

  return <section className="junior-script-canvas" aria-label="All scripts canvas">
    <div className="junior-canvas-heading"><span>Every stack is editable · matching start events run together</span><button onClick={onArrange}><LayoutGrid size={14}/>Arrange</button></div>
    <div ref={viewport} className="junior-canvas-viewport" role="region" aria-label="Scrollable script canvas" tabIndex={0}><div className="junior-canvas-surface" style={{width,height}}>
      {scripts.map((script,index)=>{
        const position=positions[index];
        const handle={
          'aria-label':`Move script ${index+1}`,title:'Drag the start block to move this script. Arrow keys move it too.',
          onPointerDown:event=>start(event,script,position),onPointerMove:move,onPointerUp:finish,
          onPointerCancel:()=>{drag.current=null;setDraft(null);},
          onClick:()=>{if(suppressClick.current){suppressClick.current=false;return;}onSelect(script.id);},
          onKeyDown:event=>{const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];if(!delta)return;event.preventDefault();onPosition(script.id,moveJuniorScriptPosition(position,delta[0]*(event.shiftKey?5:1),delta[1]*(event.shiftKey?5:1)));}
        };
        return <div key={script.id} ref={node=>{if(node)nodes.current.set(script.id,node);else nodes.current.delete(script.id);}} className={`junior-canvas-stack ${selectedId===script.id?'junior-canvas-selected':''}`} data-script-id={script.id} style={{left:position.x,top:position.y}}>{renderScript(script,index,handle)}</div>;
      })}
    </div></div>
  </section>;
}

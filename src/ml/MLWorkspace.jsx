import React,{useState,useEffect,useRef,useId} from 'react';
import {imageModel} from './model-service';
import MLStudio from './MLStudio';
import SoundStudio from './audio/SoundStudio';
import PoseStudio from './pose/PoseStudio';
import TextStudio from './text/TextStudio.jsx';
import NumericWorkspace from './numbers/NumericWorkspace.jsx';
import ObjectStudio from './objects/ObjectStudio.jsx';
const modes=[['image','Image',MLStudio,'duetML'],['sound','Sound',SoundStudio,'duetSound'],['pose','Pose',PoseStudio,'duetPose'],['text','Text',TextStudio,'duetText'],['numbers','Numbers',NumericWorkspace,'duetNumbers'],['objects','Object',ObjectStudio,'duetObjects']];
export default function MLWorkspace({active,visible=active,onStatus,onUseModel}){
 const [mode,setMode]=useState('image'),tabs=useRef({}),id=useId();
 useEffect(()=>{if(mode!=='image'||!active)imageModel.stopCamera();},[mode,active]);
 const navigate=(event,index)=>{let target;if(event.key==='ArrowRight')target=(index+1)%modes.length;else if(event.key==='ArrowLeft')target=(index+modes.length-1)%modes.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=modes.length-1;else return;event.preventDefault();const next=modes[target][0];setMode(next);tabs.current[next]?.focus();};
 return <><div className="ml-mode-tabs" role="tablist" aria-label="Learning type">{modes.map(([key,label],index)=><button key={key} ref={el=>tabs.current[key]=el} id={`${id}-${key}-tab`} role="tab" aria-controls={`${id}-${key}-panel`} aria-selected={mode===key} tabIndex={mode===key?0:-1} className={`button ${mode===key?'primary':'secondary'}`} onKeyDown={event=>navigate(event,index)} onClick={()=>setMode(key)}>{label} learning</button>)}</div>{modes.map(([key,,Studio,extension])=><div key={key} id={`${id}-${key}-panel`} role="tabpanel" aria-labelledby={`${id}-${key}-tab`} hidden={mode!==key}><Studio visible={visible&&mode===key} active={active&&mode===key} onStatus={onStatus} onUseModel={()=>onUseModel(extension)}/></div>)}</>;
}

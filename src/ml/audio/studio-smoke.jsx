import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import SoundStudio from './SoundStudio.jsx';
import PoseStudio from '../pose/PoseStudio.jsx';
import '../../styles.css';
function Preview(){const [mode,setMode]=useState('sound');return <div style={{padding:24}}><nav><button onClick={()=>setMode('sound')}>Sound studio</button> <button onClick={()=>setMode('pose')}>Pose studio</button></nav><div hidden={mode!=='sound'}><SoundStudio active={mode==='sound'}/></div><div hidden={mode!=='pose'}><PoseStudio active={mode==='pose'}/></div></div>;}
createRoot(document.getElementById('root')).render(<Preview/>);

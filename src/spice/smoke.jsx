import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import SpiceStudio from './SpiceStudio.jsx';
import {defaultSpiceProject} from './model.js';
import '../styles.css';
function Harness(){const [project,setProject]=useState(defaultSpiceProject()),[active,setActive]=useState(true);return <><button className="button secondary" onClick={()=>setActive(value=>!value)}>{active?'Hide workspace':'Show workspace'}</button><SpiceStudio project={project} onProjectChange={setProject} active={active}/></>;}
createRoot(document.getElementById('root')).render(<Harness/>);

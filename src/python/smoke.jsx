import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PythonStudio from './PythonStudio.jsx';
import {defaultPythonProject} from './project.js';
import '../styles.css';
function Harness(){const [project,setProject]=useState(defaultPythonProject()),[active,setActive]=useState(true);return <><button onClick={()=>setActive(v=>!v)}>{active?'Hide workspace':'Show workspace'}</button><PythonStudio project={project} onProjectChange={setProject} active={active}/></>;}
createRoot(document.getElementById('root')).render(<Harness/>);

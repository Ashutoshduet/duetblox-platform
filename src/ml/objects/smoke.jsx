import React from 'react';
import {createRoot} from 'react-dom/client';
import ObjectStudio from './ObjectStudio.jsx';
import {objectModel} from './model-service.js';
import '../../styles.css';
window.objectModel=objectModel;
createRoot(document.getElementById('root')).render(<ObjectStudio active onUseModel={()=>{}}/>);

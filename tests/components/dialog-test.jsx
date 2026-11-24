import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Dialog from '../../src/components/Dialog.jsx';
function Fixture(){
 const [parent,setParent]=useState(false),[child,setChild]=useState(false),[busy,setBusy]=useState(false),[empty,setEmpty]=useState(false);
 const first=useRef(null);
 return <><button onClick={()=>setParent(true)}>Open parent</button><button onClick={()=>{setParent(true);setChild(true);}}>Open both</button><button onClick={()=>setEmpty(true)}>Open empty</button>
 <Dialog open={parent} onClose={()=>setParent(false)} labelledBy="parent-heading" initialFocusRef={first}>
 <h2 id="parent-heading">Parent dialog</h2><button onClick={()=>setParent(false)}>Close parent</button><label>Parent name<input ref={first}/></label><button onClick={()=>setChild(true)}>Open child</button>
 <Dialog open={child} onClose={busy?undefined:()=>setChild(false)} labelledBy="child-heading"><h2 id="child-heading">Child dialog</h2><button onClick={()=>setChild(false)}>Close child</button><button onClick={()=>setBusy(!busy)}>{busy?'Finish work':'Start work'}</button><button onClick={()=>{setParent(false);setChild(false);}}>Close both</button></Dialog>
 </Dialog>
 <Dialog open={empty} onClose={()=>setEmpty(false)} labelledBy="empty-heading"><h2 id="empty-heading">Empty dialog</h2><p>Escape closes this test dialog.</p></Dialog></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);

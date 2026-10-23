// Access keys live only in this service instance. They are never saved in a project or browser storage.
export class ClassroomService{
 constructor({fetchImpl=(...args)=>globalThis.fetch(...args)}={}){this.fetch=fetchImpl;this.credentials=null;this.state={connected:false,room:null,role:null,url:null,error:null};this.listeners=new Set();this.generation=0;this.controllers=new Set();}
 getState(){return {...this.state};}
 subscribe(listener){this.listeners.add(listener);listener(this.getState());return()=>this.listeners.delete(listener);}
 emit(){for(const fn of this.listeners)fn(this.getState());}
 disconnect(){this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();this.credentials=null;this.state={connected:false,room:null,role:null,url:null,error:null};this.emit();}
 async connect({url,room,key}){
  this.disconnect();const generation=this.generation;let parsed;try{parsed=new URL(url);}catch{throw Error('Enter the full classroom server URL.');}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw Error('Use the classroom origin, such as http://127.0.0.1:5191.');
  if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(room))throw Error('Enter the room name supplied by your teacher.');if(typeof key!=='string'||key.length<32||key.length>256)throw Error('Enter the room access key.');
  this.credentials={url:parsed.origin,room,key};
  try{const session=await this.request('session');if(this.generation!==generation)throw Error('Classroom connection was cancelled.');this.state={connected:true,room:session.room,role:session.role,url:parsed.origin,error:null};this.emit();return this.getState();}
  catch(e){if(this.generation===generation){this.credentials=null;this.state={...this.state,error:e.message};this.emit();}throw e;}
 }
 async request(resource,{method='GET',body,headers={},blob=false}={}){
  const credentials=this.credentials;if(!credentials)throw Error('Connect to a private classroom first.');const generation=this.generation,controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),30000);
  try{const response=await this.fetch(`${credentials.url}/api/classroom/rooms/${encodeURIComponent(credentials.room)}/${resource}`,{method,headers:{Authorization:`Bearer ${credentials.key}`,...headers},body,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});if(!response.ok){let message=`Classroom request failed (${response.status}).`;try{message=(await response.json()).error||message;}catch{}if(response.status===401&&generation===this.generation){this.disconnect();this.state.error=message;this.emit();}throw Error(message);}const value=blob?await response.blob():await response.json();if(generation!==this.generation)throw Error('Classroom connection changed.');return value;}
  catch(e){const message=e.name==='AbortError'?'Classroom request stopped or timed out.':e instanceof TypeError?'Cannot reach the classroom server. Check its address, network and allowed browser origin.':null;if(message){if(generation===this.generation){this.disconnect();this.state.error=message;this.emit();}throw Error(message);}throw e;}
  finally{clearTimeout(timer);this.controllers.delete(controller);}
 }
 listProjects(){return this.request('projects').then(x=>x.projects);}
 shareProject(file){if(!file||file.size>64*1024*1024||!file.size||!/^.+\.(duet|sb3)$/i.test(file.name))throw Error('Choose a .duet or .sb3 project up to 64 MB.');return this.request('projects',{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream','X-Project-Name':encodeURIComponent(file.name)}});}
 downloadProject(id){if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid project identity.');return this.request(`projects/${id}`,{blob:true});}
 deleteProject(id){if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid project identity.');return this.request(`projects/${id}`,{method:'DELETE'});}
 getVariables(){return this.request('variables');}
 setVariable(name,value){if(!/^[A-Za-z][A-Za-z0-9 _-]{0,47}$/.test(name))throw Error('Variable names start with a letter and contain up to 48 letters, numbers, spaces, underscores or hyphens.');if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e12)throw Error('Classroom values must be numbers between -1e12 and 1e12.');return this.request(`variables/${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify({value}),headers:{'Content-Type':'application/json'}}).then(x=>x.value);}
 async getVariable(name){if(typeof name!=='string'||!/^[A-Za-z][A-Za-z0-9 _-]{0,47}$/.test(name))throw Error('Invalid classroom variable name.');const x=await this.getVariables();if(!Object.hasOwn(x.values,name))throw Error(`Classroom variable "${name}" has not been set.`);return x.values[name];}
 rpc(method,args=[]){if(method==='isConnected')return this.state.connected;if(method==='getVariable')return this.getVariable(...args);if(method==='setVariable')return this.setVariable(...args);throw Error('Unsupported classroom command.');}
}
export const classroomService=new ClassroomService();

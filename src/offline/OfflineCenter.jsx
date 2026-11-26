import React,{useEffect,useRef,useState} from 'react';
import {Download,WifiOff,ShieldCheck,CheckCircle2,RefreshCw} from 'lucide-react';
import {offlineCommand} from './client.js';
import {appPath} from '../app-paths.js';
import './offline.css';
const mb=n=>`${Math.ceil((n||0)/1048576)} MB`;
export function OfflineStatus({onOpen}){
 const [online,setOnline]=useState(navigator.onLine),[pack,setPack]=useState(null);useEffect(()=>{const update=e=>setPack(e.detail);window.addEventListener('duetblox:offline-status',update);offlineCommand('STATUS').catch(()=>{});return()=>window.removeEventListener('duetblox:offline-status',update);},[]);useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
 return <button className="offline-status" onClick={onOpen}><WifiOff size={14}/>{pack?.offline?'Offline mode':!online?'Connection unavailable':pack?.ready?'Offline ready':'Offline setup'}</button>;
}
export default function OfflineCenter(){
 const [status,setStatus]=useState(null),[progress,setProgress]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[install,setInstall]=useState(null);
 const [checking,setChecking]=useState(true),[latestVersion,setLatestVersion]=useState(null);
 const latest=useRef(null),generation=useRef(0);
 const check=async()=>{
  const request=++generation.current;setChecking(true);
  try{
   setError('');const current=await offlineCommand('STATUS');
   if(navigator.onLine&&!current.offline){
    try{
     const response=await fetch(appPath('offline-manifest.json'),{cache:'no-store',signal:AbortSignal.timeout(5000)});
     if(response.ok){const manifest=await response.json();if(request===generation.current&&/^[0-9a-f]{20}$/.test(manifest.version)&&manifest.basePath===appPath(''))latest.current=manifest.version;}
    }catch{/* An unavailable network must not prevent an already-prepared pack from working. */}
   }
   if(request===generation.current){setStatus(current);setLatestVersion(latest.current);}
   return {current,stale:request!==generation.current,needsUpdate:!!latest.current&&latest.current!==current.version};
  }catch(e){if(request===generation.current)setError(e.message);throw e;}
  finally{if(request===generation.current)setChecking(false);}
 };
 useEffect(()=>{
  const refresh=()=>{check().catch(()=>{});};refresh();
  const prompt=e=>{e.preventDefault();setInstall(e);};window.addEventListener('beforeinstallprompt',prompt);
  navigator.serviceWorker?.addEventListener('controllerchange',refresh);
  return()=>{generation.current++;window.removeEventListener('beforeinstallprompt',prompt);navigator.serviceWorker?.removeEventListener('controllerchange',refresh);};
 },[]);
 const needsUpdate=!!latestVersion&&latestVersion!==status?.version;
 const prepare=async()=>{
  setBusy(true);setError('');setProgress(null);
  try{
   // Recheck immediately before preparation: another window may have updated the app.
   const current=await check();if(current.stale||current.needsUpdate)return;
   const result=await offlineCommand('PREPARE',{},setProgress);
   if(result.type==='cancelled')setError('Preparation cancelled. Completed files are kept so you can resume.');
   await check();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const toggle=async()=>{setBusy(true);try{setError('');setStatus(await offlineCommand('SET_OFFLINE',{enabled:!status.offline}));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="offline-page"><div className="page-heading"><div><div className="eyebrow">TAKE YOUR IDEAS ANYWHERE</div><h1>Ready when Wi-Fi isn’t.</h1><p>Keep the coding studio, media library and learning models on this device.</p></div><WifiOff size={42}/></div>
 <section className="offline-card" aria-label="Offline preparation"><div className="offline-ready"><ShieldCheck size={28}/><div><h2>{status?.ready?'Your offline pack is ready':'Prepare this browser once'}</h2><p>{status?`${status.files.toLocaleString()} files · ${mb(status.bytes)} · checked before saving`:'Checking browser storage…'}</p></div></div><p>Keep this page open while files are saved. On the downloaded laptop copy, files come from your local folder; on a hosted site, download them while connected. Your projects remain separate.</p>
 {needsUpdate&&<div className="offline-update" role="status"><h3>A newer version is available</h3><p>This window is still using an older offline pack. Save your project in every open DUETBlox window, then load the latest version before preparing its offline files.</p><a className="button primary" href={appPath('update.html')}>Load latest version</a></div>}
 {progress&&<div aria-live="polite"><progress max={progress.totalBytes} value={progress.bytes}/><p>{mb(progress.bytes)} of {mb(progress.totalBytes)} · {progress.completed} / {progress.total} files</p></div>}
 <div className="offline-actions"><button className="button primary" disabled={busy||checking||!status||needsUpdate} onClick={prepare}><Download size={17}/>{busy?'Preparing…':status?.ready?'Check / repair offline files':'Make available offline'}</button>{busy&&<button className="button secondary" onClick={()=>offlineCommand('CANCEL').catch(e=>setError(e.message))}>Cancel preparation</button>}<button className="button secondary" disabled={busy||checking} onClick={()=>check().catch(()=>{})}><RefreshCw size={16}/> Check status</button></div>
 {error&&<p role="alert" className="offline-error">{error}</p>}
 {(status?.ready||status?.offline)&&<div className="offline-mode"><label><input type="checkbox" checked={!!status.offline} onChange={toggle} disabled={busy||checking}/> Use offline mode</label><p>Serve prepared files only and block internet requests from this app. Your local Arduino compiler and a connected classroom at a private LAN IP can still work. Turn this off to use online model links and web services.</p></div>}
 </section>
 <div className="offline-columns"><section className="offline-card"><h2>What comes with you</h2><ul>{['Junior stories and Scratch coding','Sprite, backdrop and sound library','Image, sound, pose, text and number training','Local Python and its standard library','Saved models, predictions and evaluation','Built-in lessons in English and Hindi','Wired circuits and local ngspice analog simulation','Prepared Arduino / ESP32 live firmware'].map(label=><li key={label}><CheckCircle2 size={17}/>{label}</li>)}</ul></section>
 <section className="offline-card"><h2>A few things to know</h2><p>Keep downloaded .duet backups. Clearing browser data or browser storage eviction can remove offline files and local saves.</p><p>Model links, web translation, text-to-speech services and external tutorial videos need internet. Board compilation needs the local helper and toolchains installed beforehand. Camera, microphone and USB still need your permission.</p><p>Use the same address and port each time. Installing the app is optional; a prepared browser tab works too.</p>{install?<button className="button secondary" onClick={async()=>{await install.prompt();await install.userChoice;setInstall(null);}}>Install DUETBlox</button>:<p className="hint">If your browser offers “Install app”, use its address-bar or menu option. This is a browser app; a Windows .exe is a later step.</p>}</section></div></div>;
}

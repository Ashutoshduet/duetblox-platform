import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Sparkles} from 'lucide-react';
import CelebrationCard from './CelebrationCard.jsx';
import {celebrations, DANCES} from './store.js';
import {createCelebrationAudio} from './audio.js';
import './companion.css';

const names = {zuni: 'Zuni', duvi: 'Duvi', tiko: 'Tiko'};
const danceNames = {surprise: 'Mix it up', bounce: 'Happy bounce', shuffle: 'Robot shuffle', spin: 'Little spin', 'high-five': 'High-five', victory: 'Victory pose'};

export default function MascotCompanion({scope, suspended = false}) {
  const {preferences, event, storageError} = useSyncExternalStore(celebrations.subscribe, celebrations.snapshot, celebrations.snapshot);
  const [preview, setPreview] = useState(null), [playing, setPlaying] = useState(false), [playKey, setPlayKey] = useState(0);
  const [systemReduce, setSystemReduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [soundNotice, setSoundNotice] = useState('');
  const audio = useRef(null), timer = useRef(null), previewSerial = useRef(0), requestEpoch = useRef(0), mounted = useRef(true), live = useRef(null);
  if (!audio.current) audio.current = createCelebrationAudio();
  const reduced = preferences.reduceMotion || systemReduce;
  const current = !suspended && preferences.enabled ? (preview?.scope === scope ? preview : null) || (event?.scope === scope ? event : null) : null;
  live.current = {scope, suspended, enabled: preferences.enabled, eventId: current?.id};
  const stop = () => {requestEpoch.current++; clearTimeout(timer.current); audio.current.stop(); setPlaying(false);};
  const start = (withSound = preferences.sound) => {
    clearTimeout(timer.current); setPlayKey(value => value + 1); setPlaying(!reduced);
    if (withSound) audio.current.play();
    timer.current = setTimeout(() => setPlaying(false), 2600);
  };
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduce(query.matches);
    query.addEventListener('change', change); return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {setPreview(null); stop();}, [scope, suspended]);
  useEffect(() => {setPreview(null);}, [event?.id]);
  useEffect(() => {
    if (current) start(); else stop();
    return () => {clearTimeout(timer.current); audio.current.stop();};
  }, [current?.id, current?.scope]);
  useEffect(() => {if (reduced || suspended || !preferences.enabled) stop();}, [reduced, suspended, preferences.enabled]);
  useEffect(() => {if (!preferences.sound) audio.current.disable();}, [preferences.sound]);
  useEffect(() => {mounted.current=true;return () => {mounted.current=false;requestEpoch.current++;clearTimeout(timer.current);audio.current.dispose();};}, []);
  const change = patch => celebrations.setPreferences(patch);
  const enableSound = async checked => {
    change({sound: checked}); setSoundNotice('');
    if (checked && !await audio.current.enable()) setSoundNotice('Sound is unavailable in this browser. The mascot still works silently.');
    if (!checked) audio.current.disable();
  };
  const requestStillActive = (token, requestedScope) => mounted.current && token === requestEpoch.current && live.current.scope === requestedScope && !live.current.suspended && live.current.enabled && celebrations.snapshot().preferences.enabled;
  const replay = async () => {
    const token=++requestEpoch.current, eventId=current?.id;
    if (preferences.sound) await audio.current.enable();
    if (!requestStillActive(token,scope) || live.current.eventId !== eventId) return;
    start(celebrations.snapshot().preferences.sound);
  };
  const previewDance = async () => {
    const token=++requestEpoch.current;
    if (preferences.sound) await audio.current.enable();
    if (!requestStillActive(token,scope)) return;
    const count = ++previewSerial.current;
    setPreview({id: `preview-${count}`, scope, title: `Meet ${names[preferences.mascot]}!`, message: 'Just a dance preview. Your story and progress stay as they are.', dance: preferences.dance === 'surprise' ? DANCES[(count - 1) % DANCES.length] : preferences.dance});
  };
  return <div className="mascot-companion" data-scope={scope}>
    {current && <CelebrationCard event={current} mascot={preferences.mascot} palette={preferences.palette} motionReduced={reduced} playing={playing} playKey={playKey} onReplay={replay} onSkip={()=>{if(playing)stop();else{stop();setPreview(null);celebrations.clear(scope);}}}/>}
    <details className="mascot-settings">
      <summary><Sparkles size={17} aria-hidden="true"/>Mascot settings</summary>
      <div className="mascot-preferences">
        <p>Your coding buddy. Short celebrations, your way.</p>
        <label><input type="checkbox" checked={preferences.enabled} onChange={event => change({enabled: event.target.checked})}/>Celebrate milestones</label>
        <label><input type="checkbox" checked={preferences.sound} onChange={event => enableSound(event.target.checked)}/>Celebration sound</label>
        <small>Sound is off until you choose it. After reopening the app, use Preview dance to enable audio for this visit.</small>
        <label><input type="checkbox" checked={preferences.reduceMotion} onChange={event => change({reduceMotion: event.target.checked})}/>Reduce celebration motion</label>
        {systemReduce && <small>Your device’s reduced-motion preference is also respected.</small>}
        <label>Mascot<select aria-label="Mascot" value={preferences.mascot} onChange={event => change({mascot: event.target.value})}><option value="zuni">Zuni · robot fox</option><option value="duvi">Duvi · robot</option><option value="tiko">Tiko · fox</option></select></label>
        <label>Celebration dance<select aria-label="Celebration dance" value={preferences.dance} onChange={event => change({dance: event.target.value})}>{Object.entries(danceNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Mascot colours<select aria-label="Mascot colours" value={preferences.palette} onChange={event => change({palette: event.target.value})}><option value="lilac">Lilac & mint</option><option value="ocean">Ocean & sky</option><option value="sunset">Peach & plum</option></select></label>
        <button type="button" disabled={!preferences.enabled || suspended} onClick={previewDance}>Preview dance</button>
        {soundNotice && <p role="status">{soundNotice}</p>}
        {storageError && <p role="status">Your choices work for this visit, but this browser could not save them.</p>}
      </div>
    </details>
  </div>;
}

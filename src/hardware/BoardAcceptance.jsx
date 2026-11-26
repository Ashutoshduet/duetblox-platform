import React,{useState} from 'react';
import {Download} from 'lucide-react';
import {boardAcceptanceSteps,createBoardAcceptanceReport} from './acceptance.js';
import {downloadBlob} from '../storage.js';

export default function BoardAcceptance({board,mode}) {
  const [observations,setObservations]=useState({}),[notes,setNotes]=useState('');
  const steps=boardAcceptanceSteps(board.id,mode);
  const observed=steps.filter(step=>observations[step.id]&&observations[step.id]!=='not-tested').length;
  const download=()=>{const record=createBoardAcceptanceReport({boardId:board.id,mode,observations,notes});downloadBlob(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),`DUETBlox-${board.id}-${mode}-observations.json`);};
  return <details className="board-acceptance">
    <summary>Test your real board · {observed}/{steps.length} observations recorded</summary>
    <p>For a teacher or student with the physical board. Mark only what you actually observed. These are your notes, not automatic test results. These notes are temporary and reset when you change board or mode, or reload the app. Download the record to keep it with the exact program you tested.</p>
    <ol>{steps.map(step=><li key={step.id}><strong>{step.title}</strong><p>{step.instruction}</p><label>Observation: {step.title}<select aria-label={`Observation: ${step.title}`} value={observations[step.id]||'not-tested'} onChange={event=>setObservations(value=>({...value,[step.id]:event.target.value}))}><option value="not-tested">Not tested</option><option value="observed-pass">Observed as expected</option><option value="observed-issue">An issue was observed</option></select></label></li>)}</ol>
    <label className="board-test-notes">Test notes<textarea aria-label="Board test notes" maxLength={4000} rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Program filename, exact board variant, wiring, expected result, actual result and any errors. Do not include passwords or student personal details."/></label>
    <button className="small-button" onClick={download}><Download size={16}/> Download observations</button>
    <p>Software support and actual device validation remain separate. A successful simulation or compile does not mark these checks complete.</p>
  </details>;
}

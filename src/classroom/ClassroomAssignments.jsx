import React, {useEffect, useRef, useState} from 'react';
import {BookOpen, Download, RefreshCw, Upload} from 'lucide-react';
import {classroomService} from './client.js';
import {downloadBlob} from '../storage.js';

const labels = {reviewed: 'Reviewed', revise: 'Try a revision', complete: 'Complete'};
function ReviewForm({submission, busy, onReview}) {
 const [status, setStatus] = useState(submission.review?.status || 'reviewed');
 const [feedback, setFeedback] = useState(submission.review?.feedback || '');
 return <form className="classroom-review" onSubmit={e => { e.preventDefault(); onReview({status, feedback}); }}>
  <label>Review status<select aria-label="Review status" value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>{Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
  <label>Feedback for this student<textarea maxLength={3000} rows={3} value={feedback} disabled={busy} onChange={e => setFeedback(e.target.value)} placeholder="What worked? What could they try next?"/></label>
  <button className="button secondary" disabled={busy}>Save feedback</button>
 </form>;
}

export default function ClassroomAssignments({state, onStatus}) {
 const [assignments, setAssignments] = useState([]), [submissions, setSubmissions] = useState([]);
 const [title, setTitle] = useState(''), [instructions, setInstructions] = useState('');
 const [assignmentId, setAssignmentId] = useState(''), [alias, setAlias] = useState('');
 const [receipt, setReceipt] = useState(null), [ownSubmission, setOwnSubmission] = useState(null);
 const [receiptHistory, setReceiptHistory] = useState([]);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const uploadInput = useRef(null), receiptInput = useRef(null), generation = useRef(0);
 const teacher = state.role === 'teacher';
 const refresh = async () => {
  const current = generation.current;
  const [tasks, work] = await Promise.all([classroomService.listAssignments(), teacher ? classroomService.listSubmissions() : Promise.resolve([])]);
  if (current === generation.current) { setAssignments(tasks); setSubmissions(work); }
 };
 useEffect(() => {
  generation.current++; setAssignments([]); setSubmissions([]); setReceipt(null); setOwnSubmission(null); setReceiptHistory(classroomService.getSubmissionReceipts()); setError(''); setBusy(false); setAssignmentId(''); setAlias(''); setTitle(''); setInstructions('');
  let cancelled = false;
  if (state.connected) refresh().catch(e => { if (!cancelled) setError(e.message); });
  return () => { cancelled = true; generation.current++; };
 }, [state.connected, state.room, state.url, state.role]);
 const attempt = async fn => {
  const current = generation.current; setBusy(true); setError('');
  try { await fn(); } catch (e) { if (current === generation.current) { setError(e.message); onStatus?.(e.message); } }
  finally { if (current === generation.current) setBusy(false); }
 };
 const submit = event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (file) attempt(async () => {
   const result = await classroomService.submitAssignment(file, assignmentId, alias);
   setReceipt(result.receipt); setOwnSubmission(result.submission); setReceiptHistory(classroomService.getSubmissionReceipts());
   if (teacher) await refresh();
   onStatus?.('Submitted privately to your teacher. Save your receipt to check feedback later.');
  });
 };
 const openReceipt = event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (file) attempt(async () => {
   if (file.size > 8192) throw Error('Submission receipts must be smaller than 8 KB.');
   let parsed; try { parsed = JSON.parse(await file.text()); } catch { throw Error('Choose a valid submission receipt JSON file.'); }
   classroomService.validateReceipt(parsed);
   const submission = await classroomService.getSubmission(parsed.id, parsed);
   setReceipt(classroomService.rememberSubmissionReceipt(parsed, submission.name)); setOwnSubmission(submission); setReceiptHistory(classroomService.getSubmissionReceipts());
  });
 };
 return <section className="classroom-card classroom-gallery classroom-assignments" aria-label="Classroom assignments">
  <div className="classroom-title"><h2><BookOpen size={21}/> Assignments & feedback</h2><button className="button secondary" disabled={!state.connected || busy} onClick={() => attempt(refresh)}><RefreshCw size={16}/> Refresh assignments</button></div>
  <p>Send work privately to your teacher. Assignment submissions do not appear in the room gallery. Use a classroom alias; it is self-reported, not a verified student identity.</p>
  {!state.connected ? <p>Join your teacher’s room to view assignments.</p> : <>
   {teacher && <details><summary>Create an assignment</summary><form onSubmit={e => { e.preventDefault(); attempt(async () => { await classroomService.saveAssignment({title, instructions, closed: false}); setTitle(''); setInstructions(''); await refresh(); onStatus?.('Assignment is open for submissions.'); }); }}>
    <label>Assignment title<input required maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)}/></label>
    <label>Instructions<textarea required maxLength={5000} rows={5} value={instructions} disabled={busy} onChange={e => setInstructions(e.target.value)} placeholder="Make… Try… Explain what happened… Save your project and submit it here."/></label>
    <button className="button primary" disabled={busy || !title.trim() || !instructions.trim()}>Create assignment</button>
   </form></details>}
   <div className="classroom-task-list">{assignments.length ? assignments.map(task => <article key={task.id}><h3>{task.title}</h3><p className="classroom-instructions">{task.instructions}</p><span>{task.closed ? 'Closed for submissions' : 'Open for submissions'}</span>{teacher && <button className="button secondary" disabled={busy} onClick={() => attempt(async () => { await classroomService.saveAssignment({...task, closed: !task.closed}, task.id); await refresh(); })}>{task.closed ? 'Reopen' : 'Close'} {task.title}</button>}</article>) : <p>{teacher ? 'Create a small assignment with a clear goal and one question for students to explain.' : 'No assignments yet. Your teacher will add one here.'}</p>}</div>
   <div className="classroom-assignment-send"><h3>Submit your saved project</h3><p>First use Save project in your workspace. A .duet file may include images, sound recordings and datasets. Choose only a file you intend your teacher to receive.</p>
    <label>Assignment<select aria-label="Assignment" value={assignmentId} disabled={busy} onChange={e => setAssignmentId(e.target.value)}><option value="">Choose an open assignment</option>{assignments.filter(a => !a.closed).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
    <label>Classroom alias<input maxLength={80} value={alias} disabled={busy} onChange={e => setAlias(e.target.value)} placeholder="The alias your teacher recognizes" autoComplete="off"/></label>
    <input hidden type="file" accept=".duet,.sb3" ref={uploadInput} onChange={submit}/><button className="button primary" disabled={busy || !assignmentId || !alias.trim()} onClick={() => uploadInput.current?.click()}><Upload size={16}/> Choose file and submit privately</button>
   </div>
   <div className="classroom-receipt"><h3>Your submission receipt</h3><p>Save this private receipt to check feedback after reconnecting. Anyone with the receipt and the room key can view that submission. Keep it out of shared projects. Receipts remain available while you navigate this session, but are forgotten on disconnect or reload.</p>
    {receiptHistory.length > 0 && <label>Submissions from this session<select aria-label="Submissions from this session" value={receipt?.id || ''} disabled={busy} onChange={e => { const selected = receiptHistory.find(item => item.receipt.id === e.target.value); if (selected) attempt(async () => { const submission = await classroomService.getSubmission(selected.receipt.id, selected.receipt); setReceipt(selected.receipt); setOwnSubmission(submission); }); }}><option value="">Choose a receipt</option>{receiptHistory.map(item => <option key={item.receipt.id} value={item.receipt.id}>{item.name} · {item.receipt.id.slice(0, 8)}</option>)}</select></label>}
    <input hidden type="file" accept=".json" ref={receiptInput} onChange={openReceipt}/><div className="classroom-actions"><button className="button secondary" disabled={busy} onClick={() => receiptInput.current?.click()}>Open submission receipt</button>{receipt && <><button className="button secondary" disabled={busy} onClick={() => downloadBlob(new Blob([JSON.stringify(receipt, null, 2)], {type: 'application/json'}), `submission-${receipt.id}.json`)}><Download size={16}/> Save submission receipt</button><button className="button secondary" disabled={busy} onClick={() => attempt(async () => setOwnSubmission(await classroomService.getSubmission(receipt.id, receipt)))}>Check my feedback</button></>}</div>
    {ownSubmission && <article className="classroom-private-feedback" aria-label="Your private feedback"><strong>{ownSubmission.name}</strong><p>{ownSubmission.review ? labels[ownSubmission.review.status] : 'Waiting for teacher feedback'}</p>{ownSubmission.review?.feedback && <p className="classroom-instructions">{ownSubmission.review.feedback}</p>}<button className="button secondary" disabled={busy} onClick={() => attempt(async () => downloadBlob(await classroomService.downloadSubmission(ownSubmission.id, receipt), ownSubmission.name))}>Download my submitted file</button></article>}
   </div>
   {teacher && <div className="classroom-review-list"><h3>Teacher review · {submissions.length} submissions</h3><p>Download and inspect a copy before leaving feedback. Downloading does not execute the student’s program. Save your own work before opening their project.</p>{submissions.length ? submissions.map(item => <article key={item.id}><h4>{item.studentName} · {assignments.find(a => a.id === item.assignmentId)?.title || 'Assignment'}</h4><p>{item.name} · {new Date(item.createdAt).toLocaleString()} · {item.review ? labels[item.review.status] : 'Awaiting review'}</p><button className="button secondary" disabled={busy} onClick={() => attempt(async () => downloadBlob(await classroomService.downloadSubmission(item.id), item.name))}><Download size={16}/> Download {item.studentName}’s file</button><ReviewForm key={`${item.id}-${item.review?.updatedAt || ''}`} submission={item} busy={busy} onReview={review => attempt(async () => { await classroomService.reviewSubmission(item.id, review); await refresh(); onStatus?.('Private feedback saved.'); })}/></article>) : <p>No work submitted yet.</p>}</div>}
  </>}
  {error && <p role="alert" className="error-text">{error}</p>}
 </section>;
}

import React, {useState} from 'react';
import {Blocks, Download, FolderOpen, RotateCcw, Trash2, Upload} from 'lucide-react';
import {downloadBlob} from './storage';
import './project-library.css';

const fileName = name => `${name.replace(/[^\w\- ]/g, '').trim() || 'DUETBlox project'}.duet`;

export default function ProjectLibrary({projects, recoveries, onOpen, onImport, onCreate, onSaveCopy, onDelete, busy}) {
  const [tab, setTab] = useState('saved');
  const saved = projects.filter(project => !project.deletedAt);
  const trash = projects.filter(project => project.deletedAt);
  const records = tab === 'recovery' ? recoveries : tab === 'trash' ? trash : saved;
  const bytes = [...projects, ...recoveries].reduce((total, project) => total + (project.blob?.size || 0), 0);
  return <div className="projects-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR IDEAS, ALL TOGETHER</div><h1>My projects</h1><p>Save updates your project. Save a copy keeps a separate version.</p></div><div className="project-library-actions"><button className="button secondary" disabled={busy} onClick={onImport}><Upload size={16}/> Open a project</button><button className="button primary" disabled={busy} onClick={onSaveCopy}>Save a copy</button></div></div>
    <div className="project-library-tabs" role="tablist" aria-label="Project library">
      {[['saved', `Saved projects (${saved.length})`], ['recovery', `Recovery copies (${recoveries.length})`], ['trash', `Trash (${trash.length})`]].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} aria-controls="project-library-panel" id={`library-${id}`} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <p className="project-library-storage">{(bytes / 1024 / 1024).toFixed(1)} MB of project copies in this browser. Nothing is automatically deleted. Download important work before clearing browser data.</p>
    {tab === 'recovery' && <p className="project-library-notice">Before another project opens, a complete copy of your current programs, datasets and models is saved here. Restoring a copy also protects the workspace you are leaving.</p>}
    {tab === 'trash' && <p className="project-library-notice">Removed projects stay here until you restore them. Their downloaded files are unchanged.</p>}
    <div id="project-library-panel" role="tabpanel" aria-labelledby={`library-${tab}`}>
      {records.length ? <div className="project-grid">{records.map(project => <article className="project-card" key={project.id}><div className="project-art"><Blocks size={48}/></div><h3>{project.name}</h3><p>{new Date(project.updatedAt).toLocaleString()}</p><div className="project-library-actions">
        {tab === 'trash' ? <button className="button secondary" disabled={busy} onClick={() => onDelete(project.id, false)}><RotateCcw size={16}/> Restore project</button> : <button className="button secondary" disabled={busy} onClick={() => onOpen(project.blob, 'project.duet', tab === 'saved' ? project.id : undefined)}>{tab === 'recovery' ? 'Restore copy' : 'Open project'}</button>}
        <button className="button ghost" onClick={() => downloadBlob(project.blob, fileName(project.name))}><Download size={16}/> Download</button>
        {tab === 'saved' && <button className="button ghost" disabled={busy} aria-label={`Move ${project.name} to trash`} onClick={() => onDelete(project.id, true)}><Trash2 size={16}/> Move to trash</button>}
      </div></article>)}</div> : <div className="empty-projects"><FolderOpen size={45}/><h2>{tab === 'saved' ? 'Your next idea starts here.' : tab === 'recovery' ? 'Your recovery copies will appear here.' : 'Trash is empty.'}</h2><p>{tab === 'saved' ? 'Save your first project to keep it in this space.' : tab === 'recovery' ? 'Open another project and your current work will be protected automatically.' : 'Moving a project to trash is reversible.'}</p>{tab === 'saved' && <button className="button primary" onClick={onCreate}>Create with Blocks</button>}</div>}
    </div>
  </div>;
}

import React, {useEffect, useId, useRef, useState, useSyncExternalStore} from 'react';
import {ArrowLeft, ArrowRight, Blocks, BookOpen, Check, ChevronDown, Cpu, Download, Image, MessageCircle, Shapes, X} from 'lucide-react';
import {downloadBlob} from '../storage.js';
import {LESSONS, lessonById, translate} from './lessons.js';
import {createProgressStore, lessonProgress, PROGRESS_KEY} from './progress.js';
import {starterFile} from './examples.js';
import './learn.css';

let storage;
try { storage = globalThis.localStorage; } catch { /* A restricted browser still gets in-memory guidance. */ }
const store = createProgressStore(storage);
const icons = {Shapes, Blocks, Image, MessageCircle, Cpu};
const pageLabels = {junior: 'Junior Blocks', blocks: 'Blocks', ml: 'ML Studio', boards: 'Boards & robots'};
const useProgress = () => useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
const send = action => store.dispatch(action);
const copy = (locale, en, hi) => locale === 'hi' ? hi : en;

function useStorageSync() {
  useEffect(() => {
    const changed = event => {if (event.storageArea === storage && (event.key === PROGRESS_KEY || event.key === null)) store.refresh(event.key === null ? null : event.newValue);};
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
}

function LanguagePicker({locale}) {
  return <div className="learn-languages" role="group" aria-label="Lesson language">
    <button lang="en" aria-pressed={locale === 'en'} onClick={() => send({type: 'locale', locale: 'en'})}>English</button>
    <button lang="hi" aria-pressed={locale === 'hi'} onClick={() => send({type: 'locale', locale: 'hi'})}>हिन्दी</button>
  </div>;
}

function LessonStep({lesson, progress, locale, onNavigate, compact = false}) {
  const id = useId(), heading = useRef(null), [notice, setNotice] = useState('');
  const status = lessonProgress(progress, lesson.id), current = lesson.steps[status.index];
  const checked = progress.completed[lesson.id]?.includes(current.id) || false;
  const move = index => {send({type: 'step', lessonId: lesson.id, index}); requestAnimationFrame(() => heading.current?.focus());};
  const open = async () => {
    try {setNotice(''); send({type: 'start', lessonId: lesson.id}); await onNavigate(lesson.target);}
    catch (error) {setNotice(error.message || copy(locale, 'Could not open this activity.', 'यह activity नहीं खुल सकी।'));}
  };
  return <section className="learn-step" aria-labelledby={`${id}-title`}>
    <div className="learn-step-number">{copy(locale, `Step ${status.index + 1} of ${status.total}`, `चरण ${status.index + 1} / ${status.total}`)}
      <span>{copy(locale, `${status.completed} checked`, `${status.completed} जाँचे`)}</span>
    </div>
    <h3 id={`${id}-title`} tabIndex={-1} ref={heading}>{translate(current.title, locale)}</h3>
    <p>{translate(current.body, locale)}</p>
    {current.hint && <details className="learn-hint" key={`${lesson.id}-${current.id}`}><summary>{copy(locale, 'A helpful hint', 'एक उपयोगी संकेत')}</summary><p>{translate(current.hint, locale)}</p></details>}
    <label className="learn-check"><input type="checkbox" checked={checked} onChange={event => send({type: 'check', lessonId: lesson.id, stepId: current.id, checked: event.target.checked})}/><span>{translate(current.check, locale)}</span></label>
    <div className="learn-step-controls"><button className="button secondary" disabled={status.index === 0} onClick={() => move(status.index - 1)}><ArrowLeft size={16}/>{copy(locale, 'Back', 'पीछे')}</button>
      {status.index < status.total - 1 ? <button className="button secondary" onClick={() => move(status.index + 1)}>{copy(locale, 'Next step', 'अगला चरण')}<ArrowRight size={16}/></button> : <span className="learn-final-step">{status.finished ? copy(locale, 'All steps checked', 'सभी चरण जाँचे गए') : copy(locale, 'Last step · check your work', 'आखिरी चरण · अपना काम जाँचें')}</span>}
    </div>
    {!compact && <button className="button primary learn-open" onClick={open}>{copy(locale, `Open ${pageLabels[lesson.target]}`, `${pageLabels[lesson.target]} खोलें`)}<ArrowRight size={17}/></button>}
    {notice && <p className="learn-notice" role="status">{notice}</p>}
  </section>;
}

export default function LearnCenter({onNavigate}) {
  useStorageSync();
  const {progress, storageError} = useProgress(), {locale} = progress;
  const lesson = lessonById(progress.selected) || LESSONS[0], status = lessonProgress(progress, lesson.id);
  const [resetting, setResetting] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {setResetting(false); setNotice('');}, [lesson.id]);
  const download = () => {
    try {
      const file = starterFile(lesson.starter);
      downloadBlob(new Blob([JSON.stringify(file.data, null, 2)], {type: 'application/json'}), file.name);
      setNotice(copy(locale, 'Starter downloaded. Open it yourself when you are ready; your current project has not changed.', 'Starter डाउनलोड हुआ। तैयार होने पर खुद खोलें; आपका मौजूदा project नहीं बदला है।'));
    } catch (error) {setNotice(error.message);}
  };
  return <div className="learn-center" lang={locale}>
    <header className="learn-header"><div><div className="eyebrow">{copy(locale, 'SMALL STEPS. REAL CREATIONS.', 'छोटे कदम। अपनी रचनाएँ।')}</div><h1>{copy(locale, 'Learn by making', 'बनाते हुए सीखें')}</h1><p>{copy(locale, 'Choose one small project. Try it, change it, and tell us what you noticed.', 'एक छोटा project चुनें। बनाएँ, बदलें और देखें कि क्या हुआ।')}</p></div><LanguagePicker locale={locale}/></header>
    <p className="learn-local-note"><BookOpen size={18}/>{copy(locale, 'Lessons and starter files are built in. Checkboxes are your own progress, not an automatic assessment. Progress stays in this browser.', 'Lessons और starter files app में ही हैं। Checkboxes आपकी अपनी प्रगति हैं, automatic assessment नहीं। प्रगति इसी browser में रहती है।')}</p>
    {storageError && <p className="learn-notice" role="status">{copy(locale, 'Progress is available for this visit, but this browser could not save it. Projects are managed separately.', 'इस बार की प्रगति दिख रही है, लेकिन browser उसे save नहीं कर सका। Projects अलग से सँभाले जाते हैं।')}</p>}
    <div className="learn-layout">
      <nav className="learn-lessons" aria-label={copy(locale, 'Choose a lesson', 'Lesson चुनें')}>{LESSONS.map(item => {
        const Icon = icons[item.icon], itemStatus = lessonProgress(progress, item.id);
        return <button key={item.id} className={`learn-lesson ${item.id === lesson.id ? 'selected' : ''}`} aria-current={item.id === lesson.id ? 'step' : undefined} onClick={() => send({type: 'select', lessonId: item.id})}>
          <span className={`learn-icon ${item.tone}`}><Icon size={23}/></span><span className="learn-lesson-copy"><strong>{translate(item.title, locale)}</strong><span>{translate(item.summary, locale)}</span><small>{copy(locale, `About ${item.minutes} min · ${itemStatus.completed}/${itemStatus.total} checked`, `लगभग ${item.minutes} मिनट · ${itemStatus.completed}/${itemStatus.total} जाँचे`)}</small></span>{itemStatus.finished && <Check className="learn-complete" size={18} aria-label={copy(locale, 'All steps checked', 'सभी चरण जाँचे')}/>}</button>;
      })}</nav>
      <article className="learn-detail" aria-label={translate(lesson.title, locale)}>
        <div className="learn-detail-heading"><span className={`learn-icon ${lesson.tone}`}>{React.createElement(icons[lesson.icon], {size: 25})}</span><div><h2>{translate(lesson.title, locale)}</h2><p>{translate(lesson.needs, locale)}</p></div></div>
        <ol className="learn-step-list" aria-label={copy(locale, 'Lesson steps', 'Lesson के चरण')}>{lesson.steps.map((item, index) => <li key={item.id}><button aria-current={status.index === index ? 'step' : undefined} onClick={() => send({type: 'step', lessonId: lesson.id, index})}><span>{progress.completed[lesson.id]?.includes(item.id) ? <Check size={13}/> : index + 1}</span>{translate(item.title, locale)}</button></li>)}</ol>
        <LessonStep key={lesson.id} lesson={lesson} progress={progress} locale={locale} onNavigate={onNavigate}/>
        {lesson.starter && <div className="learn-starter"><button className="text-button" onClick={download}><Download size={16}/>{copy(locale, 'Download starter file', 'Starter फ़ाइल डाउनलोड करें')}</button><p>{copy(locale, lesson.starter === 'junior' ? 'Open in Junior Blocks → Open story. Save your current story first.' : 'Open in Text learning → Open dataset. Save your current examples first.', lesson.starter === 'junior' ? 'Junior Blocks → Open story से खोलें। पहले मौजूदा कहानी सेव करें।' : 'Text learning → Open dataset से खोलें। पहले मौजूदा examples सेव करें।')}</p></div>}
        {notice && <p className="learn-notice" role="status">{notice}</p>}
        <div className="learn-reset">{resetting ? <><p>{copy(locale, 'Reset the checkmarks and step position for this lesson? Your projects and models stay as they are.', 'इस lesson के checkmarks और चरण की स्थिति reset करें? आपके projects और models वैसे ही रहेंगे।')}</p><button className="small-button" onClick={() => {send({type: 'reset', lessonId: lesson.id}); setResetting(false);}}>{copy(locale, 'Reset this progress', 'यह प्रगति reset करें')}</button><button className="text-button" onClick={() => setResetting(false)}>{copy(locale, 'Keep progress', 'प्रगति रखें')}</button></> : <button className="text-button" onClick={() => setResetting(true)}>{copy(locale, 'Reset this lesson’s progress', 'इस lesson की प्रगति reset करें')}</button>}</div>
      </article>
    </div>
  </div>;
}

// Render once as a sibling of the app's main content. CSS reserves a full-width
// dock above the activity; it must never float over stage or hardware controls.
// Students can collapse it or pause the guide without losing their place.
export function LessonCompanion({page, onNavigate, onOpenLearn}) {
  useStorageSync();
  const {progress} = useProgress(), lesson = lessonById(progress.active), {locale} = progress;
  const [expanded, setExpanded] = useState(true), id = useId();
  useEffect(() => setExpanded(true), [progress.active]);
  if (!lesson || page === 'learn') return null;
  return <aside className={`lesson-companion ${expanded ? 'expanded' : ''}`} lang={locale} aria-label={copy(locale, 'Lesson guide', 'Lesson guide')}>
    <div className="lesson-companion-bar"><button className="lesson-companion-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}><BookOpen size={18}/><span>{translate(lesson.title, locale)}</span><ChevronDown size={16}/></button><button className="lesson-companion-close" aria-label={copy(locale, 'Pause lesson guide', 'Lesson guide रोकें')} title={copy(locale, 'Pause guide; keep progress', 'Guide रोकें; प्रगति रखें')} onClick={() => send({type: 'pause'})}><X size={17}/></button></div>
    <div id={id} hidden={!expanded} className="lesson-companion-body"><LessonStep lesson={lesson} progress={progress} locale={locale} onNavigate={onNavigate} compact/>
      <div className="lesson-companion-links"><button className="text-button" onClick={onOpenLearn}>{copy(locale, 'All lessons', 'सभी lessons')}</button>{page !== lesson.target && <button className="text-button" onClick={() => onNavigate(lesson.target)}>{pageLabels[lesson.target]}<ArrowRight size={14}/></button>}</div>
    </div>
  </aside>;
}

import React from 'react';
import {BookOpen, Cpu, Shapes} from 'lucide-react';
import './student-start.css';

export default function StudentStart({onStartStory, onLearn, onCircuits, busy}) {
  return <section className="student-start" aria-labelledby="student-start-title">
    <div className="student-start-heading"><div><span className="eyebrow">START SMALL</span><h2 id="student-start-title">Your first creation, one step at a time</h2></div><p>No account, camera or board needed.</p></div>
    <div className="student-activities">
      <article><Shapes aria-hidden="true"/><span className="activity-time">About 5 minutes</span><h3>Make a character tell a story</h3><p>Move, say hello, then change one block. A guide stays beside your work.</p><button className="button primary" disabled={busy} onClick={onStartStory}>Start my first story</button><small>Your current workspace gets a recovery copy first.</small></article>
      <article><BookOpen aria-hidden="true"/><span className="activity-time">Go at your pace</span><h3>Build with a little guidance</h3><p>Choose a small project in Blocks, Junior, AI or Python. Try, change and explore.</p><button className="button secondary" disabled={busy} onClick={onLearn}>Choose a guided lesson</button><small>English, Hindi and Hinglish explanations.</small></article>
      <article><Cpu aria-hidden="true"/><span className="activity-time">No board needed</span><h3>Try a virtual circuit</h3><p>Connect an LED, a button or a sensor. See what your code does on screen.</p><button className="button secondary" disabled={busy} onClick={onCircuits}>Open Circuit Lab</button><small>Opens your circuit without replacing it.</small></article>
    </div>
  </section>;
}

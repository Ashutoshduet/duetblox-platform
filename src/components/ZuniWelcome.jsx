import React, {useId} from 'react';
import {ArrowRight} from 'lucide-react';
import {ZUNI_ART} from '../characters/zuni.js';
import './zuni-welcome.css';

const zuniImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ZUNI_ART)}`;

export default function ZuniWelcome({onStart, busy = false}) {
  const headingId = useId();
  const noticeId = useId();
  return <section className="zuni-welcome" aria-labelledby={headingId} aria-busy={busy}>
    <div className="zuni-welcome-art">
      <span className="zuni-welcome-orbit" aria-hidden="true"/>
      <span className="zuni-welcome-block zuni-welcome-block-mint" aria-hidden="true"/>
      <span className="zuni-welcome-block zuni-welcome-block-peach" aria-hidden="true"/>
      <img src={zuniImage} width="120" height="120" alt="Zuni waving hello" draggable="false"/>
    </div>
    <div className="zuni-welcome-copy">
      <span className="zuni-welcome-eyebrow">YOUR CODING FRIEND</span>
      <h2 id={headingId}>Hi, I’m Zuni!</h2>
      <p>Let’s make something together.</p>
    </div>
    <div className="zuni-welcome-action">
      <button type="button" className="zuni-welcome-start" onClick={onStart} disabled={busy} aria-describedby={noticeId}>
        <span>Create with Zuni</span><ArrowRight size={18} aria-hidden="true"/>
      </button>
      <p className="zuni-welcome-notice" id={noticeId}>Your current work gets a recovery copy.</p>
    </div>
  </section>;
}

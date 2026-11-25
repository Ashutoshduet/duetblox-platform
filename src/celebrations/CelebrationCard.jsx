import React, {useId} from 'react';
import {RotateCcw, X} from 'lucide-react';
import Mascot from './Mascot.jsx';
import './celebrations.css';

/** A non-modal companion: callers own timing, sound, persistence and success checks. */
export default function CelebrationCard({event, mascot = 'zuni', palette = 'lilac', motionReduced = false, playing = false, playKey = 0, onReplay, onSkip}) {
  const headingId = useId();
  const name = {zuni: 'Zuni', duvi: 'Duvi', tiko: 'Tiko'}[mascot] || 'Zuni';
  if (!event) return null;
  return <section className="celebration-card" aria-label="Mascot celebration" data-playing={playing && !motionReduced ? 'true' : 'false'} data-testid="mascot-celebration">
    <div className="celebration-portrait">
      <Mascot key={`${event.id}:${playKey}`} mascot={mascot} palette={palette} dance={event.dance} playing={playing} motionReduced={motionReduced}/>
    </div>
    <div className="celebration-copy" role="status" aria-live="polite" aria-atomic="true">
      <span className="celebration-eyebrow">{name} celebrates with you</span>
      <h3 id={headingId}>{event.title}</h3>
      <p>{event.message}</p>
    </div>
    <div className="celebration-actions">
      <button type="button" onClick={onReplay} aria-label="Replay celebration"><RotateCcw size={15} aria-hidden="true"/>Replay</button>
      <button type="button" onClick={onSkip} aria-label="Skip celebration"><X size={15} aria-hidden="true"/>{playing ? 'Skip' : 'Done'}</button>
    </div>
  </section>;
}

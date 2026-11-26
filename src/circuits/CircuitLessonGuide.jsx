import React, {useEffect, useMemo, useState} from 'react';
import {BookOpen, Check, Play, ChevronDown} from 'lucide-react';
import {CIRCUIT_LESSONS, getCircuitLesson, inspectLessonWiring, measureLesson} from './lessons.js';
import {analogPort} from './model.js';

export default function CircuitLessonGuide({service, state, selected, onSelect, onLoad, onStartLesson, onEnable, disabled, onChangeParam, attempt, onShowWorkbench}) {
  const [observed, setObserved] = useState([]);
  const lesson = useMemo(() => getCircuitLesson(selected, state.boardId), [selected, state.boardId]);
  const topology = JSON.stringify({board: state.boardId, lesson: selected, parts: state.circuit.components.map(({id, type}) => ({id, type})), wires: state.circuit.wires});
  const [evidenceTopology, setEvidenceTopology] = useState(topology);
  const measurements = measureLesson(lesson, state.circuit, state);
  const measurementKey = measurements.join(',');
  useEffect(() => {
    setObserved(previous => {
      const next = [...new Set([...(evidenceTopology === topology ? previous : []), ...measurements])];
      return next.join(',') === previous.join(',') ? previous : next;
    });
    setEvidenceTopology(topology);
  }, [topology, measurementKey]);
  const evidence = evidenceTopology === topology ? observed : [];
  const wiring = inspectLessonWiring(lesson, state.circuit, state.circuitResult);
  const ready = wiring.length > 0 && wiring.every(wire => wire.connected);
  const available = CIRCUIT_LESSONS.filter(item => getCircuitLesson(item.id, state.boardId));
  const button = state.circuit.components.find(part => part.id === 'button1' && part.type === 'button');
  const pot = state.circuit.components.find(part => part.id === 'pot1' && part.type === 'potentiometer');
  const adc = lesson && state.circuitResult?.pins?.[analogPort(lesson.analog)];
  const digital = lesson && state.circuitResult?.pins?.[`D${lesson.input}`];
  const led = state.circuitResult?.components?.led1;
  const reading = !state.enabled ? 'Simulation is off.' : !state.circuitResult?.safe ? 'Fix the circuit errors to interpret these readings.'
    : lesson?.id === 'button' ? `Input D${lesson.input}: ${digital?.digital === 1 ? 'HIGH' : digital?.digital === 0 ? 'LOW' : 'floating or undefined'}`
      : lesson?.id === 'pot' ? `ADC: ${adc?.analog ?? 'floating'} / ${lesson.board.analogMax} · ${Number.isFinite(adc?.voltage) ? `${adc.voltage.toFixed(2)} V` : 'no voltage reference'}`
        : `LED: ${led?.lit ? 'ON' : 'OFF'} · ${((led?.current || 0) * 1000).toFixed(1)} mA${lesson?.id === 'sensor' ? ` · ADC ${adc?.analog ?? 'floating'} / ${lesson.board.analogMax}` : ''}`;
  return <details className="circuit-lesson" open>
    <summary><BookOpen size={19}/> Learn with a circuit <span>Wire → predict → test → code</span><ChevronDown className="circuit-guide-chevron" size={18}/></summary>
    <div className="circuit-lesson-body">
      <label>Choose a circuit lesson<select aria-label="Circuit lesson" value={lesson?.id || ''} disabled={disabled} onChange={event => onSelect(event.target.value)}>{!lesson && <option value="">Choose a lesson</option>}{available.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      {lesson ? <>
        <div className="circuit-lesson-intro"><div><h3>{lesson.title}</h3><p>{lesson.goal}</p><p>{lesson.explanation}</p></div><div className="circuit-lesson-actions"><button disabled={disabled} onClick={onLoad}>Load lesson wiring</button><button disabled={disabled} onClick={() => onLoad({unwired:true})}>Build the wiring myself</button><small>Your previous circuit is saved before replacement. Restore it below or use Undo.</small>{onShowWorkbench && <button onClick={onShowWorkbench}>Jump to workbench</button>}{onStartLesson && lesson.codeKind && <button className="circuit-primary" disabled={disabled} onClick={() => attempt(() => onStartLesson({id:`circuit-${lesson.id}`, kind:lesson.codeKind, circuit:lesson.expected}))}><Play size={16}/> Open wired block lesson</button>}{onStartLesson && lesson.codeKind && <small>The complete workspace gets a recovery copy before the block lesson opens.</small>}</div></div>
        <div className="circuit-lesson-grid"><section aria-label="Lesson wiring checklist"><h4>1. Follow the connections</h4><ul>{wiring.map(wire => <li key={wire.id} className={wire.connected ? 'complete' : ''}><span aria-label={wire.connected ? 'Connected' : 'Not connected'}>{wire.connected ? <Check size={16}/> : '○'}</span><code>{wire.from} → {wire.to}</code></li>)}</ul>{!ready && <p>Load the lesson wiring, or choose “Build the wiring myself” to start with the parts only. Equivalent breadboard connections count.</p>}</section>
        <section aria-label="Lesson experiment"><h4>2. Predict, then test</h4><p>Say what you expect before changing a signal. These checks record observed signals during this visit.</p>{!state.enabled ? <button disabled={disabled || !onEnable} onClick={() => attempt(onEnable)}>Enable lesson simulation</button> : <div className="circuit-button-row">{lesson.id === 'led' && <><button disabled={disabled || !ready} onClick={() => attempt(() => service.digitalWrite(lesson.output, 1))}>Try HIGH</button><button disabled={disabled || !ready} onClick={() => attempt(() => service.digitalWrite(lesson.output, 0))}>Try LOW</button></>}{lesson.id === 'button' && <><button disabled={disabled || !ready} onClick={() => attempt(() => service.setPinMode(lesson.input, 'INPUT_PULLUP'))}>Set INPUT_PULLUP</button><button disabled={disabled || !ready || !button} onClick={() => onChangeParam('button1', 'pressed', !button.params.pressed)}>{button?.params.pressed ? 'Release lesson button' : 'Press lesson button'}</button></>}{['pot', 'sensor'].includes(lesson.id) && <label>Turn the lesson knob<input aria-label="Lesson potentiometer position" type="range" min="0" max="100" disabled={disabled || !ready || !pot} value={(pot?.params.position ?? .5) * 100} onChange={event => onChangeParam('pot1', 'position', Number(event.target.value) / 100)}/></label>}</div>}<output className="circuit-lesson-reading" aria-live="polite">{reading}</output><ul className="circuit-observations" aria-live="polite">{lesson.requirements.map(item => <li key={item.id} className={evidence.includes(item.id) ? 'complete' : ''}>{evidence.includes(item.id) ? <Check size={16} aria-label="Observed"/> : <span aria-label="Not yet observed">○</span>}{item.label}</li>)}</ul>{lesson.id === 'sensor' && <p>Open the wired block lesson to run the threshold decision. Moving the knob alone does not run code.</p>}{!state.circuitResult?.safe && <p className="circuit-lesson-warning">Fix the circuit errors before counting observations.</p>}</section></div>
        <details className="circuit-lesson-code"><summary>3. Connect the idea to code</summary><p>Arduino-style fragments for discussion: put pinMode in setup and repeated reads/writes in loop. The button above opens the matching runnable Blocks lesson when available.</p><pre>{lesson.program}</pre><p>Change one value, predict its effect, then test again. Explain what changed before moving on.</p></details>
      </> : <p>This circuit has no guided lesson on the selected board. Choose an available lesson above; your current circuit stays unchanged until you load one.</p>}
    </div>
  </details>;
}

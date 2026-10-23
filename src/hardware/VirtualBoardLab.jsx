import React, {useEffect, useState} from 'react';
import {Cpu, RotateCcw, Square, X} from 'lucide-react';
import {getBoard} from './boards.js';
import './virtual-board.css';

const outputLabel = pin => pin.kind === 'digital' ? `${pin.value ? 'HIGH' : 'LOW'} (${pin.value})`
  : pin.kind === 'pwm' ? `${pin.value} / 255 · ${Math.round(pin.value / 255 * 100)}%`
  : pin.kind === 'servo' ? `${pin.value}°` : `${pin.value} Hz`;

/** Parent owns mode switching and stops the Scratch VM before stop/reset/disable. */
export default function VirtualBoardLab({service, onStop, onReset, onDisable}) {
  const [state, setState] = useState(() => service.getState());
  const [digitalPin, setDigitalPin] = useState(''), [analogPin, setAnalogPin] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => service.subscribe(setState), [service]);
  const board = getBoard(state.boardId);
  useEffect(() => {
    setDigitalPin(String(board.digitalPins[0])); setAnalogPin(board.analogPins[0] || ''); setError('');
  }, [board.id]);
  if (!state.enabled) return null;
  const selectedDigital = state.pins.find(pin => String(pin.pin) === digitalPin);
  const selectedAnalog = Object.hasOwn(state.analogInputs, analogPin) ? state.analogInputs[analogPin] : 0;
  const outputs = state.pins.filter(pin => pin.kind);
  const act = async callback => {
    if (busy) return;
    setBusy(true); setError('');
    try { await callback(); } catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };
  const input = callback => { try { callback(); setError(''); } catch (e) { setError(e.message || String(e)); } };
  return <section className="virtual-board-lab" aria-label="Virtual Board Lab">
    <div className="virtual-board-heading">
      <div><h2><Cpu size={18}/> Virtual Board Lab <span className="virtual-badge">SIMULATION</span></h2><p>{board.name} · browser only · no USB connection</p></div>
      <div className="virtual-actions">
        <button disabled={busy} onClick={() => act(onStop || (() => service.stop()))}><Square size={14}/> Stop outputs</button>
        <button disabled={busy} onClick={() => act(onReset || (() => service.reset()))}><RotateCcw size={14}/> Reset lab</button>
        <button disabled={busy} aria-label="Close Virtual Board Lab" onClick={() => act(onDisable || (() => service.disable()))}><X size={17}/></button>
      </div>
    </div>
    <p className="virtual-board-scope">Run your blocks with the green flag. Set simulated inputs here and watch the output commands. This checks live Scratch logic, not a circuit or uploaded firmware. PWM, servo and tone are displayed; their waveforms and sound are not generated.</p>
    {error && <p className="virtual-error" role="alert">{error}</p>}
    <div className="virtual-lab-columns">
      <fieldset className="virtual-inputs"><legend>Simulated inputs</legend>
        <div className="virtual-input-row">
          <label>Digital pin<select aria-label="Virtual digital input pin" value={digitalPin} onChange={event => setDigitalPin(event.target.value)}>{board.digitalPins.map(pin => <option key={pin} value={pin}>{pin}</option>)}</select></label>
          <label>Input level<select aria-label="Virtual digital input level" value={selectedDigital?.input ?? 'default'} onChange={event => input(() => service.setDigitalInput(digitalPin, event.target.value === 'default' ? null : Number(event.target.value)))}><option value="default">Default</option><option value="0">LOW · 0</option><option value="1">HIGH · 1</option></select></label>
        </div>
        <small>Use an input pin in your blocks. Default reads LOW, or HIGH for INPUT_PULLUP. Pin {digitalPin} is currently {selectedDigital?.mode || 'INPUT'}{selectedDigital?.kind ? ` (${selectedDigital.kind})` : ''}.</small>
        {board.analogPins.length ? <div className="virtual-analog-input">
          <div className="virtual-input-row"><label>Analog pin<select aria-label="Virtual analog input pin" value={analogPin} onChange={event => setAnalogPin(event.target.value)}>{board.analogPins.map(pin => <option key={pin} value={pin}>{pin}</option>)}</select></label><output aria-label="Virtual analog value">{selectedAnalog} / {board.analogMax}</output></div>
          <input type="range" aria-label="Virtual analog input value" min="0" max={board.analogMax} step="1" value={selectedAnalog} onChange={event => input(() => service.setAnalogInput(analogPin, Number(event.target.value)))}/>
          <small>Drag the slider to set the value returned by “read analog pin”. It is independent of digital inputs.</small>
        </div> : <p className="virtual-input-note">This ESP32-CAM profile has no exposed analog input. Camera and SD simulation are not implemented.</p>}
      </fieldset>
      <div className="virtual-outputs"><h3>Output commands <span>{outputs.length}</span></h3>
        {!outputs.length ? <p className="virtual-empty">No outputs yet. Try a “set digital pin” block and run it with the green flag.</p> : <ul>{outputs.map(pin => <li key={pin.pin} className={`virtual-pin virtual-pin-${pin.kind}`}>
          <div><strong>Pin {pin.pin}</strong><span>{pin.kind === 'digital' ? 'GPIO' : pin.kind.toUpperCase()}</span></div>
          <output><i className={pin.kind === 'digital' ? `virtual-led ${pin.value ? 'on' : ''}` : 'virtual-output-dot'} aria-hidden="true"/>{outputLabel(pin)}</output>
          {pin.kind === 'pwm' && <progress aria-label={`Pin ${pin.pin} PWM level`} max="255" value={pin.value}/>}
          {pin.kind === 'servo' && <div className="virtual-servo"><span aria-hidden="true" style={{transform: `rotate(${pin.value - 90}deg)`}}/><small>Position command</small></div>}
          {pin.kind === 'tone' && <small>{pin.durationSeconds ? `${pin.durationSeconds} s duration` : 'Until stopped'} · visual only</small>}
        </li>)}</ul>}
      </div>
    </div>
    <div className="virtual-status"><span>{state.lastAction}</span><small>{state.commandCount} commands</small></div>
    <details className="virtual-limits"><summary>What this lab can check</summary><p>Digital I/O, chosen analog readings, PWM values, servo angles and one tone command at a time for the five implemented board profiles. Board pin restrictions, four servo slots, eight ESP32 PWM slots and AVR timer reservations are checked. Stop keeps your simulated inputs; Reset clears inputs and reservations.</p><p>It cannot verify wiring, voltage, timing accuracy, sensors, camera capture, compiled code or a real board. Digital waveform reads while PWM, servo or tone is active are deliberately unavailable. Test the final program with your hardware.</p>{board.id === 'esp32-cam' && <p>GPIO 4, 13 and 14 only. On a real AI Thinker board these pins share the SD socket; GPIO 4 also drives the flash LED.</p>}</details>
  </section>;
}

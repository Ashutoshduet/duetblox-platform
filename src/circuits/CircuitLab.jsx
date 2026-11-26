import React, {useEffect, useRef, useState} from 'react';
import {Plus, Trash2, Undo2, Redo2, Download, Upload, Cable, Play, MousePointer2} from 'lucide-react';
import {boardRegistry, requireBoard} from '../hardware/boards.js';
import {COMPONENT_TYPES, CIRCUIT_LIMITS, STARTER_CIRCUITS, boardTerminals, createComponent, createStarterCircuit, validateCircuit} from './model.js';
import {downloadBlob, readRecord, writeRecord} from '../storage.js';
import UnoFirmwarePanel from './UnoFirmwarePanel.jsx';
import {circuitToSpiceNetlist} from './spice-export.js';
import {getCircuitHistory} from './history.js';
import CircuitNumberField from './CircuitNumberField.jsx';
import CircuitLessonGuide from './CircuitLessonGuide.jsx';
import {DIAGNOSTIC_HELP} from './lessons.js';
import {circuitRecoveryKey, readCircuitRecovery, replaceCircuitSafely} from './recovery.js';
import './circuits.css';

const uuid = prefix => `${prefix}${globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 16) || Math.random().toString(36).slice(2)}`;
const voltageText = value => value === null || value === undefined ? 'floating' : `${value.toFixed(2)} V`;
const boardGeometry = boardId => {
  const pins = boardTerminals(boardId), rows = Math.ceil(pins.length / 2), spacing = Math.min(21, 710 / Math.max(1, rows - 1)), height = Math.max(430, (rows - 1) * spacing + 100);
  return {height, ports: Object.fromEntries(pins.map((pin, index) => [pin, {x: index < rows ? 38 : 255, y: 140 + (index % rows) * spacing}]))};
};
function componentGeometry(component) {
  if (component.type === 'breadboard') return {width: 200, height: 280, ports: Object.fromEntries(COMPONENT_TYPES.breadboard.terminals.map(pin => {
    if (pin[0] === '+' || pin[0] === '-') return [pin, {x: 30 + (Number(pin.slice(1)) - 1) * 45, y: pin[0] === '+' ? 34 : 260}];
    const col = 'abcdefghij'.indexOf(pin[0]); return [pin, {x: 18 + col * 16 + (col >= 5 ? 10 : 0), y: 64 + (Number(pin.slice(1)) - 1) * 19}];
  }))};
  const terminals = COMPONENT_TYPES[component.type].terminals;
  return {width: 180, height: 110, ports: Object.fromEntries(terminals.map((pin, i) => [pin, {x: terminals.length === 2 ? (i ? 180 : 0) : i * 90, y: terminals.length === 2 ? 65 : 110}]))};
}
export default function CircuitLab({service, disabled: externallyDisabled = false, busy = false, boardLocked = false, onStatus, onUseBlocks, onEnable, onBoardChange, onStartLesson}) {
  const [state, setState] = useState(() => service.getState()), [selected, setSelected] = useState(null), [pending, setPending] = useState(null), [error, setError] = useState('');
  const [starter, setStarter] = useState('led'), [partType, setPartType] = useState('resistor'), [testPin, setTestPin] = useState(13), [pwm, setPwm] = useState(128), [angle, setAngle] = useState(90);
  const [drag, setDrag] = useState(null), [historyVersion, setHistoryVersion] = useState(0);
  const [firmwareState, setFirmwareState] = useState(null), [zoom, setZoom] = useState(0.9);
  const [starterBusy, setStarterBusy] = useState(false), [recovery, setRecovery] = useState(null);
  const disabled = externallyDisabled || busy || starterBusy;
  const externalLock = useRef(false); externalLock.current = externallyDisabled || busy;
  const history = getCircuitHistory(service), svg = useRef(null), canvasWrapper = useRef(null), guideWrapper = useRef(null), importer = useRef(null), importGeneration = useRef(0), mounted = useRef(false);
  const circuit = state.circuit, result = firmwareState?.circuitResult || state.circuitResult, board = requireBoard(state.boardId), geometry = boardGeometry(state.boardId);
  useEffect(() => {mounted.current=true;const unsubscribe=service.subscribe(setState);return ()=>{mounted.current=false;importGeneration.current++;unsubscribe();};}, [service]);
  useEffect(()=>{importGeneration.current++;},[state.boardId,state.circuitRevision]);
  useEffect(() => {let current = true; readRecord(circuitRecoveryKey(state.boardId)).then(record => {if(current)setRecovery(readCircuitRecovery(record, state.boardId));}).catch(() => {}); return () => {current = false;};}, [state.boardId, state.circuitRevision]);
  useEffect(() => { setSelected(null); setPending(null); setError(''); setDrag(null); setTestPin(board.outputPins.includes(13) ? 13 : board.outputPins[0]); setHistoryVersion(v => v + 1); }, [state.boardId]);
  const attempt = async fn => { setError(''); try { return await fn(); } catch (e) { if(!mounted.current)return;setError(e.message); onStatus?.(e.message); } };
  const showWorkbench = () => {
    // Keep wiring tools and the return-to-guide action visible above the canvas.
    const controls = canvasWrapper.current?.closest('.duet-circuit-lab')?.querySelector('.circuit-toolbar');
    (controls || canvasWrapper.current)?.scrollIntoView({block:'start'});
    canvasWrapper.current?.focus({preventScroll:true});
  };
  const showGuide = () => {guideWrapper.current?.scrollIntoView({block:'start'});guideWrapper.current?.querySelector('summary')?.focus({preventScroll:true});};
  const commit = value => {
    if (disabled) return;
    const normalized = validateCircuit(value, {boardId: state.boardId});
    history.commit(service.getCircuit(), normalized, next => service.setCircuit(next));
    setHistoryVersion(v => v + 1);
  };
  const replace = next => attempt(async () => {
    if (disabled) return;
    const revision = service.circuitRevision, boardId = service.boardId;
    setStarterBusy(true);
    try {
      const previous = await replaceCircuitSafely({service, next, persist: writeRecord,
        isCurrent: () => mounted.current && !externalLock.current && service.boardId === boardId && service.circuitRevision === revision,
        apply: value => history.commit(service.getCircuit(), value, circuit => service.setCircuit(circuit))});
      if (previous) setRecovery(previous);
      setSelected(null); setPending(null); setHistoryVersion(v => v + 1);
      onStatus?.(previous ? 'Circuit loaded. The previous circuit can be restored from the saved circuit backup.' : 'This circuit is already loaded. Your wiring is unchanged.');
      showWorkbench();
    } finally { if(mounted.current)setStarterBusy(false); }
  });
  const loadStarter = (options = {}) => attempt(() => {const next = createStarterCircuit(starter, state.boardId); if(options.unwired)next.wires=[]; return replace(next);});
  const undo = redo => attempt(() => {
    if (disabled || !history.step(service.getCircuit(), redo, next => service.setCircuit(next))) return;
    setSelected(null); setPending(null); setHistoryVersion(v => v + 1);
  });
  const point = endpoint => {
    const [id, terminal] = endpoint.split(':');
    if (id === 'board') return geometry.ports[terminal];
    const part = circuit.components.find(c => c.id === id); if (!part) return {x: 0, y: 0};
    const offset = componentGeometry(part).ports[terminal], position = drag?.id === id ? drag : part;
    return {x: position.x + offset.x, y: position.y + offset.y};
  };
  const connect = endpoint => attempt(() => {
    if (disabled) return;
    if (!pending) { setPending(endpoint); setSelected(null); return; }
    if (pending === endpoint) { setPending(null); return; }
    const next = service.getCircuit(); next.wires.push({id: uuid('wire'), from: pending, to: endpoint}); commit(next); setPending(null);
  });
  const remove = () => attempt(() => {
    if (!selected) return;
    const next = service.getCircuit();
    if (selected.kind === 'wire') next.wires = next.wires.filter(w => w.id !== selected.id);
    else { next.components = next.components.filter(p => p.id !== selected.id); next.wires = next.wires.filter(w => ![w.from, w.to].some(endpoint => endpoint.startsWith(`${selected.id}:`))); }
    commit(next); setSelected(null); setPending(null);
  });
  const add = () => attempt(() => {
    const next = service.getCircuit(); next.components.push(createComponent(partType, uuid(partType), {x: 380 + (next.components.length % 3) * 245, y: 80 + (Math.floor(next.components.length / 3) % 3) * 190})); commit(next); setSelected({kind: 'component', id: next.components.at(-1).id});
  });
  const pointerPosition = event => {
    const box = svg.current.getBoundingClientRect(), aspect = Math.min(box.width / 1400, box.height / 900);
    return {x: (event.clientX - box.left - (box.width - 1400 * aspect) / 2) / aspect, y: (event.clientY - box.top - (box.height - 900 * aspect) / 2) / aspect};
  };
  const move = event => {
    if (!drag || disabled) return;
    const p = pointerPosition(event);
    setDrag({...drag, x: Math.min(CIRCUIT_LIMITS.width - 220, Math.max(300, p.x - drag.dx)), y: Math.min(CIRCUIT_LIMITS.height - 280, Math.max(30, p.y - drag.dy))});
  };
  const finishDrag = () => {
    if (!drag) return;
    const next = service.getCircuit(), part = next.components.find(p => p.id === drag.id);
    if (part && (part.x !== drag.x || part.y !== drag.y)) { part.x = Math.round(drag.x); part.y = Math.round(drag.y); attempt(() => commit(next)); }
    setDrag(null);
  };
  const selectedPart = selected?.kind === 'component' ? circuit.components.find(c => c.id === selected.id) : null;
  const setParam = (id, key, value) => attempt(() => { const next = service.getCircuit(), part = next.components.find(c => c.id === id); if (part) { part.params[key] = value; commit(next); } });
  const port = (endpoint, position, label, anchor = 'middle') => <g key={endpoint} className={`circuit-port ${pending === endpoint ? 'pending' : ''}`} role="button" aria-disabled={disabled} tabIndex={disabled ? -1 : 0} aria-label={`Connect ${endpoint}`} onClick={e => { e.stopPropagation(); connect(endpoint); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); connect(endpoint); } }}>
    <title>{endpoint} · {voltageText(result?.terminalVoltages[endpoint])}</title><circle className="circuit-port-target" cx={position.x} cy={position.y} r="11"/><circle cx={position.x} cy={position.y} r="4.8"/><text x={position.x + (anchor === 'start' ? 13 : anchor === 'end' ? -13 : 0)} y={position.y + (anchor === 'middle' ? -13 : 4)} textAnchor={anchor}>{label}</text>
  </g>;
  return <section className="duet-circuit-lab" aria-label="Wired circuit workbench" aria-busy={disabled} data-history-version={historyVersion} onKeyDown={event => { if (event.key === 'Escape') { setPending(null); setDrag(null); } }}>
    <div className="circuit-lab-heading"><div><span className="circuit-eyebrow">BUILD · CONNECT · EXPERIMENT</span><h2>Make the connection.</h2><p>{board.name} · {board.voltage} V GPIO · wired DC teaching simulation</p></div><div className="circuit-board-choice">{onBoardChange && <label>Board<select aria-label="Circuit board" disabled={disabled||boardLocked} value={state.boardId} onChange={e => attempt(() => onBoardChange(e.target.value))}>{boardRegistry.filter(b => b.live).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}<span className={`circuit-live-badge ${state.enabled ? 'enabled' : ''}`}>{state.enabled ? 'Virtual board active' : 'Editing circuit'}</span></div></div>
    <div ref={guideWrapper}><CircuitLessonGuide onShowWorkbench={showWorkbench} service={service} state={state} selected={starter} onSelect={setStarter} onLoad={loadStarter} onStartLesson={onStartLesson} onEnable={onEnable} disabled={disabled || Boolean(firmwareState?.running)} onChangeParam={setParam} attempt={attempt}/></div>
    <div className="circuit-recovery"><span>{starterBusy ? 'Saving a circuit backup before loading…' : 'Loading a circuit keeps the previous circuit in a browser backup.'}</span>{recovery?.boardId === state.boardId && <button disabled={disabled || Boolean(firmwareState?.running)} onClick={() => replace(recovery)}>Restore previous circuit</button>}</div>
    <div className="circuit-toolbar"><label>Start with <select aria-label="Starter circuit" disabled={disabled} value={starter} onChange={e => setStarter(e.target.value)}>{STARTER_CIRCUITS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button disabled={disabled} onClick={loadStarter}>Load circuit</button><span className="circuit-toolbar-divider"/><label>Add <select aria-label="Component type" disabled={disabled} value={partType} onChange={e => setPartType(e.target.value)}>{Object.entries(COMPONENT_TYPES).map(([type, info]) => <option key={type} value={type}>{info.label}</option>)}</select></label><button disabled={disabled || circuit.components.length >= CIRCUIT_LIMITS.components} onClick={add}><Plus size={15}/> Add part</button><button aria-label="Undo circuit change" title="Undo" disabled={disabled || !history.canUndo(circuit)} onClick={() => undo(false)}><Undo2 size={17}/></button><button aria-label="Redo circuit change" title="Redo" disabled={disabled || !history.canRedo(circuit)} onClick={() => undo(true)}><Redo2 size={17}/></button><button disabled={disabled || !selected} onClick={remove}><Trash2 size={15}/> Delete selected</button></div>
    <div className="circuit-zoom-controls" role="group" aria-label="Circuit canvas zoom"><button aria-label="Zoom out circuit" onClick={()=>setZoom(z=>Math.max(0.5,z-0.15))} disabled={zoom<=0.5}>−</button><output>{Math.round(zoom*100)}%</output><button aria-label="Zoom in circuit" onClick={()=>setZoom(z=>Math.min(1.8,z+0.15))} disabled={zoom>=1.8}>+</button><button onClick={()=>setZoom(Math.max(0.5,Math.min(1.8,(canvasWrapper.current?.clientWidth||1000)/1400)))}>Fit width</button><button onClick={showGuide}>Back to lesson guide</button><span>Scroll the workbench to explore your circuit.</span></div><div className="circuit-instructions"><Cable size={16}/><span>{pending ? `Connecting ${pending} — choose another pin. Escape cancels.` : 'Click one pin, then another to wire them. Drag a component to move it. Select a wire or part to delete.'}</span>{pending && <button onClick={() => setPending(null)}>Cancel wire</button>}</div>
    {error && <p className="circuit-error" role="alert">{error}</p>}
    <div className="circuit-work-area"><div className="circuit-canvas-wrap" ref={canvasWrapper} role="region" aria-label="Circuit workbench" tabIndex={-1}><svg ref={svg} style={{width:1400*zoom,height:900*zoom,minWidth:1400*zoom,minHeight:0,maxHeight:"none"}} className="circuit-canvas" viewBox="0 0 1400 900" aria-label="Circuit canvas" onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={() => setDrag(null)} onClick={() => { setSelected(null); setPending(null); }}>
      <defs><pattern id="duetCircuitGrid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d7e0e6"/></pattern></defs><rect width="1400" height="900" fill="url(#duetCircuitGrid)"/>
      <g className="circuit-controller"><rect x="20" y="75" width="255" height={geometry.height} rx="20"/><rect x="89" y="80" width="115" height="32" rx="7" className="circuit-usb"/><text x="147" y="65" textAnchor="middle">{board.name}</text><text className="circuit-board-mark" transform={`translate(148 ${Math.max(305, geometry.height / 2 + 90)}) rotate(-90)`} textAnchor="middle">DUETBlox</text></g>
      <g className="circuit-wires">{circuit.wires.map(wire => { const a = point(wire.from), b = point(wire.to), mid = (a.x + b.x) / 2; const path = `M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}`; return <g key={wire.id} role="button" aria-disabled={disabled} tabIndex={disabled ? -1 : 0} aria-label={`Wire ${wire.from} to ${wire.to}`} className={selected?.id === wire.id ? 'selected' : ''} onClick={e => { e.stopPropagation(); setSelected({kind: 'wire', id: wire.id}); setPending(null); }} onKeyDown={e => { if (e.key === 'Enter') setSelected({kind: 'wire', id: wire.id}); }}><title>{wire.from} → {wire.to} · {voltageText(result?.terminalVoltages[wire.from])}</title><path d={path} className="circuit-wire-hit"/><path d={path} className={`circuit-wire ${wire.from.includes('GND') || wire.to.includes('GND') ? 'ground' : wire.from.includes('5V') || wire.from.includes('3V3') ? 'power' : ''}`}/></g>; })}</g>
      {circuit.components.map(part => { const shape = componentGeometry(part), position = drag?.id === part.id ? drag : part, reading = result?.components[part.id]; return <g key={part.id} transform={`translate(${position.x} ${position.y})`} className={`circuit-part ${part.type} ${selected?.id === part.id ? 'selected' : ''}`}>
        <rect className="circuit-part-body" width={shape.width} height={shape.height} rx="12" role="button" aria-disabled={disabled} tabIndex={disabled ? -1 : 0} aria-label={`Select ${COMPONENT_TYPES[part.type].label} ${part.id}`} onClick={e => { e.stopPropagation(); setSelected({kind: 'component', id: part.id}); }} onPointerDown={e => { if (disabled) return; e.stopPropagation(); const p = pointerPosition(e); e.currentTarget.setPointerCapture(e.pointerId); setSelected({kind: 'component', id: part.id}); setDrag({id: part.id, x: part.x, y: part.y, dx: p.x - part.x, dy: p.y - part.y}); }} onKeyDown={e => { if (e.key === 'Enter') setSelected({kind: 'component', id: part.id}); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); const next = service.getCircuit(), p = next.components.find(c => c.id === part.id); p.x = Math.max(300, Math.min(1180, p.x + (e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0))); p.y = Math.max(30, Math.min(620, p.y + (e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0))); attempt(() => commit(next)); } }}/>
        <text className="circuit-part-title" x={shape.width / 2} y="23" textAnchor="middle">{COMPONENT_TYPES[part.type].label}</text>
        {part.type === 'resistor' && <><path className="circuit-resistor-symbol" d="M 28 61 H 49 L 55 49 L 67 73 L 79 49 L 91 73 L 103 49 L 115 73 L 121 61 H 152"/><text x="90" y="97" textAnchor="middle">{part.params.resistance} Ω · {((reading?.current || 0) * 1000).toFixed(1)} mA</text></>}
        {part.type === 'led' && <><circle cx="90" cy="59" r="22" fill={part.params.color} opacity={reading?.lit ? 1 : 0.18} className={reading?.lit ? 'circuit-led-on' : ''}/><text x="90" y="97" textAnchor="middle">{reading?.lit ? 'ON' : 'OFF'} · {((reading?.current || 0) * 1000).toFixed(1)} mA</text></>}
        {part.type === 'button' && <><circle cx="90" cy="60" r="21" className={part.params.pressed ? 'circuit-button-down' : 'circuit-button-up'}/><text x="90" y="98" textAnchor="middle">{part.params.pressed ? 'Pressed' : 'Released'}</text></>}
        {part.type === 'potentiometer' && <><circle cx="90" cy="55" r="22" className="circuit-knob"/><line x1="90" y1="55" x2={90 + 18 * Math.sin((part.params.position - 0.5) * 4.7)} y2={55 - 18 * Math.cos((part.params.position - 0.5) * 4.7)} stroke="#fff" strokeWidth="4"/><text x="90" y="87" textAnchor="middle">{Math.round(part.params.position * 100)}% · {voltageText(reading?.voltage)}</text></>}
        {part.type === 'servo' && <><rect x="55" y="37" width="70" height="43" rx="8" fill="#2864ba"/><line x1="90" y1="58" x2={90 + 35 * Math.cos(((reading?.angle ?? 90) - 90) * Math.PI / 180)} y2={58 + 35 * Math.sin(((reading?.angle ?? 90) - 90) * Math.PI / 180)} stroke="#f0f2f4" strokeWidth="8"/><text x="90" y="94" textAnchor="middle">{reading?.active ? `${reading.angle}°` : 'No servo signal'}</text></>}
        {part.type === 'buzzer' && <><circle cx="90" cy="58" r="23" fill="#23394c"/><circle cx="90" cy="58" r="6" fill="#647e8f"/><text x="90" y="98" textAnchor="middle">{reading?.active ? `${reading.frequency} Hz` : 'Silent'}</text></>}
        {Object.entries(shape.ports).map(([name, p]) => port(`${part.id}:${name}`, p, part.type === 'breadboard' ? '' : name))}
      </g>; })}
      <g className="circuit-controller">{Object.entries(geometry.ports).map(([pin, p]) => port(`board:${pin}`, p, pin, p.x < 100 ? 'start' : 'end'))}</g>
      {!circuit.components.length && <g className="circuit-empty"><text x="800" y="300" textAnchor="middle">Your first circuit starts here.</text><text x="800" y="335" textAnchor="middle">Load a starter above, or add a component and connect its pins.</text></g>}
    </svg></div><aside className="circuit-inspector" aria-label="Circuit controls">
      {selectedPart ? <div className="circuit-control-section"><h3>{COMPONENT_TYPES[selectedPart.type].label}</h3><p className="circuit-part-id">{selectedPart.id}</p>{['resistor', 'potentiometer'].includes(selectedPart.type) && <CircuitNumberField key={`${state.boardId}:${selectedPart.id}`} label="Resistance (Ω)" min={1} max={10000000} disabled={disabled} value={selectedPart.params.resistance} onCommit={value => setParam(selectedPart.id, 'resistance', value)}/>}{selectedPart.type === 'led' && <label>LED colour<select disabled={disabled} value={selectedPart.params.color} onChange={e => setParam(selectedPart.id, 'color', e.target.value)}>{['red', 'green', 'blue', 'yellow', 'white'].map(color => <option key={color}>{color}</option>)}</select></label>}{selectedPart.type === 'button' && <button className={selectedPart.params.pressed ? 'active' : ''} disabled={disabled} onClick={() => setParam(selectedPart.id, 'pressed', !selectedPart.params.pressed)}>{selectedPart.params.pressed ? 'Release button' : 'Press button'}</button>}{selectedPart.type === 'potentiometer' && <label>Position · {Math.round(selectedPart.params.position * 100)}%<input aria-label="Potentiometer position" type="range" min="0" max="100" disabled={disabled} value={selectedPart.params.position * 100} onChange={e => setParam(selectedPart.id, 'position', Number(e.target.value) / 100)}/></label>}{selectedPart.type === 'breadboard' && <p>Each row connects a–e and f–j separately. The centre gap isolates the two halves. Each + or − rail is connected along its four holes.</p>}<dl>{COMPONENT_TYPES[selectedPart.type].terminals.filter((_, i) => i < 10).map(pin => <div key={pin}><dt>{pin}</dt><dd>{voltageText(result?.terminalVoltages[`${selectedPart.id}:${pin}`])}</dd></div>)}</dl></div> : <div className="circuit-control-section"><MousePointer2 size={22}/><h3>Inspect a component</h3><p>Select a part to change its value, press a button, turn a potentiometer or inspect its voltage.</p></div>}
      <div className="circuit-control-section"><h3>Test a virtual pin</h3>{!state.enabled ? <><p>Enable the virtual board to test signals. No hardware is needed.</p>{onEnable && <button disabled={disabled} onClick={() => attempt(onEnable)}><Play size={15}/> Enable virtual board</button>}</> : <><label>Output pin<select aria-label="Virtual test pin" disabled={disabled} value={testPin} onChange={e => setTestPin(Number(e.target.value))}>{board.outputPins.map(pin => <option key={pin} value={pin}>D{pin}</option>)}</select></label><div className="circuit-button-row"><button disabled={disabled} onClick={() => attempt(() => service.digitalWrite(testPin, 1))}>HIGH</button><button disabled={disabled} onClick={() => attempt(() => service.digitalWrite(testPin, 0))}>LOW</button><button disabled={disabled || !board.pullupPins.includes(testPin)} onClick={() => attempt(() => service.setPinMode(testPin, 'INPUT_PULLUP'))}>Pull-up</button></div>{board.pwmPins.includes(testPin) && <label>PWM · {pwm}/255<input aria-label="Virtual PWM value" type="range" min="0" max="255" value={pwm} disabled={disabled} onChange={e => { const v = Number(e.target.value); setPwm(v); attempt(() => service.analogWrite(testPin, v)); }}/></label>}<label>Servo · {angle}°<input aria-label="Virtual servo angle" type="range" min="0" max="180" value={angle} disabled={disabled} onChange={e => { const v = Number(e.target.value); setAngle(v); attempt(() => service.servoWrite(testPin, v)); }}/></label><div className="circuit-button-row"><button disabled={disabled} onClick={() => attempt(() => service.tone(testPin, 440))}>Tone 440 Hz</button><button disabled={disabled} onClick={() => attempt(() => service.stop())}>Stop outputs</button></div></>}{onUseBlocks && <button className="circuit-primary" disabled={disabled} onClick={onUseBlocks}>Program this circuit with blocks</button>}</div>
      <div className="circuit-control-section"><h3>Input readings</h3>{Object.entries(result?.pins || {}).filter(([, p]) => p.connected).length ? <dl>{Object.entries(result.pins).filter(([, p]) => p.connected).map(([pin, reading]) => <div key={pin}><dt>{pin}</dt><dd>{reading.waveform ? `${reading.waveform} waveform` : voltageText(reading.voltage)}{reading.analog !== null ? ` · ${reading.analog}/${board.analogMax}` : ''}</dd></div>)}</dl> : <p>Connect a board pin to see its voltage and ADC value.</p>}</div>
    </aside></div>
    <details className="circuit-connections"><summary>Connections · {circuit.wires.length} wires</summary>{circuit.wires.length?<ul>{circuit.wires.map(wire=><li key={wire.id}><button disabled={disabled} onClick={()=>{setSelected({kind:'wire',id:wire.id});setPending(null);}} aria-label={`Select wire ${wire.from} to ${wire.to}`}><Cable size={14}/><span>{wire.from} → {wire.to}</span></button><span>{voltageText(result?.terminalVoltages[wire.from])}</span><button disabled={disabled} aria-label={`Delete wire ${wire.from} to ${wire.to}`} onClick={()=>attempt(()=>{const next=service.getCircuit();next.wires=next.wires.filter(w=>w.id!==wire.id);commit(next);setSelected(null);})}><Trash2 size={14}/> Delete</button></li>)}</ul>:<p>No wires yet. Click two component or board pins to connect them.</p>}</details>
    <div className={`circuit-diagnostics ${result?.safe ? 'safe' : 'unsafe'}`} aria-live="polite"><strong>{result?.safe ? 'Circuit check' : 'Check these connections'}</strong>{result?.diagnostics.length ? <ul>{result.diagnostics.map((d, index) => <li key={`${d.code}-${index}`} className={d.severity}>{d.message}{DIAGNOSTIC_HELP[d.code] && <p>{DIAGNOSTIC_HELP[d.code]}</p>}{d.componentId && circuit.components.some(part => part.id === d.componentId) && <button onClick={() => setSelected({kind:'component', id:d.componentId})}>Inspect {d.componentId}</button>}</li>)}</ul> : <p>No wiring errors detected by this model.</p>}</div>
    <details className="circuit-model-limits"><summary>What this simulator can and cannot tell you</summary><ul><li><strong>Wired Blocks:</strong> connections, DC voltages and currents, resistor-limited LEDs, button pull-ups and ADC readings. PWM is an average voltage; servo and buzzer are behavioral models.</li><li><strong>Compiled Uno firmware:</strong> the CPU panel executes Uno R3 instructions and supported peripherals. It does not emulate every Arduino or ESP32 board.</li><li><strong>Advanced analog:</strong> export a static snapshot for SPICE analysis. The CPU and SPICE engines are not coupled in real time.</li><li><strong>Real hardware:</strong> a successful simulation does not certify a circuit. Check ratings, power supplies and wiring with a teacher before connecting real components.</li></ul></details>
    <footer className="circuit-footer"><p>{result?.assumptions} Use the advanced analog workspace for SPICE analysis. Servo supply/current and physical circuits need separate verification.</p><div><button disabled={disabled} onClick={() => downloadBlob(new Blob([JSON.stringify(service.getCircuit(), null, 2)], {type: 'application/json'}), 'DUETBlox-circuit.json')}><Download size={15}/> Save circuit</button><button disabled={disabled} onClick={() => importer.current?.click()}><Upload size={15}/> Open circuit</button><input ref={importer} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const generation=++importGeneration.current; attempt(async () => { if (file.size > 256000) throw new Error('Circuit files must be smaller than 256 KB.'); const text=await file.text(); if(generation!==importGeneration.current)return; commit(validateCircuit(JSON.parse(text), {boardId: state.boardId})); setSelected(null); setPending(null); }); }}/></div></footer>
    <div className="circuit-spice-export"><button disabled={disabled||Boolean(firmwareState?.running)} onClick={()=>attempt(()=>{const netlist=circuitToSpiceNetlist(service.getCircuit(),firmwareState||service.getState());downloadBlob(new Blob([netlist],{type:"text/plain"}),"DUETBlox-wired-snapshot.cir");})}><Download size={15}/> Export static SPICE snapshot</button><p>Open the .cir file in Advanced analog to solve the same resistor/LED/button/potentiometer connections with ngspice. Stop waveforms first. This is a static snapshot, not live CPU/SPICE co-simulation.</p></div>
    <UnoFirmwarePanel service={service} disabled={disabled} onState={setFirmwareState}/>
  </section>;
}

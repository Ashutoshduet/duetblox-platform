import React, {useEffect, useRef, useState} from 'react';
import {Play, Pause, RotateCcw, Upload} from 'lucide-react';
import {validateHex} from '../programming/firmware.js';

export default function UnoFirmwarePanel({service, disabled = false, onState}) {
  const [cpu, setCpu] = useState(null), [error, setError] = useState(''), [name, setName] = useState('');
  const worker = useRef(null), loaded = useRef(null), input = useRef(null), readGeneration = useRef(0), mounted = useRef(false);
  useEffect(() => { onState?.(cpu); }, [cpu, onState]);
  const stop = () => { worker.current?.terminate(); worker.current = null; };
  useEffect(() => {
    mounted.current = true;
    let revision = service.circuitRevision;
    let previousBoard = service.boardId, wasEnabled = service.enabled;
    const unsubscribe = service.subscribe(state => {
      if (state.boardId !== previousBoard || state.enabled !== wasEnabled) { readGeneration.current++; previousBoard = state.boardId; wasEnabled = state.enabled; }
      if (state.boardId !== 'arduino-uno' || state.enabled) { stop(); loaded.current = null; setCpu(null); setName(''); return; }
      if (revision !== state.circuitRevision) { revision = state.circuitRevision; worker.current?.postMessage({type: 'circuit', circuit: service.getCircuit()}); }
    });
    return () => { mounted.current = false; readGeneration.current++; unsubscribe(); stop(); };
  }, [service]);
  useEffect(() => { if (disabled) worker.current?.postMessage({type: 'pause'}); }, [disabled]);
  const load = (hex, filename) => {
    if (!mounted.current) return;
    validateHex(hex, 32256);
    const circuit = service.getCircuit(); if (circuit.boardId !== 'arduino-uno') throw new Error('Select Arduino Uno R3 for compiled firmware simulation.');
    if (service.getState().enabled) throw new Error('Turn the virtual Blocks simulation off before running compiled HEX.');
    readGeneration.current++; stop();
    let next;
    try { next = new Worker(new URL('./uno-worker.js', import.meta.url), {type: 'module'}); }
    catch (error) { setError(`Could not start the Uno simulator: ${error.message}`); loaded.current = null; setCpu(null); return; }
    worker.current = next;
    next.onmessage = ({data}) => { if (!mounted.current || worker.current !== next) return; if (data.type === 'error') { setError(data.message); setCpu(previous => previous ? {...previous, running: false} : null); } else setCpu(data); };
    next.onerror = () => { if (!mounted.current || worker.current !== next) return; setError('The Uno simulator worker stopped unexpectedly. Reload the firmware to restart it.'); stop(); setCpu(previous => previous ? {...previous, running: false} : null); };
    loaded.current = {hex, filename}; setError(''); setName(filename); setCpu(null); next.postMessage({type: 'load', hex, circuit});
  };
  const state = service.getState();
  if (state.boardId !== 'arduino-uno') return <section className="circuit-firmware-panel"><h3>Compiled firmware simulation</h3><p>The CPU emulator currently models Uno R3’s ATmega328P at 16 MHz. Mega, Nano and ESP32 instruction execution are not enabled here; their wired block simulation is available above.</p></section>;
  return <section className="circuit-firmware-panel" aria-label="Uno compiled firmware simulator"><div><h3>Run actual Uno firmware</h3><p>Load an Arduino Uno R3 application <code>.hex</code> from Robotics → Compile → Download verified HEX, or an Uno build from Arduino IDE. AVR8js executes its CPU instructions, timers, GPIO, ADC and serial output in a worker.</p><p>The same circuit above feeds GPIO/ADC inputs. This is separate from running Blocks. SPI/I²C devices, EEPROM, bootloader flashing, USB, motor current and coupled SPICE simulation are not modeled. Servo pulse display uses DUETBlox’s 1000–2000 μs range. A CPU step advances up to 10 ms; slower machines may advance less.</p></div>
    {state.enabled && <p className="circuit-firmware-note">Turn Blocks simulation off before loading HEX. Circuit editing remains available.</p>}
    <div className="circuit-button-row"><button disabled={disabled || state.enabled} onClick={() => input.current?.click()}><Upload size={15}/> Load Uno HEX</button><button disabled={disabled || !cpu || cpu.running} onClick={() => worker.current?.postMessage({type: 'run'})}><Play size={15}/> Run firmware</button><button disabled={!cpu?.running} onClick={() => worker.current?.postMessage({type: 'pause'})}><Pause size={15}/> Pause</button><button disabled={disabled || !cpu || cpu.running} onClick={() => worker.current?.postMessage({type: 'step'})}>Step CPU</button><button disabled={disabled || !loaded.current} onClick={() => { try { load(loaded.current.hex, loaded.current.filename); } catch (e) { setError(e.message); } }}><RotateCcw size={15}/> Reset</button><input ref={input} type="file" accept=".hex,.ihex,text/plain" hidden onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const generation=++readGeneration.current; try { if (file.size > 100000) throw new Error('Uno HEX files must be smaller than 100 KB.'); const text=await file.text(); if(!mounted.current||generation!==readGeneration.current)return; load(text, file.name); } catch (error) { if(mounted.current&&generation===readGeneration.current)setError(error.message); } }}/></div>
    {error && <p className="circuit-error" role="alert">{error}</p>}{cpu && <><p className="circuit-cpu-status" role="status">{name} · {cpu.running ? 'Running' : 'Paused'} · {cpu.seconds.toFixed(3)} simulated seconds · {cpu.cycles.toLocaleString()} CPU cycles</p><div className="circuit-firmware-readings">{Object.entries(cpu.circuitResult.components).filter(([, value]) => ['led', 'servo', 'buzzer', 'potentiometer'].includes(value.type)).map(([id, value]) => <div key={id} className={value.lit || value.active ? 'active' : ''}><strong>{id}</strong><span>{value.type === 'led' ? `${value.lit ? 'ON' : 'OFF'} · ${(value.current * 1000).toFixed(1)} mA` : value.type === 'servo' ? value.active ? `${value.angle}°` : 'No servo pulses' : value.type === 'buzzer' ? value.active ? `${value.frequency} Hz` : 'Silent' : `${(value.voltage || 0).toFixed(2)} V`}</span></div>)}</div>{cpu.circuitResult.diagnostics.length > 0 && <ul className="circuit-cpu-diagnostics">{cpu.circuitResult.diagnostics.map((d, i) => <li key={i}>{d.message}</li>)}</ul>}<details><summary>Serial monitor</summary><pre>{cpu.serial || 'No serial output yet.'}</pre></details></>}
  </section>;
}

import {requireBoard} from '../hardware/boards.js';
import {validateCircuit, terminalIds, analogPort} from './model.js';

const LED_VF = {red: 1.9, green: 2.2, blue: 3, yellow: 2.1, white: 3};
// An original, bounded DC teaching model. Not SPICE: no capacitance, inductance,
// diode exponential/transient behaviour, motor mechanics or thermal simulation.
// GPIO output resistance 25 ohms and LED slope resistance 10 ohms are assumptions.
export function solveCircuit(input, boardState = {}) {
  const circuit = validateCircuit(input), board = requireBoard(circuit.boardId);
  const terminals = terminalIds(circuit), parent = new Map(terminals.map(t => [t, t]));
  const root = id => { let p = id; while (parent.get(p) !== p) p = parent.get(p); while (parent.get(id) !== id) { const next = parent.get(id); parent.set(id, p); id = next; } return p; };
  const union = (a, b) => parent.set(root(a), root(b));
  for (const wire of circuit.wires) union(wire.from, wire.to);
  for (const part of circuit.components.filter(c => c.type === 'breadboard')) {
    for (let row = 1; row <= 10; row++) for (const letters of ['abcde', 'fghij']) for (const letter of letters.slice(1)) union(`${part.id}:${letters[0]}${row}`, `${part.id}:${letter}${row}`);
    for (const rail of ['+', '-']) for (let index = 2; index <= 4; index++) union(`${part.id}:${rail}1`, `${part.id}:${rail}${index}`);
  }
  const diagnostics = [], diagnosticIds = new Set();
  const warn = (code, message, componentId, severity = 'warning') => {
    const key = `${code}:${componentId || ''}`;
    if (!diagnosticIds.has(key)) { diagnosticIds.add(key); diagnostics.push({code, message, componentId: componentId || null, severity}); }
  };
  const fixed = new Map(), addFixed = (terminal, voltage) => {
    const node = root(terminal);
    if (fixed.has(node) && Math.abs(fixed.get(node) - voltage) > 0.01) warn('supply-short', 'Power rails are shorted together. Disconnect the wire between different supplies or ground.', null, 'error');
    else fixed.set(node, voltage);
  };
  addFixed('board:GND', 0); addFixed('board:5V', 5); addFixed('board:3V3', 3.3);
  const connected = new Set(circuit.wires.flatMap(w => [w.from, w.to]));
  const sources = [], edges = [], leds = [], pinStates = new Map((boardState.pins || []).map(p => [p.pin, p]));
  const edge = (a, b, resistance, offset = 0, id = '') => edges.push({a: root(a), b: root(b), resistance, offset, id});
  for (const pin of board.digitalPins) {
    const p = pinStates.get(pin), terminal = `board:D${pin}`, node = root(terminal);
    if (!p) continue;
    if (p.mode === 'OUTPUT' && ['digital', 'pwm'].includes(p.kind)) sources.push({node, voltage: board.voltage * (p.kind === 'pwm' ? p.value / 255 : p.value), resistance: 25, pin, kind: p.kind});
    else if (p.mode === 'INPUT_PULLUP') sources.push({node, voltage: board.voltage, resistance: 20000, pin, kind: 'pullup'});
    else if (p.mode !== 'OUTPUT' && p.input !== null && p.input !== undefined) sources.push({node, voltage: p.input * board.voltage, resistance: 25, pin, kind: 'manual'});
  }
  for (const c of circuit.components) {
    const port = name => `${c.id}:${name}`;
    if (c.type === 'resistor') edge(port('a'), port('b'), c.params.resistance, 0, c.id);
    if (c.type === 'button' && c.params.pressed) edge(port('a'), port('b'), 0.1, 0, c.id);
    if (c.type === 'potentiometer') { edge(port('a'), port('wiper'), Math.max(0.01, c.params.resistance * (1 - c.params.position)), 0, c.id); edge(port('wiper'), port('b'), Math.max(0.01, c.params.resistance * c.params.position), 0, c.id); }
    if (c.type === 'led') leds.push({id: c.id, a: root(port('anode')), b: root(port('cathode')), vf: LED_VF[c.params.color], on: false});
    if (c.type === 'servo') edge(port('power'), port('ground'), 10000, 0, c.id); // Power presence only; not motor current.
  }
  // Unused breadboard holes and GPIOs need no matrix rows. This keeps a large
  // collection of disconnected components from making every command expensive.
  const nodes = [...new Set([...fixed.keys(), ...sources.map(s => s.node), ...edges.flatMap(e => [e.a, e.b]), ...leds.flatMap(e => [e.a, e.b]), ...circuit.wires.flatMap(w => [root(w.from), root(w.to)])])];
  const unknown = nodes.filter(node => !fixed.has(node)), index = new Map(unknown.map((node, i) => [node, i]));
  let voltages = new Map(fixed), converged = false, activeEdges = edges;
  const solve = active => {
    const n = unknown.length, matrix = Array.from({length: n}, () => new Float64Array(n + 1));
    for (let i = 0; i < n; i++) matrix[i][i] = 1e-10; // Numerical reference; floating nets are separately detected.
    const conduct = (a, b, g, offset = 0) => {
      const ai = index.get(a), bi = index.get(b);
      if (ai !== undefined) { matrix[ai][ai] += g; if (bi !== undefined) matrix[ai][bi] -= g; else matrix[ai][n] += g * fixed.get(b); matrix[ai][n] += g * offset; }
      if (bi !== undefined) { matrix[bi][bi] += g; if (ai !== undefined) matrix[bi][ai] -= g; else matrix[bi][n] += g * fixed.get(a); matrix[bi][n] -= g * offset; }
    };
    for (const item of active) if (item.a !== item.b) conduct(item.a, item.b, 1 / item.resistance, item.offset);
    for (const source of sources) { const i = index.get(source.node); if (i !== undefined) { matrix[i][i] += 1 / source.resistance; matrix[i][n] += source.voltage / source.resistance; } }
    for (let col = 0; col < n; col++) {
      let best = col; for (let row = col + 1; row < n; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[best][col])) best = row;
      [matrix[col], matrix[best]] = [matrix[best], matrix[col]];
      const pivot = matrix[col][col];
      if (!Number.isFinite(pivot) || Math.abs(pivot) < 1e-16) throw new Error('This circuit could not be solved. Check disconnected or conflicting power connections.');
      for (let row = col + 1; row < n; row++) {
        const ratio = matrix[row][col] / pivot;
        if (ratio === 0) continue;
        for (let k = col; k <= n; k++) matrix[row][k] -= ratio * matrix[col][k];
      }
    }
    const values = new Float64Array(n);
    for (let row = n - 1; row >= 0; row--) { let sum = matrix[row][n]; for (let col = row + 1; col < n; col++) sum -= matrix[row][col] * values[col]; values[row] = sum / matrix[row][row]; }
    return new Map([...fixed, ...unknown.map((node, i) => [node, values[i]])]);
  };
  if (!diagnosticIds.has('supply-short:')) {
    for (let pass = 0; pass < 24; pass++) {
      activeEdges = [...edges, ...leds.filter(led => led.on).map(led => ({...led, resistance: 10, offset: led.vf}))];
      voltages = solve(activeEdges);
      let changed = false;
      for (const led of leds) { const forward = voltages.get(led.a) - voltages.get(led.b); const on = forward > led.vf + (led.on ? -1e-7 : 1e-7); if (on !== led.on) { led.on = on; changed = true; } }
      if (!changed) { converged = true; break; }
    }
    if (!converged) warn('solver-convergence', 'This LED network did not settle in the DC teaching model. Simplify the circuit or use the advanced analog simulator.', null, 'error');
  }
  const graph = new Map(nodes.map(node => [node, new Set()]));
  for (const item of activeEdges) { graph.get(item.a).add(item.b); graph.get(item.b).add(item.a); }
  const referenced = new Set([...fixed.keys(), ...sources.map(source => source.node)]), queue = [...referenced];
  for (let i = 0; i < queue.length; i++) for (const next of graph.get(queue[i]) || []) if (!referenced.has(next)) { referenced.add(next); queue.push(next); }
  const valid = converged && !diagnostics.some(d => d.severity === 'error');
  const voltage = terminal => valid && referenced.has(root(terminal)) ? voltages.get(root(terminal)) : null;
  const componentResults = {};
  for (const c of circuit.components) {
    const v = name => voltage(`${c.id}:${name}`), result = {type: c.type};
    if (c.type === 'resistor') { result.voltage = v('a') === null || v('b') === null ? null : v('a') - v('b'); result.current = result.voltage === null ? 0 : result.voltage / c.params.resistance; result.power = result.current ** 2 * c.params.resistance; if (result.power > 0.25) warn('resistor-power', `${c.id} dissipates ${(result.power * 1000).toFixed(0)} mW, above a typical ¼ W resistor rating.`, c.id); }
    if (c.type === 'led') {
      const led = leds.find(l => l.id === c.id); result.voltage = v('anode') === null || v('cathode') === null ? null : v('anode') - v('cathode');
      result.current = valid && led.on ? Math.max(0, (voltages.get(led.a) - voltages.get(led.b) - led.vf) / 10) : 0;
      result.lit = result.current > 0.0001; result.brightness = Math.min(1, result.current / 0.015);
      if (result.current > 0.02) warn('led-overcurrent', `${c.id}: ${(result.current * 1000).toFixed(1)} mA exceeds the 20 mA teaching limit. Increase the series resistance.`, c.id, 'error');
      if (result.voltage !== null && result.voltage < -0.1) warn('led-reversed', `${c.id} is reverse biased. Connect the anode toward the positive supply and cathode toward ground.`, c.id);
      // Opening all resistors must interrupt the LED's path to at least one source.
      const reachesPowerWithoutResistor = start => {
        const todo = [start], seen = new Set(todo);
        for (let i = 0; i < todo.length; i++) {
          if (fixed.has(todo[i]) || sources.some(s => s.node === todo[i])) return true;
          for (const item of edges.filter(e => circuit.components.find(p => p.id === e.id)?.type === 'button')) { const next = item.a === todo[i] ? item.b : item.b === todo[i] ? item.a : null; if (next && !seen.has(next)) { seen.add(next); todo.push(next); } }
        }
        return false;
      };
      if (connected.has(`${c.id}:anode`) && connected.has(`${c.id}:cathode`) && reachesPowerWithoutResistor(led.a) && reachesPowerWithoutResistor(led.b)) warn('led-resistor-missing', `${c.id} needs a series resistor. Do not connect an LED directly between a GPIO/supply and ground.`, c.id, 'error');
    }
    if (c.type === 'button') result.pressed = c.params.pressed;
    if (c.type === 'potentiometer') { result.voltage = v('wiper'); result.position = c.params.position; }
    if (c.type === 'servo' || c.type === 'buzzer') {
      const signalTerminal = `${c.id}:${c.type === 'servo' ? 'signal' : 'positive'}`;
      const pin = [...pinStates.values()].find(p => root(`board:D${p.pin}`) === root(signalTerminal));
      const ground = v(c.type === 'servo' ? 'ground' : 'negative'), powered = ground !== null && Math.abs(ground) < 0.1 && (c.type !== 'servo' || (v('power') !== null && v('power') >= 4.5 && v('power') <= 6));
      result.powered = powered; result.signalPin = pin?.pin ?? null;
      result.active = valid && powered && pin?.kind === (c.type === 'servo' ? 'servo' : 'tone');
      if (c.type === 'servo') result.angle = result.active ? pin.value : null;
      else result.frequency = result.active ? pin.value : 0;
      if (!powered) warn('component-power', `${c.id}: connect ${c.type === 'servo' ? '5 V power and ground' : 'the negative terminal to ground'} to operate.`, c.id);
    }
    componentResults[c.id] = result;
  }
  const pinReadings = {};
  for (const terminal of [...board.digitalPins.map(pin => `D${pin}`), ...board.analogPins.map(analogPort)]) {
    const full = `board:${terminal}`, value = voltage(full), isConnected = connected.has(full);
    const kind = terminal.startsWith('D') ? pinStates.get(Number(terminal.slice(1)))?.kind : null;
    const waveform = ['servo', 'tone'].includes(kind) ? kind : null;
    pinReadings[terminal] = {voltage: value, connected: isConnected, floating: value === null && !waveform, waveform, digital: value === null ? null : value < board.voltage * 0.3 ? 0 : value > board.voltage * 0.6 ? 1 : null, analog: value === null ? null : Math.round(Math.min(1, Math.max(0, value / board.voltage)) * board.analogMax)};
    if (isConnected && value === null && !waveform && valid) warn('floating-input', `${terminal} has no path to a power reference. Add a pull-up, pull-down or complete the circuit.`, terminal);
    if (value !== null && value > board.voltage + 0.3) warn('pin-overvoltage', `${terminal} is at ${value.toFixed(2)} V; ${board.name} uses ${board.voltage} V logic.`, terminal, 'error');
  }
  for (const source of sources.filter(s => s.kind !== 'pullup')) {
    const current = valid ? Math.abs(source.voltage - voltages.get(source.node)) / source.resistance : 0;
    if (current > 0.02) warn('gpio-overcurrent', `D${source.pin}: ${(current * 1000).toFixed(1)} mA exceeds the 20 mA teaching limit. Check for short circuits and add resistance.`, `D${source.pin}`, 'error');
  }
  return {kind: 'dc-educational', valid, safe: valid && !diagnostics.some(d => d.severity === 'error'), diagnostics, components: componentResults, pins: pinReadings, terminalVoltages: Object.fromEntries(terminals.map(terminal => [terminal, voltage(terminal)])), nets: Object.fromEntries(terminals.map(terminal => [terminal, root(terminal)])), assumptions: 'DC approximation: 25 Ω GPIO output, piecewise-linear LEDs, PWM average voltage. Servo and buzzer are behavioral. No SPICE, transient timing, motor current or physical-board validation.'};
}

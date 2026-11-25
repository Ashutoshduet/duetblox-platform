import {requireBoard} from '../hardware/boards.js';
import {validateNetlist} from '../spice/model.js';
import {validateCircuit} from './model.js';
import {solveCircuit} from './solver.js';

/** Export a static operating-point snapshot, not CPU/SPICE co-simulation. */
export function circuitToSpiceNetlist(input, boardState = {}) {
  const circuit = validateCircuit(input), board = requireBoard(circuit.boardId);
  if (circuit.components.some(part => ['servo', 'buzzer'].includes(part.type))) throw new Error('SPICE export supports resistors, LEDs, buttons, potentiometers and breadboard wiring. Servo and buzzer models are behavioral; remove them from this circuit before exporting.');
  if ((boardState.pins || []).some(pin => ['pwm', 'servo', 'tone'].includes(pin.kind))) throw new Error('Stop PWM, servo and tone outputs before exporting a DC snapshot. This export does not convert timed waveforms into SPICE.');
  const solution = solveCircuit(circuit, boardState);
  if (!solution.safe) throw new Error('Fix the circuit errors before exporting its SPICE snapshot.');
  const nets = new Map([[solution.nets['board:GND'], '0']]);
  const node = endpoint => { const net = solution.nets[endpoint]; if (!nets.has(net)) nets.set(net, `n${nets.size}`); return nets.get(net); };
  const lines = ['DUETBlox static wired circuit', '* DC snapshot only. No CPU or SPICE timing coupling.', '* GPIO: 25 ohm output resistance. LEDs: generic teaching models, not measured parts.', `Vrail5 ${node('board:5V')} 0 5`, `Vrail3 ${node('board:3V3')} 0 3.3`];
  const models = new Set(), vf = {red: 1.9, green: 2.2, blue: 3, yellow: 2.1, white: 3};
  let count = 0;
  for (const pin of boardState.pins || []) {
    if (!board.digitalPins.includes(pin.pin)) continue;
    const terminal = `board:D${pin.pin}`;
    if (!circuit.wires.some(wire => wire.from === terminal || wire.to === terminal)) continue;
    if (pin.mode === 'OUTPUT' && pin.kind === 'digital') {
      if (![0, 1].includes(pin.value)) throw new Error('GPIO snapshots must contain digital values of 0 or 1.');
      lines.push(`Vgpio${pin.pin} gpio${pin.pin} 0 ${pin.value * board.voltage}`, `Rgpio${pin.pin} gpio${pin.pin} ${node(terminal)} 25`);
    } else if (pin.mode === 'INPUT_PULLUP') lines.push(`Rpullup${pin.pin} ${node(`board:${board.voltage === 5 ? '5V' : '3V3'}`)} ${node(terminal)} 20000`);
  }
  for (const part of circuit.components) {
    const port = terminal => node(`${part.id}:${terminal}`), id = ++count;
    if (part.type === 'resistor') lines.push(`Rpart${id} ${port('a')} ${port('b')} ${part.params.resistance}`);
    if (part.type === 'button') lines.push(`Rbutton${id} ${port('a')} ${port('b')} ${part.params.pressed ? '0.1' : '1e12'}`);
    if (part.type === 'potentiometer') lines.push(`RpotA${id} ${port('a')} ${port('wiper')} ${Math.max(0.01, part.params.resistance * (1 - part.params.position))}`, `RpotB${id} ${port('wiper')} ${port('b')} ${Math.max(0.01, part.params.resistance * part.params.position)}`);
    if (part.type === 'led') { const color = part.params.color; lines.push(`Dled${id} ${port('anode')} ${port('cathode')} led_${color}`); models.add(color); }
    if (part.type !== 'breadboard') lines.push(`* part${id}: ${part.id} ${part.type}`);
  }
  for (const color of models) lines.push(`.model led_${color} D(IS=1e-20 N=${(vf[color] / (0.02585 * Math.log(0.015 / 1e-20 + 1))).toFixed(6)} RS=10)`);
  for (const [endpoint, net] of Object.entries(solution.nets)) if (endpoint.startsWith('board:') && nets.has(net)) lines.push(`* ${endpoint.replace(':', ' ')} = ${nets.get(net)}`);
  lines.push('.op', '.end');
  const netlist = lines.join('\n'); validateNetlist(netlist);
  return netlist;
}

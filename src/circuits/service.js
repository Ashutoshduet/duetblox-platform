import {VirtualBoardService} from '../hardware/virtual-board.js';
import {requireBoard, validatePin} from '../hardware/boards.js';
import {analogPort, emptyCircuit, validateCircuit, validateCircuitLibrary, createStarterCircuit} from './model.js';
import {solveCircuit} from './solver.js';

/** Same I/O contract as the logical board, with actual circuit connectivity.
 * No operation in this class can open or write to a physical device.
 */
export class CircuitBoardService extends VirtualBoardService {
  constructor(options = {}) {
    super(options);
    this.circuitRevision = 0; this.circuitsByBoard = new Map();
    this.circuit = options.circuit ? validateCircuit(options.circuit, {boardId: this.boardId}) : emptyCircuit(this.boardId);
    this._solveCircuit();
  }
  _solveCircuit() {
    if (!this.circuit || this.circuit.boardId !== this.boardId) {
      if (this.circuit) this.circuitsByBoard.set(this.circuit.boardId, this.circuit);
      this.circuit = this.circuitsByBoard.get(this.boardId) || emptyCircuit(this.boardId);
      this.circuitRevision++;
    }
    this.circuitResult = solveCircuit(this.circuit, super.getState());
  }
  getState() {
    return {...super.getState(), circuitRevision: this.circuitRevision, circuit: this.getCircuit(), circuitResult: this.circuitResult ? structuredClone(this.circuitResult) : null};
  }
  getCircuit() { return structuredClone(this.circuit || emptyCircuit(this.boardId)); }
  getCircuitLibrary() {
    return validateCircuitLibrary({kind: 'duetblox-circuit-library', version: 1, activeBoardId: this.boardId, circuits: {...Object.fromEntries(this.circuitsByBoard), [this.boardId]: this.getCircuit()}});
  }
  setCircuitLibrary(value) {
    this._available(); const library = validateCircuitLibrary(value);
    this.circuitsByBoard = new Map(Object.entries(library.circuits));
    this.board = requireBoard(library.activeBoardId); this.boardId = library.activeBoardId;
    this.circuit = library.circuits[library.activeBoardId]; this._clearModel(); this.circuitRevision++;
    return this._emit('Circuit library restored; outputs reset', false);
  }
  setCircuit(value) {
    this._available();
    const circuit = validateCircuit(value);
    if (circuit.boardId !== this.boardId) {
      this.circuitsByBoard.set(this.boardId, this.circuit);
      this.board = requireBoard(circuit.boardId); this.boardId = circuit.boardId; this._clearModel();
    }
    this.circuit = circuit;
    this.circuitRevision++;
    return this._emit('Circuit updated; connections recalculated', false);
  }
  loadStarter(name) { return this.setCircuit(createStarterCircuit(name, this.boardId)); }
  setComponentValue(id, key, value) {
    const circuit = this.getCircuit(), component = circuit.components.find(part => part.id === id);
    if (!component) throw new Error('The component no longer exists.');
    if (!Object.hasOwn(component.params, key)) throw new Error('That setting is not available for this component.');
    component.params[key] = value;
    return this.setCircuit(circuit);
  }
  _emit(action, command = true) { this._solveCircuit(); return super._emit(action, command); }
  async readDigital(pin) {
    this._enabled(); const p = this._pin(pin), reading = this.circuitResult.pins[`D${p.pin}`];
    if (!reading?.connected) return super.readDigital(pin);
    if (!this.circuitResult.safe) throw new Error('Fix the circuit errors before reading connected pins.');
    if (['pwm', 'servo', 'tone'].includes(p.kind)) throw new Error(`D${p.pin} produces a waveform. Use a digital input or the compiled Uno simulator to sample timing.`);
    if (reading.digital === null) throw new Error(`D${p.pin} is ${reading.floating ? 'floating; complete the circuit or add a pull-up/down' : 'between valid LOW and HIGH levels'}.`);
    this._emit(`Read circuit D${p.pin}: ${reading.digital}`); return reading.digital;
  }
  async readAnalog(pin) {
    this._enabled(); const canonical = validatePin(this.board, pin, 'analog'), reading = this.circuitResult.pins[analogPort(canonical)];
    if (!reading?.connected) return super.readAnalog(pin);
    if (!this.circuitResult.safe) throw new Error('Fix the circuit errors before reading connected pins.');
    if (reading.analog === null) throw new Error(`${canonical} is floating. Connect a sensor or potentiometer to power, ground and this input.`);
    this._emit(`Read circuit analog ${canonical}: ${reading.analog}`); return reading.analog;
  }
}

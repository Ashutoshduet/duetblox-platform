import {CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig, PinState, AVRTimer, timer0Config, timer1Config, timer2Config, AVRADC, adcConfig, AVRUSART, usart0Config} from 'avr8js';
import {validateHex} from '../programming/firmware.js';
import {validateCircuit} from './model.js';
import {solveCircuit} from './solver.js';

export const UNO_CLOCK_HZ = 16000000;
export function parseUnoHex(text) {
  validateHex(text, 32256);
  const bytes = new Uint8Array(32768).fill(0xff); let upper = 0;
  for (const line of text.trim().split(/\r?\n/)) {
    const record = Uint8Array.from(line.slice(1).match(/../g), value => parseInt(value, 16));
    const count = record[0], address = (record[1] << 8) | record[2], type = record[3];
    if (type === 0) bytes.set(record.subarray(4, 4 + count), upper + address);
    if (type === 2 || type === 4) upper = ((record[4] << 8) | record[5]) * (type === 2 ? 16 : 65536);
  }
  return Uint16Array.from({length: 16384}, (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8));
}

/** Actual ATmega328P instruction execution, independent of Scratch commands.
 * CPU, timers, GPIO, ADC and UART come from MIT-licensed AVR8js. Circuit voltage
 * is the bounded educational DC model, not a SPICE coupling or hardware proof.
 */
export class UnoFirmwareRunner {
  constructor({hex, circuit}) {
    this.circuit = validateCircuit(circuit, {boardId: 'arduino-uno'});
    this.cpu = new CPU(parseUnoHex(hex), 2048);
    this.portB = new AVRIOPort(this.cpu, portBConfig); this.portC = new AVRIOPort(this.cpu, portCConfig); this.portD = new AVRIOPort(this.cpu, portDConfig);
    this.timers = [new AVRTimer(this.cpu, timer0Config), new AVRTimer(this.cpu, timer1Config), new AVRTimer(this.cpu, timer2Config)];
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.usart = new AVRUSART(this.cpu, usart0Config, UNO_CLOCK_HZ);
    this.serial = ''; this.usart.onByteTransmit = value => { this.serial = (this.serial + String.fromCharCode(value)).slice(-8192); };
    this.dirty = true; this.edges = new Map(); this.previousLevels = new Map();
    for (const port of [this.portB, this.portC, this.portD]) port.addListener(() => { this.dirty = true; });
    this.refreshCircuit();
  }
  setCircuit(value) { this.circuit = validateCircuit(value, {boardId: 'arduino-uno'}); this.dirty = true; this.refreshCircuit(); }
  digitalPort(pin) { return pin < 8 ? {port: this.portD, bit: pin} : {port: this.portB, bit: pin - 8}; }
  readPinStates() {
    return Array.from({length: 12}, (_, i) => {
      const pin = i + 2, {port, bit} = this.digitalPort(pin), level = port.pinState(bit), value = level === PinState.High ? 1 : 0;
      const output = level === PinState.High || level === PinState.Low;
      if (output && this.previousLevels.get(pin) !== value) {
        const edges = this.edges.get(pin) || {};
        if (value) { if (edges.rising !== undefined) edges.period = this.cpu.cycles - edges.rising; edges.rising = this.cpu.cycles; }
        else if (edges.rising !== undefined) edges.highCycles = this.cpu.cycles - edges.rising;
        edges.last = this.cpu.cycles; this.edges.set(pin, edges);
      }
      this.previousLevels.set(pin, output ? value : null);
      return {pin, mode: output ? 'OUTPUT' : level === PinState.InputPullUp ? 'INPUT_PULLUP' : 'INPUT', kind: output ? 'digital' : null, value, input: null};
    });
  }
  refreshCircuit() {
    this.dirty = false; this.pins = this.readPinStates(); this.result = solveCircuit(this.circuit, {pins: this.pins});
    for (const pin of this.pins.filter(p => p.mode !== 'OUTPUT')) {
      const reading = this.result.pins[`D${pin.pin}`], {port, bit} = this.digitalPort(pin.pin);
      // Floating inputs resolve LOW here; the diagnostics explicitly mark them.
      port.setPin(bit, reading.digital === 1);
    }
    for (let channel = 0; channel < 6; channel++) {
      const reading = this.result.pins[`A${channel}`];
      this.adc.channelValues[channel] = reading?.voltage === null ? 0 : Math.max(0, Math.min(5, reading?.voltage || 0));
      this.portC.setPin(channel, reading?.digital === 1);
    }
  }
  runCycles(cycles = 160000, {timeBudgetMs = 20} = {}) {
    if (!Number.isInteger(cycles) || cycles < 1 || cycles > 16000000) throw new Error('A CPU step must be between 1 and 16,000,000 cycles.');
    if (!Number.isFinite(timeBudgetMs) || timeBudgetMs < 1 || timeBudgetMs > 1000) throw new Error('Invalid CPU execution time budget.');
    const target = this.cpu.cycles + cycles, started = performance.now(); let instructions = 0;
    while (this.cpu.cycles < target) {
      if (this.cpu.pc >= this.cpu.progMem.length) throw new Error('The program counter left Uno flash memory. Check that the HEX was compiled for Arduino Uno R3.');
      avrInstruction(this.cpu); this.cpu.tick();
      if (this.dirty) this.refreshCircuit();
      if (++instructions % 1024 === 0 && performance.now() - started >= timeBudgetMs) break;
    }
    return this.getState();
  }
  getState() {
    const circuitResult = structuredClone(this.result);
    // Decode the actual timed pulse stream for behavioral servo/buzzer displays.
    for (const part of this.circuit.components.filter(c => c.type === 'servo' || c.type === 'buzzer')) {
      const reading = circuitResult.components[part.id], edges = this.edges.get(reading.signalPin), recent = edges && this.cpu.cycles - edges.last < UNO_CLOCK_HZ / 10;
      if (reading.powered && recent && edges.period > 0) {
        const hz = UNO_CLOCK_HZ / edges.period, highUs = (edges.highCycles || 0) / 16;
        if (part.type === 'buzzer' && hz >= 31 && hz <= 20000) { reading.active = true; reading.frequency = Math.round(hz); }
        if (part.type === 'servo' && hz >= 35 && hz <= 70 && highUs >= 900 && highUs <= 2100) { reading.active = true; reading.angle = Math.max(0, Math.min(180, Math.round((highUs - 1000) * 180 / 1000))); }
      }
    }
    return {cycles: this.cpu.cycles, seconds: this.cpu.cycles / UNO_CLOCK_HZ, programCounter: this.cpu.pc, serial: this.serial, pins: this.pins.map(p => ({...p})), circuitResult};
  }
}

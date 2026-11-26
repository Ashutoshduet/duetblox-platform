import {requireBoard} from '../hardware/boards.js';
import {analogPort, createStarterCircuit} from './model.js';

export const CIRCUIT_LESSONS = Object.freeze([
  {id: 'led', title: 'Light an LED', goal: 'Make a complete path, then compare HIGH and LOW.', codeKind: 'blink'},
  {id: 'button', title: 'Read a push button', goal: 'Discover why a released button needs a pull-up.', codeKind: 'button'},
  {id: 'pot', title: 'Read a turning knob', goal: 'Compare voltage and the number returned by the ADC.'},
  {id: 'sensor', title: 'Let a sensor control an LED', goal: 'Use a threshold to choose between two outputs.', codeKind: 'sensor'}
]);

// The checks use the solved net topology, so an equivalent connection through a
// breadboard is accepted. These are measurements, not an assessment of learning.
export function getCircuitLesson(id, boardId) {
  const lesson = CIRCUIT_LESSONS.find(item => item.id === id);
  if (!lesson) return null;
  const board = requireBoard(boardId);
  if (['pot', 'sensor'].includes(id) && !board.analogPins.length) return null;
  const expected = createStarterCircuit(id, boardId);
  const output = board.outputPins.includes(13) ? 13 : board.outputPins[0];
  const input = board.pullupPins[0], analog = board.analogPins[0];
  const threshold = Math.floor(board.analogMax / 2);
  const programs = {
    led: `pinMode(${output}, OUTPUT);\n// Repeat these two states:\ndigitalWrite(${output}, HIGH);\ndelay(500);\ndigitalWrite(${output}, LOW);\ndelay(500);`,
    button: `pinMode(${input}, INPUT_PULLUP);\n// Released = HIGH. Pressed = LOW.\nint pressed = digitalRead(${input}) == LOW;`,
    pot: `// Turn the knob and read again.\nint reading = analogRead(${analog});\n// Approximate range: 0 to ${board.analogMax}.`,
    sensor: `pinMode(${output}, OUTPUT);\nint reading = analogRead(${analog});\ndigitalWrite(${output}, reading > ${threshold} ? HIGH : LOW);`
  };
  const explanation = {
    led: 'The resistor limits current. Voltage is measured between two points; current needs a closed path back to ground. Try 220 Ω, then 470 Ω and compare the LED current.',
    button: 'The internal pull-up gives the input a defined HIGH when the button is released. Pressing connects it to ground, so pressed means LOW. A floating input is not a reliable OFF.',
    pot: `The knob divides the ${board.voltage} V supply. The ADC maps that voltage to a number from 0 to ${board.analogMax}. Turn it below 25% and above 75% to compare.`,
    sensor: `The sensor reading is compared with ${threshold}. Above the threshold the code turns the LED on; below it the code turns it off. Wiring alone does not implement the decision.`
  };
  const requirements = id === 'button' ? [{id: 'buttonHigh', label: 'Released button reads HIGH'}, {id: 'buttonLow', label: 'Pressed button reads LOW'}]
    : id === 'pot' ? [{id: 'analogLow', label: 'Knob produces a low ADC reading'}, {id: 'analogHigh', label: 'Knob produces a high ADC reading'}]
      : id === 'sensor' ? [{id: 'sensorOff', label: 'Low sensor reading with LED off'}, {id: 'sensorOn', label: 'High sensor reading with LED on'}]
        : [{id: 'ledOn', label: 'LED responds to HIGH'}, {id: 'ledOff', label: 'LED responds to LOW'}];
  return {...lesson, expected, output, input, analog, threshold, board, program: programs[id], explanation: explanation[id], requirements};
}

export function inspectLessonWiring(lesson, circuit, result) {
  if (!lesson || circuit.boardId !== lesson.board.id) return [];
  const partsMatch = lesson.expected.components.every(part => circuit.components.some(actual => actual.id === part.id && actual.type === part.type));
  return lesson.expected.wires.map(wire => ({...wire, connected: partsMatch && Boolean(result?.nets?.[wire.from]) && result.nets[wire.from] === result.nets[wire.to]}));
}

export function measureLesson(lesson, circuit, state) {
  const result = state.circuitResult;
  const wiring = inspectLessonWiring(lesson, circuit, result);
  if (!lesson || !state.enabled || !result?.safe || !wiring.length || !wiring.every(wire => wire.connected)) return [];
  const measured = [], output = state.pins?.find(pin => pin.pin === lesson.output);
  const input = state.pins?.find(pin => pin.pin === lesson.input);
  const led = result.components.led1, button = circuit.components.find(part => part.id === 'button1');
  if (lesson.id === 'led' && output?.mode === 'OUTPUT' && output.kind === 'digital') {
    if (output.value === 1 && led?.lit) measured.push('ledOn');
    if (output.value === 0 && !led?.lit) measured.push('ledOff');
  }
  if (lesson.id === 'button' && input?.mode === 'INPUT_PULLUP') {
    const digital = result.pins[`D${lesson.input}`]?.digital;
    if (button?.params.pressed === false && digital === 1) measured.push('buttonHigh');
    if (button?.params.pressed === true && digital === 0) measured.push('buttonLow');
  }
  const adc = result.pins[analogPort(lesson.analog)]?.analog;
  if (lesson.id === 'pot' && Number.isFinite(adc)) {
    if (adc < lesson.board.analogMax * .25) measured.push('analogLow');
    if (adc > lesson.board.analogMax * .75) measured.push('analogHigh');
  }
  if (lesson.id === 'sensor' && Number.isFinite(adc) && output?.mode === 'OUTPUT' && output.kind === 'digital') {
    if (adc < lesson.threshold && output.value === 0 && !led?.lit) measured.push('sensorOff');
    if (adc > lesson.threshold && output.value === 1 && led?.lit) measured.push('sensorOn');
  }
  return measured;
}

export const DIAGNOSTIC_HELP = Object.freeze({
  'supply-short': 'A wire must not join 5 V or 3.3 V directly to ground, or join the two supplies. Remove the short before testing.',
  'led-resistor-missing': 'Put a resistor in series with the LED. Start with 220 Ω or 330 Ω; a resistor bypassed by a wire does not limit current.',
  'led-overcurrent': 'Increase the series resistance and check for a wire bypassing it. The displayed 20 mA limit is a teaching threshold, not a component guarantee.',
  'gpio-overcurrent': 'Check whether the output goes straight to ground or another output. Use a suitable driver for motors; do not power them from a GPIO.',
  'pin-overvoltage': 'Use the selected board’s logic voltage. ESP32 inputs are modeled at 3.3 V; do not feed them from a 5 V rail.',
  'floating-input': 'Complete the return path. For the button lesson, use INPUT_PULLUP and connect the other button terminal to ground.',
  'led-reversed': 'Connect the LED anode toward the positive side through a resistor, and its cathode toward ground.',
  'resistor-power': 'A resistor dissipates heat. Increase resistance or choose an appropriately rated physical part after checking the real circuit.',
  'component-power': 'A signal wire is not a power supply. Connect the component power and ground terminals too.'
});

import {addStarter} from '../programming/starters.js';
import {requireBoard} from '../hardware/boards.js';
import {validatePythonProject} from '../python/project.js';
import {makeJuniorProject,makeJuniorBlock,parseJuniorProject} from '../junior/model.js';
import {emptyCircuit,createComponent,validateCircuit} from '../circuits/model.js';

export const ACTIVITY_STARTERS = Object.freeze({
  'junior-decisions': {type: 'junior', variant: 'decisions', label: 'Open decision story'},
  'junior-story': {type: 'junior', label: 'Open starter story'},
  'scratch-animation': {type: 'scratch', kind: 'motion', label: 'Open block starter'},
  'star-catch': {type: 'scratch', kind: 'catch', label: 'Open game starter'},
  'quiz-score': {type: 'scratch', kind: 'quiz', label: 'Open quiz starter'},
  'pen-shapes': {type: 'scratch', kind: 'pen', label: 'Open drawing starter'},
  'music-tune': {type: 'scratch', kind: 'music', label: 'Open music starter'},
  'image-detective': {type: 'dataset', mode: 'image', label: 'Open image examples'},
  'text-greetings': {type: 'dataset', mode: 'text', label: 'Open text examples'},
  'python-table': {type: 'python', label: 'Open Python starter'},
  'arduino-led': {type: 'scratch', kind: 'blink', label: 'Open virtual LED starter', circuit: 'led'},
  'board-code-check': {type: 'scratch', kind: 'blink', label: 'Open board code starter', circuit: 'led'},
  'virtual-traffic-light': {type: 'scratch', kind: 'traffic', label: 'Open traffic light starter'}
});

// The complete previous workspace is backed up by App before replacement.
// Reuse existing costume assets, but exclude old scripts/events so Run cannot
// accidentally execute an unrelated hardware or ML program during a lesson.
export function lessonScratch(base, kind, boardId = 'arduino-uno') {
  const stage = base.targets?.find(target => target.isStage);
  const original = base.targets?.find(target => !target.isStage);
  if (!stage || !original) throw new Error('The block editor needs a stage and character before opening a lesson.');
  const reset = target => ({...structuredClone(target), variables: {}, lists: {}, broadcasts: {}, comments: {}, blocks: {}});
  const project = {...structuredClone(base), targets: [reset(stage), {...reset(original), x: 0, y: 0, direction: 90, size: 80, visible: true}], monitors: [], extensions: []};
  if (['motion', 'blink', 'sensor'].includes(kind)) {
    const added = addStarter(project, kind, boardId);
    added.project.targets.splice(1, 1);
    return added;
  }
  const sprite = project.targets[1], blocks = sprite.blocks;
  const titles = {catch: 'Catch me', quiz: 'My first quiz', pen: 'My square pattern', music: 'My first melody', button: 'Button reader', traffic: 'Traffic light'};
  if (!titles[kind]) throw new Error('This lesson starter is not available.');
  sprite.name = titles[kind];
  const n = value => [1, [4, String(value)]], text = value => [1, [10, String(value)]];
  const b = (id, opcode, parent, next, inputs = {}, fields = {}) => blocks[id] = {opcode, parent, next, inputs, fields, shadow: false, topLevel: parent === null, ...(parent === null ? {x: id === 'tap' ? 380 : 40, y: 40} : {})};
  const menu = (id, opcode, parent, field, value) => {b(id, opcode, parent, null, {}, {[field]: [value, null]}); blocks[id].shadow = true;};
  b('start', 'event_whenflagclicked', null, 'first');
  if (kind === 'catch' || kind === 'quiz') {
    project.targets[0].variables.lessonScore = ['score', 0];
    project.monitors=[{id:'lessonScore',mode:'default',opcode:'data_variable',params:{VARIABLE:'score'},spriteName:null,value:0,width:0,height:0,x:5,y:5,visible:true,sliderMin:0,sliderMax:100,isDiscrete:true}];
    b('first', 'data_setvariableto', 'start', kind === 'catch' ? 'repeat' : 'ask', {VALUE: n(0)}, {VARIABLE: ['score', 'lessonScore']});
    if (kind === 'catch') {
      b('repeat', 'control_repeat', 'first', 'result', {TIMES: n(20), SUBSTACK: [2, 'jump']});
      b('jump', 'motion_goto', 'repeat', 'wait', {TO: [1, 'randomMenu']}); menu('randomMenu', 'motion_goto_menu', 'jump', 'TO', '_random_');
      b('wait', 'control_wait', 'jump', null, {DURATION: n(1)});
      b('tap', 'event_whenthisspriteclicked', null, 'score');
      b('score', 'data_changevariableby', 'tap', 'tapJump', {VALUE: n(1)}, {VARIABLE: ['score', 'lessonScore']});
      b('tapJump','motion_goto','score',null,{TO:[1,'tapMenu']});menu('tapMenu','motion_goto_menu','tapJump','TO','_random_');
    } else {
      b('ask', 'sensing_askandwait', 'first', 'if', {QUESTION: text('What is 7 × 8?')});
      b('if', 'control_if_else', 'ask', 'result', {CONDITION: [2, 'equals'], SUBSTACK: [2, 'correct'], SUBSTACK2: [2, 'retry']});
      b('equals', 'operator_equals', 'if', null, {OPERAND1: [3, 'answer', [10, '']], OPERAND2: text('56')});
      b('answer', 'sensing_answer', 'equals', null);
      b('correct', 'data_changevariableby', 'if', null, {VALUE: n(1)}, {VARIABLE: ['score', 'lessonScore']});
      b('retry', 'looks_sayforsecs', 'if', null, {MESSAGE: text('Try seven groups of eight counters.'), SECS: n(2)});
    }
    b('result', 'looks_say', kind === 'catch' ? 'repeat' : 'if', null, {MESSAGE: [3, 'scoreValue', [10, '']]});
    b('scoreValue', 'data_variable', 'result', null, {}, {VARIABLE: ['score', 'lessonScore']});
  } else if (kind === 'pen') {
    project.extensions = ['pen'];
    b('first', 'pen_clear', 'start', 'down'); b('down', 'pen_penDown', 'first', 'repeat');
    b('repeat', 'control_repeat', 'down', 'up', {TIMES: n(4), SUBSTACK: [2, 'move']});
    b('move', 'motion_movesteps', 'repeat', 'turn', {STEPS: n(80)});
    b('turn', 'motion_turnright', 'move', null, {DEGREES: n(90)}); b('up', 'pen_penUp', 'repeat', null);
  } else if (kind === 'music') {
    project.extensions = ['music'];
    b('first', 'music_setTempo', 'start', 'note0', {TEMPO: n(90)});
    [60, 60, 67, 67, 69, 69, 67].forEach((note, i, notes) => b(`note${i}`, 'music_playNoteForBeats', i ? `note${i - 1}` : 'first', i + 1 === notes.length ? null : `note${i + 1}`, {NOTE: n(note), BEATS: n(i === 6 ? .5 : .25)}));
  } else if (kind === 'button') {
    const board = requireBoard(boardId), input = board.pullupPins[0];
    if (input === undefined) throw new Error('This board has no supported pull-up input.');
    project.extensions = ['duetHardware'];
    b('first', 'duetHardware_setPinMode', 'start', 'loop', {PIN: n(input), MODE: text('INPUT_PULLUP')});
    b('loop', 'control_forever', 'first', null, {SUBSTACK: [2, 'say']});
    b('say', 'looks_say', 'loop', 'pause', {MESSAGE: [3, 'read', [10, '']]});
    b('read', 'duetHardware_readDigital', 'say', null, {PIN: n(input)});
    b('pause', 'control_wait', 'say', null, {DURATION: n(.1)});
  } else if (kind === 'traffic') {
    const board = requireBoard(boardId), pins = [13, 12, 11];
    if (pins.some(pin => !board.outputPins.includes(pin))) throw new Error('This traffic lesson needs Arduino Uno pins 13, 12 and 11.');
    project.extensions = ['duetHardware'];
    b('first', 'control_forever', 'start', null, {SUBSTACK: [2, 'on0']});
    pins.forEach((pin, i) => {
      b(`on${i}`, 'duetHardware_digitalWrite', i ? `off${i - 1}` : 'first', `wait${i}`, {PIN: n(pin), VALUE: n(1)});
      b(`wait${i}`, 'control_wait', `on${i}`, `off${i}`, {DURATION: n(i === 1 ? 1 : 3)});
      b(`off${i}`, 'duetHardware_digitalWrite', `wait${i}`, i === 2 ? null : `on${i + 1}`, {PIN: n(pin), VALUE: n(0)});
    });
  }
  return {project, name: sprite.name};
}

export function timesTableStarter() {
  return validatePythonProject({kind: 'duetblox-python', version: 1, name: 'times-table.py', input: '7', code: 'n = int(input("Which table? "))\nfor i in range(1, 11):\n    print(n, "x", i, "=", n * i)\n'});
}

export function trafficCircuit() {
  const circuit=emptyCircuit('arduino-uno');
  ['red','yellow','green'].forEach((color,index)=>{
    const resistor=createComponent('resistor',`trafficR${index}`,{x:450,y:70+index*180});
    const led=createComponent('led',`trafficLED${index}`,{x:760,y:70+index*180});led.params.color=color;
    circuit.components.push(resistor,led);
    [[`board:D${13-index}`,`${resistor.id}:a`],[`${resistor.id}:b`,`${led.id}:anode`],[`${led.id}:cathode`,'board:GND']].forEach(([from,to],i)=>circuit.wires.push({id:`trafficWire${index}${i}`,from,to}));
  });
  return validateCircuit(circuit);
}

export function imageLessonDataset(canvasFactory = () => document.createElement('canvas')) {
  const make = (name, color, circle) => ({id: crypto.randomUUID(), name, samples: Array.from({length: 12}, (_, i) => {
    const canvas = canvasFactory(); canvas.width = canvas.height = 224;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('This browser could not create the example pictures.');
    ctx.fillStyle = '#faf8f0'; ctx.fillRect(0, 0, 224, 224); ctx.fillStyle = color;
    const offset = (i % 4 - 1.5) * 8, size = 56 + i % 3 * 7;
    if (circle) {ctx.beginPath(); ctx.arc(112 + offset, 112 - offset, size, 0, Math.PI * 2); ctx.fill();}
    else ctx.fillRect(112 - size + offset, 112 - size - offset, size * 2, size * 2);
    return canvas.toDataURL('image/jpeg', .9);
  })});
  return {kind: 'duetblox-image-dataset', version: 1, classes: [make('Orange circle', '#e8733b', true), make('Blue square', '#4b81d0', false)]};
}

export function decisionStory() {
  const project=makeJuniorProject();project.title='Two ways for Fox';
  const loop=makeJuniorBlock('forever'),decision=makeJuniorBlock('ifElse');
  decision.condition={kind:'keyPressed',key:'space'};
  decision.children=[{...makeJuniorBlock('right'),value:1}];
  decision.elseChildren=[{...makeJuniorBlock('left'),value:1}];
  loop.children=[decision,{...makeJuniorBlock('wait'),value:.2}];
  project.scenes[0].sprites[0].scripts[0].blocks=[loop];
  return parseJuniorProject(project);
}

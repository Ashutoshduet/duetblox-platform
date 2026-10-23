import {requireBoard, validatePin} from './boards.js';
import {runtimeSource} from './runtime-source.js';
import {portableNumbersModel, numbersRuntimeSource} from './numbers-codegen.js';
import {procedureSignature, validateProcedureCall} from './scratch-procedures.js';

const binaryOps = {add: '+', subtract: '-', multiply: '*', lt: '<', gt: '>', eq: '==', and: '&&', or: '||'};
const numeric = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));
const diagnostic = (code, message, blockId) => ({severity: 'error', code, message, ...(blockId ? {blockId} : {})});

/** Compile the documented numeric portable IR. Fails closed: no downloadable code when any error exists. */
export function generateArduino(ir, {boardId = 'arduino-uno', name = 'DuetBloxProject'} = {}) {
  const diagnostics = [];
  let board;
  try { board = requireBoard(boardId, 'export'); } catch (error) { return {ok: false, code: '', filename: '', diagnostics: [diagnostic('BOARD', error.message)]}; }
  if (!ir || ir.version !== 1 || !Array.isArray(ir.setup) || !Array.isArray(ir.loop)) {
    return {ok: false, code: '', filename: '', diagnostics: [diagnostic('IR', 'Expected portable program version 1 with setup and loop arrays.')]};
  }
  let usesNumbers = false; let numbersModel = null;
  const variables = new Map(); const procedures = new Map(); const callGraph = new Map();
  const servoPins = new Set(); const pwmPins = new Set(); let usesTone = false; let usesBoolean = false; let loopIndex = 0; let callIndex = 0; let nodes = 0;
  const error = (code, message, node) => { diagnostics.push(diagnostic(code, message, node?.blockId)); return '0'; };
  for (const variable of ir.variables || []) {
    if (!variable || typeof variable.id !== 'string' || variables.has(variable.id)) { error('VARIABLE', 'Variable identifiers must be unique strings.'); continue; }
    if (!numeric(variable.initial ?? 0)) { error('VARIABLE_TYPE', `Variable ${variable.name || variable.id} must have a numeric initial value.`); continue; }
    variables.set(variable.id, {symbol: `duetVar${variables.size}`, initial: Number(variable.initial ?? 0)});
  }
  if (ir.procedures !== undefined && (!Array.isArray(ir.procedures) || ir.procedures.length > 64)) error('PROCEDURES', 'Upload supports at most 64 procedure definitions.');
  for (const procedure of Array.isArray(ir.procedures) ? ir.procedures.slice(0, 64) : []) {
    if (!procedure || typeof procedure.id !== 'string' || !procedure.id || procedures.has(procedure.id)) { error('PROCEDURE', 'Procedure IDs must be unique, nonempty strings.', procedure); continue; }
    if (!Array.isArray(procedure.parameters) || procedure.parameters.length > 32 || !Array.isArray(procedure.body)) { error('PROCEDURE', 'Procedure definitions need a body and at most 32 inputs.', procedure); continue; }
    const parameters = new Map();
    for (const parameter of procedure.parameters) {
      if (!parameter || typeof parameter.id !== 'string' || !parameter.id || parameters.has(parameter.id) || !['number', 'boolean'].includes(parameter.type)) { error('PARAMETER', 'Procedure inputs must have unique IDs and number or boolean types.', procedure); continue; }
      parameters.set(parameter.id, {...parameter, symbol: `duetParam${parameters.size}`});
    }
    procedures.set(procedure.id, {...procedure, symbol: `duetProcedure${procedures.size}`, parameters});
    callGraph.set(procedure.id, new Set());
  }
  const requireNumbers = node => { usesNumbers = true; if (numbersModel) return numbersModel; try { numbersModel = portableNumbersModel(ir.numbersModel); return numbersModel; } catch (cause) { error('NUMBERS_MODEL', `Train or import a valid numbers model before uploading: ${cause.message}`, node); return null; } };
  const variableName = node => variables.get(node.id)?.symbol ?? error('VARIABLE', `Unknown variable ${node.id}.`, node);
  const pin = (value, kind, node) => {
    try { return String(validatePin(board, value, kind)); }
    catch (cause) { return error('PIN', cause.message, node); }
  };
  const exprType = (value, scope) => {
    if (typeof value === 'boolean') return 'boolean';
    if (value?.op === 'parameter') return scope?.get(value.id)?.type;
    if (['lt', 'gt', 'eq', 'and', 'or', 'not', 'numbersIsReady', 'numbersIsAccepted'].includes(value?.op)) return 'boolean';
    return 'number';
  };
  const expr = (value, depth = 0, scope = null) => {
    if (++nodes > 10000 || depth > 64) return error('COMPLEXITY', 'Program exceeds the supported expression complexity.', value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (numeric(value)) return Number(value).toString();
    if (!value || typeof value !== 'object') return error('EXPRESSION', 'Expected a finite number or supported numeric expression.', value);
    if (value.op?.startsWith('numbers')) { const model = requireNumbers(value); const reporters = {numbersInputCount: String(model?.features.length || 0), numbersValue: 'duetNumbersValue', numbersClassIndex: 'duetNumbersClassIndex', numbersConfidence: 'duetNumbersConfidence', numbersIsReady: 'true', numbersIsAccepted: 'duetNumbersAccepted'}; return reporters[value.op] ?? error('NUMBERS_REPORTER', 'Only numeric and Boolean numbers-model reporters can run on a board; use class index instead of a text label.', value); }
    if (value.op === 'variable') return variableName(value);
    if (value.op === 'parameter') return scope?.get(value.id)?.symbol ?? error('PARAMETER_SCOPE', 'This input is not defined by the current My Blocks procedure.', value);
    const child = input => expr(input, depth + 1, scope);
    if (value.op === 'readAnalog') return `analogRead(${pin(value.pin, 'analog', value)})`;
    if (value.op === 'readDigital') return `digitalRead(${pin(value.pin, 'digital', value)})`;
    if (value.op === 'not') { usesBoolean = true; return `(!duetBoolean(${child(value.value)}))`; }
    if (value.op === 'and' || value.op === 'or') {
      usesBoolean = true;
      // Scratch evaluates both reporter inputs before its Boolean primitive;
      // C++ &&/|| alone would incorrectly skip a random/sensor input.
      return `([&]() { const double duetLeft = ${child(value.left)}; const double duetRight = ${child(value.right)}; return duetBoolean(duetLeft) ${binaryOps[value.op]} duetBoolean(duetRight); }())`;
    }
    if (value.op === 'round') return `floor((${child(value.value)}) + 0.5)`;
    if (value.op === 'random') return `duetRandom(${child(value.left)}, ${child(value.right)})`;
    if (value.op === 'map') {
      if (numeric(value.inMin) && numeric(value.inMax) && Number(value.inMin) === Number(value.inMax)) error('MAP_RANGE', 'Map input range must have different endpoints.', value);
      return `duetMap(${['value','inMin','inMax','outMin','outMax'].map(key=>child(value[key])).join(', ')})`;
    }
    if (value.op === 'divide') return `duetDivide(${child(value.left)}, ${child(value.right)})`;
    if (value.op === 'mod') return `duetMod(${child(value.left)}, ${child(value.right)})`;
    if (binaryOps[value.op]) return `((${child(value.left)}) ${binaryOps[value.op]} (${child(value.right)}))`;
    return error('UNSUPPORTED_EXPRESSION', `Unsupported expression: ${value.op || 'unknown'}.`, value);
  };
  const body = (statements, level = 1, scope = null, currentProcedure = null) => {
    if (!Array.isArray(statements)) { error('BODY', 'Control block body must be an array.'); return ''; }
    if (level > 64) { error('COMPLEXITY', 'Program nesting exceeds 64 levels.'); return ''; }
    return statements.map(node => {
      if (++nodes > 10000) { error('COMPLEXITY', 'Program exceeds 10,000 nodes.', node); return ''; }
      if (!node || typeof node !== 'object') { error('STATEMENT', 'Malformed statement.'); return ''; }
      const pad = '  '.repeat(level); const p = kind => pin(node.pin, kind, node);
      const e = value => expr(value, 0, scope);
      const condition = value => {
        if (exprType(value, scope) === 'boolean') return e(value);
        usesBoolean = true; return `duetBoolean(${e(value)})`;
      };
      const wrap = (header, children, yielding = false) => `${pad}${header} {\n${body(children, level + 1, scope, currentProcedure)}${yielding ? `${pad}  duetYield();\n` : ''}${pad}}\n`;
      switch (node.op) {
      case 'numbersSetInput': { const model = requireNumbers(node); if (!numeric(node.index) || !Number.isInteger(Number(node.index)) || Number(node.index) < 1 || Number(node.index) > (model?.features.length || 0)) { error('NUMBERS_INPUT', 'Choose a constant input index from 1 to the model feature count for board upload.', node); return ''; } return `${pad}duetNumbersSetInput(${Number(node.index)}, ${e(node.value)});\n`; }
      case 'numbersPredict': requireNumbers(node); return `${pad}duetNumbersPredict();\n`;
      case 'setPinMode':
        if (!['INPUT', 'INPUT_PULLUP', 'OUTPUT'].includes(node.mode)) { error('MODE', 'Invalid pin mode.', node); return ''; }
        return `${pad}duetSetPinMode(${p(node.mode === 'OUTPUT' ? 'output' : node.mode === 'INPUT_PULLUP' ? 'pullup' : 'digital')}, ${node.mode});\n`;
      case 'digitalWrite':
        if (numeric(node.value) && ![0, 1].includes(Number(node.value))) error('VALUE', 'Digital output must be 0 or 1.', node);
        return `${pad}duetDigitalWrite(${p('output')}, ${e(node.value)});\n`;
      case 'analogWrite':
        if (numeric(node.value) && (!Number.isInteger(Number(node.value)) || Number(node.value) < 0 || Number(node.value) > 255)) error('VALUE', 'PWM output must be an integer from 0 to 255.', node);
        pwmPins.add(Number(node.pin));
        return `${pad}duetAnalogWrite(${p('pwm')}, ${e(node.value)});\n`;
      case 'servoWrite':
        if (numeric(node.angle) && (!Number.isInteger(Number(node.angle)) || Number(node.angle)<0 || Number(node.angle)>180)) error('VALUE', 'Servo angle must be an integer from 0 to 180.', node);
        servoPins.add(Number(node.pin));
        return `${pad}duetServoWrite(${p('output')}, ${e(node.angle)});\n`;
      case 'servoDetach': return `${pad}duetServoDetach(${p('output')});\n`;
      case 'tone':
        usesTone=true;
        if (numeric(node.frequency) && (!Number.isInteger(Number(node.frequency)) || Number(node.frequency)<31 || Number(node.frequency)>20000)) error('VALUE', 'Tone frequency must be an integer from 31 to 20000 Hz.', node);
        if (numeric(node.seconds) && (Number(node.seconds)<0 || Number(node.seconds)>3600)) error('VALUE', 'Tone duration must be from 0 to 3600 seconds.', node);
        return `${pad}duetTone(${p('output')}, ${e(node.frequency)}, ${e(node.seconds)});\n`;
      case 'noTone': return `${pad}duetNoTone(${p('output')});\n`;
      case 'wait': return `${pad}duetWait(${e(node.seconds)});\n`;
      case 'setVariable': return `${pad}${variableName(node)} = ${e(node.value)};\n`;
      case 'changeVariable': return `${pad}${variableName(node)} += ${e(node.value)};\n`;
      case 'call': {
        const procedure = procedures.get(node.id);
        if (!procedure) { error('PROCEDURE', `Unknown My Blocks procedure ${node.id}.`, node); return ''; }
        if (!Array.isArray(node.arguments) || node.arguments.length !== procedure.parameters.size) { error('ARGUMENTS', 'My Blocks call must supply one value for every input.', node); return ''; }
        if (currentProcedure) callGraph.get(currentProcedure).add(node.id);
        const index = callIndex++, names = [];
        // C++ does not guarantee left-to-right function argument evaluation. Separate
        // statements preserve Scratch's input order, including random/sensor reporters.
        const values = [...procedure.parameters.values()].map((parameter, position) => {
          const value = node.arguments[position], type = exprType(value, scope);
          if (type !== parameter.type) error('ARGUMENT_TYPE', `My Blocks input ${parameter.name || position + 1} needs a ${parameter.type} expression.`, node);
          const name = `duetArg${index}_${position}`; names.push(name);
          return `${pad}  const ${parameter.type === 'boolean' ? 'bool' : 'double'} ${name} = ${e(value)};\n`;
        }).join('');
        return `${pad}{\n${values}${pad}  ${procedure.symbol}(${names.join(', ')});\n${pad}}\n`;
      }
      case 'repeat': {
        const i = loopIndex++;
        return `${pad}const unsigned long duetCount${i} = duetRepeat(${e(node.times)});\n` + wrap(`for (unsigned long duetI${i} = 0; duetI${i} < duetCount${i}; ++duetI${i})`, node.body, true);
      }
      case 'forever': return wrap('while (true)', node.body, true);
      case 'waitUntil': return wrap(`while (!(${condition(node.condition)}))`, [], true);
      case 'repeatUntil': return wrap(`while (!(${condition(node.condition)}))`, node.body, true);
      case 'if': return wrap(`if (${condition(node.condition)})`, node.then || []) + (node.else?.length ? wrap('else', node.else) : '');
      default: error('UNSUPPORTED_STATEMENT', `Unsupported statement: ${node.op || 'unknown'}.`, node); return '';
      }
    }).join('');
  };
  const setup = body(ir.setup), loop = body(ir.loop);
  const signature = procedure => `void ${procedure.symbol}(${[...procedure.parameters.values()].map(parameter => `${parameter.type === 'boolean' ? 'bool' : 'double'} ${parameter.symbol}`).join(', ')})`;
  const procedureCode = [...procedures.values()].map(procedure => `${signature(procedure)} {\n${body(procedure.body, 1, procedure.parameters, procedure.id)}}\n`).join('\n');
  const checked = new Set(), active = new Set();
  const checkCalls = id => {
    if (active.has(id)) { error('RECURSION', 'Recursive My Blocks calls are not supported on these boards; use a bounded repeat instead.', procedures.get(id)); return; }
    if (checked.has(id)) return;
    active.add(id);
    for (const called of callGraph.get(id) || []) checkCalls(called);
    active.delete(id); checked.add(id);
  };
  for (const id of procedures.keys()) checkCalls(id);
  if (servoPins.size > board.servoSlots) error('SERVO_LIMIT', `This adapter permits at most ${board.servoSlots} distinct servo pins in one uploaded program.`);
  if (board.core === 'esp32:esp32' && pwmPins.size > 8) error('PWM_LIMIT', 'This adapter permits at most 8 distinct PWM pins in one uploaded program.');
  for (const p of pwmPins) {
    if (servoPins.size && board.pwmServoConflict.includes(p)) error('TIMER_CONFLICT', `PWM pin ${p} shares a timer with Servo on ${board.name}. Choose another PWM pin.`);
    if (usesTone && board.pwmToneConflict.includes(p)) error('TIMER_CONFLICT', `PWM pin ${p} shares a timer with tone on ${board.name}. Choose another PWM pin.`);
  }
  if (diagnostics.length) return {ok: false, code: '', filename: '', diagnostics};
  const safeName = String(name).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 48) || 'DuetBloxProject';
  const code = `// Generated by DUETBlox — numeric portable subset\n// Target: ${board.name} (${board.fqbn})\n// Build/flash validation on physical hardware is still required.\n` + runtimeSource(board) + '\n' + (usesNumbers ? numbersRuntimeSource(numbersModel) : '') +
    (usesBoolean ? 'static bool duetBoolean(double value) { return value != 0 && !isnan(value); }\n' : '') +
    [...variables.values()].map(v => `double ${v.symbol} = ${v.initial};\n`).join('') +
    [...procedures.values()].map(procedure => `${signature(procedure)};\n`).join('') + '\n' + procedureCode +
    `\nvoid setup() {\n  duetBegin();\n${setup}}\n\nvoid loop() {\n${loop}  duetYield();\n}\n`;
  return {ok: true, code, filename: `${safeName}.ino`, diagnostics, boardId, fqbn: board.fqbn};
}

const scratchBinary = {
  operator_add: ['add','NUM1','NUM2'], operator_subtract: ['subtract','NUM1','NUM2'],
  operator_multiply: ['multiply','NUM1','NUM2'], operator_divide: ['divide','NUM1','NUM2'],
  operator_mod: ['mod','NUM1','NUM2'], operator_lt: ['lt','OPERAND1','OPERAND2'],
  operator_gt: ['gt','OPERAND1','OPERAND2'], operator_equals: ['eq','OPERAND1','OPERAND2'],
  operator_and: ['and','OPERAND1','OPERAND2'], operator_or: ['or','OPERAND1','OPERAND2']
};

/** Read an actual Scratch project.json. No silent conversion of concurrent scripts. */
export function scratchProjectToIR(project) {
  const diagnostics = []; const usedVariables = new Map();
  const fail = (code, message, blockId) => { diagnostics.push(diagnostic(code, message, blockId)); return 0; };
  if (!project || !Array.isArray(project.targets)) return {ir: null, diagnostics: [diagnostic('PROJECT', 'Expected Scratch project.json with targets.')]};
  const roots = [];
  for (const target of project.targets) {
    for (const [id, block] of Object.entries(target.blocks || {})) {
      if (block.topLevel && !block.shadow && ['event_whenflagclicked', 'duetHardware_whenBoardStarts'].includes(block.opcode)) roots.push({id, block, target});
      else if (block.topLevel && !block.shadow && (/_when/.test(block.opcode) || block.opcode === 'control_start_as_clone')) fail('EVENT', `Upload does not support the ${block.opcode} event.`, id);
    }
  }
  if (roots.length !== 1) fail('ENTRY', roots.length ? 'Upload requires exactly one start script. Parallel Scratch scripts cannot be silently compiled as sequential Arduino code.' : 'Add one “when board starts” or green flag script before exporting.');
  if (diagnostics.length) return {ir: null, diagnostics};
  const {target, block: root} = roots[0]; const blocks = target.blocks || {}; let visitedCount = 0;
  const definitions = new Map(), usedProcedures = new Map();
  for (const [id, block] of Object.entries(blocks)) {
    if (block.opcode !== 'procedures_definition') continue;
    const prototype = blocks[block.inputs?.custom_block?.[1]];
    const code = prototype?.mutation?.proccode;
    if (typeof code === 'string') definitions.set(code, [...(definitions.get(code) || []), {id, block}]);
  }
  const resolveProcedure = (code, blockId) => {
    if (typeof code !== 'string' || !definitions.has(code)) { fail('PROCEDURE_MISSING', 'This My Blocks call has no definition in the same sprite.', blockId); return null; }
    const candidates = definitions.get(code);
    if (candidates.length !== 1) { fail('PROCEDURE_DUPLICATE', 'More than one My Blocks definition has this signature.', blockId); return null; }
    const {id, block} = candidates[0];
    if (usedProcedures.has(id)) return usedProcedures.get(id);
    if (usedProcedures.size >= 64) { fail('COMPLEXITY', 'Upload supports at most 64 used My Blocks definitions.', blockId); return null; }
    try {
      const definition = procedureSignature(id, block, blocks);
      definition.blockId = id;
      usedProcedures.set(id, definition);
      return definition;
    } catch (error) { fail('PROCEDURE_SIGNATURE', error.message, blockId); return null; }
  };
  const variable = (id, blockId) => {
    const globals = project.targets.find(t => t.isStage)?.variables || {}, locals = target.variables || {};
    const value = Object.hasOwn(locals, id) ? locals[id] : Object.hasOwn(globals, id) ? globals[id] : null;
    if (!Array.isArray(value) || value.length < 2) { fail('VARIABLE', `Variable ${id} cannot be found.`, blockId); return id; }
    if (!usedVariables.has(id)) usedVariables.set(id, {id, name: value[0], initial: value[1]});
    return id;
  };
  const rawInput = (block, name) => {
    const input = block.inputs?.[name];
    if (!input) return null;
    return input[1] ?? input[2] ?? null;
  };
  const literal = (input, blockId) => {
    if (Array.isArray(input)) {
      if ([4,5,6,7,8,9,10].includes(input[0])) return input[1];
      return fail('LITERAL', 'Expected a constant pin or mode.', blockId);
    }
    if (typeof input === 'string' && blocks[input]) {
      const menu = blocks[input];
      if (menu.shadow && /^duetHardware_menu_/.test(menu.opcode)) return Object.values(menu.fields || {})[0]?.[0];
      return fail('CONSTANT', 'Board pins and modes must be constants for upload.', blockId);
    }
    return input;
  };
  const expression = (input, ancestors = new Set(), scope = null) => {
    if (++visitedCount > 10000) return fail('COMPLEXITY', 'Project exceeds 10,000 visited blocks.');
    if (input === null) return 0;
    if (Array.isArray(input)) {
      if (input[0] === 12) return {op: 'variable', id: variable(input[2])};
      if ([4,5,6,7,8,9,10].includes(input[0])) {
        if (input[1] === '') return 0;
        if (!numeric(input[1])) return fail('TEXT', 'Upload supports numeric expressions only; text/list expressions require a separate runtime.');
        return Number(input[1]);
      }
      return fail('EXPRESSION', 'Unsupported Scratch input encoding.');
    }
    const block = blocks[input];
    if (!block) return fail('MISSING_BLOCK', `Missing expression block ${input}.`, input);
    if (ancestors.has(input) || ancestors.size > 64) return fail('CYCLE', 'Cyclic or excessively nested block graph.', input);
    const next = new Set(ancestors).add(input); const arg = name => expression(rawInput(block, name), next, scope);
    if (['argument_reporter_string_number', 'argument_reporter_boolean'].includes(block.opcode)) {
      const name = block.fields?.VALUE?.[0];
      const parameter = scope?.parameters.find(parameter => parameter.name === name);
      if (!parameter) return fail('PARAMETER_SCOPE', 'This My Blocks input is outside its definition or has an unknown name.', input);
      if ((block.opcode === 'argument_reporter_boolean') !== (parameter.type === 'boolean')) return fail('PARAMETER_TYPE', 'My Blocks input shape does not match its definition.', input);
      return {op: 'parameter', id: parameter.id, blockId: input};
    }
    if (scratchBinary[block.opcode]) {
      const [op,a,b] = scratchBinary[block.opcode]; return {op, left: arg(a), right: arg(b), blockId: input};
    }
    if (block.opcode.startsWith('duetNumbers_')) { const reporter = {inputCount:'numbersInputCount', value:'numbersValue', classIndex:'numbersClassIndex', confidence:'numbersConfidence', isReady:'numbersIsReady', isAccepted:'numbersIsAccepted'}[block.opcode.slice('duetNumbers_'.length)]; if (!reporter) return fail('NUMBERS_REPORTER', 'This numbers reporter cannot be uploaded. Use numeric class index instead of text labels.', input); return {op:reporter,blockId:input}; }
    if (block.opcode === 'operator_not') return {op: 'not', value: arg('OPERAND'), blockId: input};
    if (block.opcode === 'operator_round') return {op:'round',value:arg('NUM'),blockId:input};
    if (block.opcode === 'operator_random') return {op:'random',left:arg('FROM'),right:arg('TO'),blockId:input};
    if (block.opcode === 'duetHardware_map') return {op:'map',value:arg('VALUE'),inMin:arg('IN_MIN'),inMax:arg('IN_MAX'),outMin:arg('OUT_MIN'),outMax:arg('OUT_MAX'),blockId:input};
    if (block.opcode === 'data_variable') return {op: 'variable', id: variable(block.fields?.VARIABLE?.[1], input), blockId: input};
    if (['duetHardware_readAnalog','duetHardware_readDigital'].includes(block.opcode)) return {op: block.opcode.slice('duetHardware_'.length), pin: literal(rawInput(block, 'PIN'), input), blockId: input};
    return fail('UNSUPPORTED_BLOCK', `Upload does not support ${block.opcode}.`, input);
  };
  const chain = (id, ancestors = new Set(), scope = null) => {
    const statements = []; const seen = new Set(ancestors);
    while (id) {
      if (++visitedCount > 10000 || seen.size > 10000) { fail('COMPLEXITY', 'Project exceeds supported block count.', id); break; }
      if (seen.has(id)) { fail('CYCLE', 'Cyclic block graph.', id); break; }
      seen.add(id); const block = blocks[id];
      if (!block) { fail('MISSING_BLOCK', `Missing block ${id}.`, id); break; }
      if (ancestors.size > 64) { fail('COMPLEXITY', 'Program nesting exceeds 64 levels.', id); break; }
      const arg = name => expression(rawInput(block, name), new Set(), scope);
      const nested = name => chain(rawInput(block, name), new Set(ancestors).add(id), scope);
      const node = {blockId: id};
      switch (block.opcode) {
      case 'duetNumbers_setInput': Object.assign(node,{op:'numbersSetInput',index:literal(rawInput(block,'INDEX'),id),value:arg('VALUE')});break;
      case 'duetNumbers_predict': Object.assign(node,{op:'numbersPredict'});break;
      case 'duetHardware_setPinMode': Object.assign(node, {op: 'setPinMode', pin: literal(rawInput(block,'PIN'),id), mode: literal(rawInput(block,'MODE'),id)}); break;
      case 'duetHardware_digitalWrite':
      case 'duetHardware_analogWrite': Object.assign(node, {op: block.opcode.slice('duetHardware_'.length), pin: literal(rawInput(block,'PIN'),id), value: arg('VALUE')}); break;
      case 'duetHardware_servoWrite': Object.assign(node,{op:'servoWrite',pin:literal(rawInput(block,'PIN'),id),angle:arg('ANGLE')});break;
      case 'duetHardware_servoDetach':
      case 'duetHardware_noTone': Object.assign(node,{op:block.opcode.slice('duetHardware_'.length),pin:literal(rawInput(block,'PIN'),id)});break;
      case 'duetHardware_tone': Object.assign(node,{op:'tone',pin:literal(rawInput(block,'PIN'),id),frequency:arg('FREQUENCY'),seconds:arg('DURATION')});break;
      case 'control_wait': Object.assign(node, {op: 'wait', seconds: arg('DURATION')}); break;
      case 'control_repeat': Object.assign(node, {op: 'repeat', times: arg('TIMES'), body: nested('SUBSTACK')}); break;
      case 'control_forever': Object.assign(node, {op: 'forever', body: nested('SUBSTACK')}); break;
      case 'control_wait_until': Object.assign(node,{op:'waitUntil',condition:arg('CONDITION')});break;
      case 'control_repeat_until': Object.assign(node,{op:'repeatUntil',condition:arg('CONDITION'),body:nested('SUBSTACK')});break;
      case 'control_if':
      case 'control_if_else': Object.assign(node, {op: 'if', condition: arg('CONDITION'), then: nested('SUBSTACK'), else: block.opcode === 'control_if_else' ? nested('SUBSTACK2') : []}); break;
      case 'data_setvariableto':
      case 'data_changevariableby': Object.assign(node, {op: block.opcode === 'data_setvariableto' ? 'setVariable' : 'changeVariable', id: variable(block.fields?.VARIABLE?.[1], id), value: arg('VALUE')}); break;
      case 'procedures_call': {
        const procedure = resolveProcedure(block.mutation?.proccode, id);
        if (!procedure) break;
        try { validateProcedureCall(block, procedure); }
        catch (error) { fail('PROCEDURE_CALL', error.message, id); break; }
        const values = procedure.parameters.map(parameter => {
          const input = rawInput(block, parameter.id);
          if (input === null) {
            if (parameter.type === 'boolean' && typeof parameter.default === 'boolean') return parameter.default;
            if (parameter.type === 'number' && numeric(parameter.default)) return Number(parameter.default);
            return fail('ARGUMENT_DEFAULT', 'Set an explicit numeric or Boolean value for this My Blocks input; text defaults cannot be uploaded.', id);
          }
          // A number/text slot is deliberately numeric in this embedded subset.
          // Do not silently turn the empty string into zero at a call boundary.
          if (Array.isArray(input) && [4, 5, 6, 7, 8, 9, 10].includes(input[0]) && parameter.type === 'number' && !numeric(input[1])) return fail('TEXT', 'My Blocks upload supports numeric inputs only; replace this text input with a number.', id);
          return expression(input, new Set(), scope);
        });
        Object.assign(node, {op: 'call', id: procedure.id, arguments: values});
        break;
      }
      default: fail('UNSUPPORTED_BLOCK', `Upload does not support ${block.opcode}.`, id);
      }
      if (node.op) statements.push(node);
      if (block.opcode === 'control_forever' && block.next) fail('UNREACHABLE', 'Blocks after forever can never execute.', id);
      id = block.next;
    }
    return statements;
  };
  const setup = chain(root.next); let loop = [];
  if (setup.at(-1)?.op === 'forever') loop = setup.pop().body;
  // Map iteration includes newly discovered callees. Each body is parsed once,
  // so recursive graphs terminate here and are diagnosed by generateArduino.
  for (const procedure of usedProcedures.values()) procedure.body = chain(procedure.next, new Set(), procedure);
  const procedures = [...usedProcedures.values()].map(({id, code, parameters, body, blockId}) => ({id, name: code, parameters: parameters.map(({id, name, type}) => ({id, name, type})), body, blockId}));
  const ir = {version: 1, ...(project.duetbloxModels?.numbers ? {numbersModel: project.duetbloxModels.numbers} : {}), variables: [...usedVariables.values()], setup, loop, procedures};
  return {ir: diagnostics.length ? null : ir, diagnostics};
}

export function exportArduino(project, options = {}) {
  if (project?.version === 1 && Array.isArray(project.setup)) return generateArduino(project, options);
  const {ir, diagnostics} = scratchProjectToIR(project);
  if (!ir) return {ok: false, code: '', filename: '', diagnostics};
  return generateArduino(ir, options);
}

export const arduinoCapabilities = Object.freeze({
  numericVariables: true, numericBooleanProcedures: true, recursiveProcedures: false,
  lists: false, text: false, concurrentScripts: false, stageMedia: false, onboardML: true, onboardNumericML: true, onboardImageSoundPoseML: false,
  maxProcedures: 64, maxProcedureInputs: 32,
  summary: 'One start script; numeric variables, conditions, loops, GPIO/PWM/servo/tone, and nonrecursive My Blocks with numeric or Boolean inputs. Pins stay constant. Trained numerical classification/regression can run on board with fixed feature indices. No lists, text, parallel scripts, stage graphics, or onboard image/sound/pose ML.'
});

/** Pure, fail-closed preflight for UI. No compilation, connection or generated-code download. */
export function preflightArduino(project, options = {}) {
  const parsed = project?.version === 1 && Array.isArray(project.setup)
    ? {ir: project, diagnostics: []} : scratchProjectToIR(project);
  const result = parsed.ir ? generateArduino(parsed.ir, options) : {ok: false, diagnostics: parsed.diagnostics};
  return {ok: result.ok, diagnostics: result.diagnostics, boardId: options.boardId || 'arduino-uno',
    procedureCount: parsed.ir?.procedures?.length || 0, capabilities: arduinoCapabilities};
}

export function downloadArduino(result) {
  if (!result?.ok || !result.code) throw new Error('Fix export diagnostics before downloading code.');
  const url = URL.createObjectURL(new Blob([result.code], {type: 'text/plain'}));
  const a = document.createElement('a'); a.href = url; a.download = result.filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

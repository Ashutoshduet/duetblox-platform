import test from 'node:test';
import assert from 'node:assert/strict';
import {exportArduino, generateArduino, scratchProjectToIR, preflightArduino, arduinoCapabilities} from '../generator.js';
import {boardRegistry} from '../boards.js';
import {procedureProject, literalInput} from './procedure-fixtures.mjs';

const blocksOf = project => project.targets[1].blocks;
const expectFailure = (project, code) => {
  const result = exportArduino(project);
  assert.equal(result.ok, false); assert.equal(result.code, '');
  assert.ok(result.diagnostics.some(item => item.code === code), JSON.stringify(result.diagnostics));
};

test('real Scratch My Blocks compile with numeric/Boolean inputs, nested scopes and forward declarations', () => {
  const project = procedureProject();
  const parsed = scratchProjectToIR(project);
  assert.equal(parsed.ir.procedures.length, 2);
  assert.deepEqual(parsed.ir.procedures[0].parameters.map(item => item.type), ['number', 'boolean']);
  assert.equal(parsed.ir.procedures[1].parameters[0].name, 'amount');
  for (const board of boardRegistry.filter(board => board.export)) {
    const result = exportArduino(project, {boardId: board.id});
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.match(result.code, /void duetProcedure0\(double duetParam0, bool duetParam1\);/);
    assert.match(result.code, /void duetProcedure1\(double duetParam0\);/);
    assert.ok(result.code.indexOf('void duetProcedure1(double duetParam0);') < result.code.indexOf('void duetProcedure0(double duetParam0, bool duetParam1) {'));
    assert.match(result.code, /duetVar1 \+= duetParam0/);
  }
});

test('call arguments are evaluated once in separate ordered statements, not C++ argument order', () => {
  const result = generateArduino({version: 1, setup: [{op: 'call', id: 'pair', arguments: [
    {op: 'random', left: 1, right: 10}, {op: 'random', left: 20, right: 30}]}], loop: [],
  procedures: [{id: 'pair', parameters: [{id: 'a', type: 'number'}, {id: 'b', type: 'number'}], body: []}]});
  assert.equal(result.ok, true);
  assert.match(result.code, /const double duetArg0_0 = duetRandom\(1, 10\);\n    const double duetArg0_1 = duetRandom\(20, 30\);\n    duetProcedure0\(duetArg0_0, duetArg0_1\);/);
});

test('Boolean reporters evaluate both inputs and use Scratch numeric truthiness', () => {
  const result = generateArduino({version: 1, setup: [{op: 'if', condition: {op: 'and', left: false, right: {op: 'gt', left: {op: 'random', left: 1, right: 10}, right: 0}}, then: []},
    {op: 'if', condition: {op: 'not', value: {op: 'divide', left: 0, right: 0}}, then: []}], loop: []});
  assert.equal(result.ok, true);
  assert.match(result.code, /const double duetLeft = false; const double duetRight = .*duetRandom/);
  assert.match(result.code, /return value != 0 && !isnan\(value\)/);
  assert.match(result.code, /!duetBoolean\(duetDivide\(0, 0\)\)/);
});

test('recursive and mutually recursive procedures fail closed with a specific diagnostic', () => {
  const project = procedureProject(), blocks = blocksOf(project);
  blocks.innerDefinition.next = 'recursive';
  blocks.recursive = structuredClone(blocks.callInnerLast);
  expectFailure(project, 'RECURSION');
  blocks.recursive = structuredClone(blocks.callOuter1); blocks.recursive.next = null;
  expectFailure(project, 'RECURSION');
});

test('procedure parameters never leak into another definition or the main script', () => {
  const root = procedureProject(); blocksOf(root).callInnerLast.inputs.innerAmount = [2, 'innerAmountReporter'];
  expectFailure(root, 'PARAMETER_SCOPE');
  const callee = procedureProject(); blocksOf(callee).innerAmountReporter.fields.VALUE = ['enabled', null];
  expectFailure(callee, 'PARAMETER_SCOPE');
  const shape = procedureProject(); blocksOf(shape).innerAmountReporter.opcode = 'argument_reporter_boolean';
  expectFailure(shape, 'PARAMETER_TYPE');
});

test('text/list inputs, wrong argument types and empty number/text defaults are rejected', () => {
  for (const value of ['hello', '']) {
    const project = procedureProject(); blocksOf(project).callInnerLast.inputs.innerAmount = literalInput(value);
    expectFailure(project, 'TEXT');
  }
  const list = procedureProject(); blocksOf(list).callInnerLast.inputs.innerAmount = [3, [13, 'items', 'list-id'], [4, '0']];
  expectFailure(list, 'EXPRESSION');
  const boolean = procedureProject(); blocksOf(boolean).callInnerLast.inputs.innerAmount = [2, 'yes'];
  expectFailure(boolean, 'ARGUMENT_TYPE');
  const numeric = procedureProject(); blocksOf(numeric).callOuter1.inputs.outerEnabled = literalInput(1);
  expectFailure(numeric, 'ARGUMENT_TYPE');
  const missing = procedureProject(); delete blocksOf(missing).callInnerLast.inputs.innerAmount;
  expectFailure(missing, 'ARGUMENT_DEFAULT');
});

test('Boolean defaults and explicit numeric defaults follow definition metadata', () => {
  const project = procedureProject(), blocks = blocksOf(project);
  delete blocks.callOuter1.inputs.outerEnabled;
  blocks.innerPrototype.mutation.argumentdefaults = '[7]'; delete blocks.callInnerLast.inputs.innerAmount;
  const parsed = scratchProjectToIR(project);
  assert.equal(parsed.ir.setup[0].arguments[1], false);
  assert.equal(parsed.ir.setup[2].arguments[0], 7);
  assert.equal(exportArduino(project).ok, true);
});

test('missing, duplicate or malformed definitions and stale call signatures fail explicitly', () => {
  const missing = procedureProject(); delete blocksOf(missing).innerDefinition;
  expectFailure(missing, 'PROCEDURE_MISSING');
  const duplicate = procedureProject(); blocksOf(duplicate).otherDefinition = structuredClone(blocksOf(duplicate).innerDefinition);
  expectFailure(duplicate, 'PROCEDURE_DUPLICATE');
  for (const mutation of [{argumentnames: '["same","same"]'}, {argumentnames: '["__proto__","enabled"]'}, {argumentids: 'invalid'}, {argumentdefaults: '[]'}]) {
    const project = procedureProject(); Object.assign(blocksOf(project).outerPrototype.mutation, mutation);
    expectFailure(project, 'PROCEDURE_SIGNATURE');
  }
  const stale = procedureProject(); blocksOf(stale).callOuter1.mutation.argumentids = '["outerEnabled","outerAmount"]';
  expectFailure(stale, 'PROCEDURE_CALL');
  const reordered = procedureProject(), inputs = blocksOf(reordered).callOuter1.inputs;
  blocksOf(reordered).callOuter1.inputs = {outerEnabled: inputs.outerEnabled, outerAmount: inputs.outerAmount};
  expectFailure(reordered, 'PROCEDURE_CALL');
});

test('unused sprite procedures cannot supply a definition and unused unsupported bodies are not emitted', () => {
  const foreign = procedureProject(); foreign.targets[0].blocks = {innerDefinition: blocksOf(foreign).innerDefinition, innerPrototype: blocksOf(foreign).innerPrototype};
  delete blocksOf(foreign).innerDefinition;
  expectFailure(foreign, 'PROCEDURE_MISSING');
  const unused = procedureProject(), blocks = blocksOf(unused);
  blocks.unusedDefinition = {opcode: 'procedures_definition', topLevel: true, next: 'unsupported', inputs: {custom_block: [2, 'unusedPrototype']}};
  blocks.unusedPrototype = structuredClone(blocks.innerPrototype); blocks.unusedPrototype.mutation.proccode = 'unused %s';
  blocks.unsupported = {opcode: 'looks_say', inputs: {MESSAGE: literalInput('hello')}};
  assert.equal(exportArduino(unused).ok, true);
});

test('cycles inside procedure bodies and additional extension events still fail closed', () => {
  const cycle = procedureProject(); blocksOf(cycle).writePin.next = 'addToTotal';
  expectFailure(cycle, 'CYCLE');
  const event = procedureProject(); blocksOf(event).motionEvent = {opcode: 'videoSensing_whenMotionGreaterThan', topLevel: true};
  expectFailure(event, 'EVENT');
  const parallel = procedureProject(); blocksOf(parallel).secondStart = {opcode: 'event_whenflagclicked', topLevel: true};
  expectFailure(parallel, 'ENTRY');
});

test('preflight exposes capability boundaries and board errors without generated code', () => {
  const ready = preflightArduino(procedureProject());
  assert.equal(ready.ok, true); assert.equal(ready.procedureCount, 2); assert.equal('code' in ready, false);
  assert.equal(ready.capabilities, arduinoCapabilities); assert.equal(ready.capabilities.onboardML, true);
  // Only the small numeric model format is deployable; camera/audio models still run in the browser.
  assert.equal(ready.capabilities.onboardNumericML, true);
  assert.equal(ready.capabilities.onboardImageSoundPoseML, false);
  assert.equal(preflightArduino(procedureProject(), {boardId: 'quarky'}).ok, false);
});

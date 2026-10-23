// Acceptance: execute pinned official Scratch VM source and generated host C++.
// The C++ harness replaces hardware functions only; this is not a board test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve, join} from 'node:path';
import {exportArduino, generateArduino, scratchProjectToIR} from '../generator.js';
import {runtimeSource} from '../runtime-source.js';
import {getBoard} from '../boards.js';
import {procedureProject} from './procedure-fixtures.mjs';
const require = createRequire(import.meta.url), run = promisify(execFile);
// The distributed Node bundle references a missing browser stylesheet. Read the
// installed, version-pinned official source instead; do not patch dependencies.
const VirtualMachine = require(resolve('apps/scratch-editor/node_modules/@scratch/scratch-vm/src/virtual-machine.js'));
const folder = resolve('work/release-050/hardware-semantics'); await mkdir(folder, {recursive: true});
const harness = `#include <cstdio>\n#include <cmath>\nusing std::isnan;\nunsigned int duetTestRandomCount = 0;\nvoid duetBegin() {}\nvoid duetYield() {}\nunsigned long duetRepeat(double n) { return n > 0 ? (unsigned long)floor(n + 0.5) : 0; }\ndouble duetRandom(double, double) { return ++duetTestRandomCount; }\ndouble duetDivide(double a, double b) { return a/b; }\n`;
const hostResult = async (name, result, totalSymbol) => {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const source = result.code.replace(runtimeSource(getBoard('arduino-uno')), harness) + `\nint main() { setup(); std::printf("%.0f %u\\n", ${totalSymbol}, duetTestRandomCount); }\n`;
  await writeFile(join(folder, `${name}.cpp`), source);
  await run('c++', ['-std=c++11', '-Wall', '-Werror', join(folder, `${name}.cpp`), '-o', join(folder, name)]);
  return (await run(join(folder, name), [])).stdout.trim().split(' ').map(Number);
};
const results = [];
for (const [name, useDefault, expected] of [['nested-scopes', false, 22], ['boolean-default', true, 26], ['eager-and', false, 26], ['not-nan', false, 22]]) {
  const project = procedureProject(), blocks = project.targets[1].blocks;
  blocks.addToTotal.next = null;
  for (const id of ['writePin', 'positive', 'innerAmountForPin']) delete blocks[id];
  if (useDefault) delete blocks.callOuter1.inputs.outerEnabled;
  if (name === 'eager-and') {
    blocks.yes.opcode = 'operator_and'; blocks.yes.inputs = {OPERAND1: [2, 'falseInput'], OPERAND2: [2, 'randomPositive']};
    blocks.falseInput = {opcode: 'operator_lt', inputs: {OPERAND1: [1, [4, '2']], OPERAND2: [1, [4, '1']]}};
    blocks.randomPositive = {opcode: 'operator_gt', inputs: {OPERAND1: [2, 'randomInput'], OPERAND2: [1, [4, '0']]}};
    blocks.randomInput = {opcode: 'operator_random', inputs: {FROM: [1, [4, '1']], TO: [1, [4, '10']]}};
  } else if (name === 'not-nan') {
    blocks.yes.opcode = 'operator_not'; blocks.yes.inputs = {OPERAND: [2, 'nanInput']};
    blocks.nanInput = {opcode: 'operator_divide', inputs: {NUM1: [1, [4, '0']], NUM2: [1, [4, '0']]}};
  }
  for (const block of Object.values(blocks)) { block.parent ??= null; block.next ??= null; block.inputs ??= {}; block.fields ??= {}; block.shadow ??= false; block.topLevel ??= false; }
  for (const [id, block] of Object.entries(blocks)) for (const input of Object.values(block.inputs)) if (typeof input[1] === 'string' && blocks[input[1]]) blocks[input[1]].parent = id;
  const ir = scratchProjectToIR(project).ir, totalSymbol = `duetVar${ir.variables.findIndex(variable => variable.id === 'total')}`;
  const native = await hostResult(name, exportArduino(project), totalSymbol);
  const vm = new VirtualMachine();
  try {
    await vm.loadProject(project);
    let randomCalls = 0;
    const originalRandom = vm.runtime._primitives.operator_random;
    vm.runtime._primitives.operator_random = (...args) => { randomCalls++; return originalRandom(...args); };
    vm.start(); vm.greenFlag();
    const deadline = Date.now() + 3000;
    while (vm.runtime.threads.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(vm.runtime.threads.length, 0, 'Scratch fixture must finish');
    const scratch = vm.runtime.getTargetForStage().variables.total.value;
    assert.equal(scratch, expected); assert.equal(native[0], scratch);
    assert.equal(native[1], randomCalls);
    results.push({name, officialScratchVM: '15.2.0 installed source', scratchTotal: scratch, generatedCppTotal: native[0], scratchRandomCalls: randomCalls, cppRandomCalls: native[1], match: true});
  } finally { vm.quit(); }
}
const ordered = generateArduino({version: 1, variables: [{id: 'result', initial: 0}], setup: [{op: 'call', id: 'pair', arguments: [{op: 'random', left: 1, right: 10}, {op: 'random', left: 1, right: 10}]}], loop: [],
  procedures: [{id: 'pair', parameters: [{id: 'left', type: 'number'}, {id: 'right', type: 'number'}], body: [{op: 'setVariable', id: 'result', value: {op: 'add', left: {op: 'multiply', left: {op: 'parameter', id: 'left'}, right: 100}, right: {op: 'parameter', id: 'right'}}}]}]});
const orderedResult = await hostResult('ordered-arguments', ordered, 'duetVar0'); assert.deepEqual(orderedResult, [102, 2]);
results.push({name: 'ordered-arguments', generatedCppTotal: orderedResult[0], randomReporterCalls: orderedResult[1], expected: 102, match: true});
const booleanInput = generateArduino({version: 1, variables: [{id: 'result', initial: 0}], setup: [
  {op: 'call', id: 'check', arguments: [{op: 'and', left: false, right: {op: 'gt', left: {op: 'random', left: 1, right: 10}, right: 0}}]},
  {op: 'call', id: 'check', arguments: [{op: 'not', value: {op: 'divide', left: 0, right: 0}}]}], loop: [],
  procedures: [{id: 'check', parameters: [{id: 'flag', type: 'boolean'}], body: [{op: 'if', condition: {op: 'parameter', id: 'flag'}, then: [{op: 'changeVariable', id: 'result', value: 1}]}]}]});
const booleans = await hostResult('boolean-evaluation', booleanInput, 'duetVar0'); assert.deepEqual(booleans, [1, 1]);
results.push({name: 'boolean-evaluation', generatedCppTotal: booleans[0], randomReporterCalls: booleans[1], expected: 'One eager random evaluation, false AND result, true NOT(NaN) result', match: true});
await writeFile(join(folder, 'results.json'), JSON.stringify({scope: 'Interpreter and host-C++ semantic acceptance; no renderer, GPIO, flashing, USB, or physical-device assertion.', results}, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));

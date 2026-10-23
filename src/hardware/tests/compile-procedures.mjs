// Acceptance check with installed official Arduino CLI/cores. Compiles only; never flashes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {boardRegistry} from '../boards.js';
import {exportArduino} from '../generator.js';
import {procedureProject} from './procedure-fixtures.mjs';
const run = promisify(execFile), root = process.cwd(), booleanVariant = process.argv.includes('--boolean');
const selected = process.argv.find(arg => arg.startsWith('--boards='))?.slice(9).split(',');
const outputRoot = resolve(`work/release-050/hardware-procedures${booleanVariant ? '-boolean' : ''}`);
const cli = process.env.DUETBLOX_ARDUINO_CLI || resolve('work/arduino/bin/arduino-cli');
const prefix = ['--config-file', process.env.DUETBLOX_ARDUINO_CONFIG || resolve('work/arduino/arduino-cli.yaml')];
await mkdir(outputRoot, {recursive: true});
const invoke = async args => (await run(cli, [...prefix, ...args], {cwd: root, timeout: 600000, maxBuffer: 8 * 1024 * 1024})).stdout;
const version = JSON.parse(await invoke(['version', '--format', 'json']));
const coreInventory = JSON.parse(await invoke(['core', 'list', '--format', 'json']));
const cores = (coreInventory.platforms || []).map(core => ({id: core.id, version: core.installed_version}));
const results = [];
for (const board of boardRegistry.filter(board => board.export && (!selected || selected.includes(board.id)))) {
  const project = procedureProject(13);
  if (booleanVariant) {
    const blocks = project.targets[1].blocks;
    blocks.yes.opcode = 'operator_and'; blocks.yes.inputs = {OPERAND1: [2, 'randomPositive'], OPERAND2: [2, 'notNan']};
    blocks.randomPositive = {opcode: 'operator_gt', inputs: {OPERAND1: [2, 'randomInput'], OPERAND2: [1, [4, '0']]}};
    blocks.randomInput = {opcode: 'operator_random', inputs: {FROM: [1, [4, '1']], TO: [1, [4, '10']]}};
    blocks.notNan = {opcode: 'operator_not', inputs: {OPERAND: [2, 'nanInput']}};
    blocks.nanInput = {opcode: 'operator_divide', inputs: {NUM1: [1, [4, '0']], NUM2: [1, [4, '0']]}};
  }
  const generated = exportArduino(project, {boardId: board.id, name: 'DuetProcedures'});
  if (!generated.ok) throw new Error(JSON.stringify(generated.diagnostics));
  const folder = join(outputRoot, board.id, 'DuetProcedures'), compiled = join(outputRoot, board.id, 'compiled');
  await mkdir(folder, {recursive: true}); await mkdir(compiled, {recursive: true});
  await writeFile(join(folder, generated.filename), generated.code);
  await writeFile(join(folder, 'project.json'), JSON.stringify(project, null, 2));
  process.stdout.write(`Compiling ${board.id}: ${board.fqbn}\n`);
  const log = await invoke(['compile', '--fqbn', board.fqbn, '--output-dir', compiled, folder]);
  await writeFile(join(outputRoot, board.id, 'compile.txt'), log);
  const file = `DuetProcedures.ino.${board.core === 'esp32:esp32' ? 'merged.bin' : 'hex'}`, bytes = await readFile(join(compiled, file));
  results.push({boardId: board.id, fqbn: board.fqbn, sourceSha256: createHash('sha256').update(generated.code).digest('hex'),
    artifact: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), compilerVerified: true, physicalVerified: false});
  process.stdout.write(log.trim() + '\n');
  await writeFile(join(outputRoot, 'results.json'), JSON.stringify({builtAt: new Date().toISOString(), cli: version, cores, results}, null, 2) + '\n');
}

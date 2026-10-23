// Installed official toolchains; compiles only and never connects/flashes boards.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {boardRegistry} from '../boards.js';
import {exportArduino} from '../generator.js';
import {numberProject} from './numbers-fixtures.mjs';
const run=promisify(execFile),folder=resolve('work/release-070/numbers-firmware'),cli=resolve('work/arduino/bin/arduino-cli'),prefix=['--config-file',resolve('work/arduino/arduino-cli.yaml')];await mkdir(folder,{recursive:true});
const invoke=async args=>(await run(cli,[...prefix,...args],{timeout:600000,maxBuffer:8e6})).stdout;
const version=JSON.parse(await invoke(['version','--format','json'])),cores=JSON.parse(await invoke(['core','list','--format','json'])),results=[];
for(const board of boardRegistry.filter(b=>b.export))for(const task of ['classification','regression']){
 const name=task==='classification'?'DuetNumbersClass':'DuetNumbersRegression',project=numberProject(task,board.id==='esp32-cam'?4:13),result=exportArduino(project,{boardId:board.id,name});if(!result.ok)throw new Error(JSON.stringify(result.diagnostics));
 const root=join(folder,board.id,task),sketch=join(root,name),compiled=join(root,'compiled');await mkdir(sketch,{recursive:true});await mkdir(compiled,{recursive:true});await writeFile(join(sketch,result.filename),result.code);await writeFile(join(root,'project.json'),JSON.stringify(project,null,2));console.log(`Compiling ${board.id} ${task}`);
 const log=await invoke(['compile','--fqbn',board.fqbn,'--output-dir',compiled,sketch]);await writeFile(join(root,'compile.txt'),log);const file=`${name}.ino.${board.core==='esp32:esp32'?'merged.bin':'hex'}`,bytes=await readFile(join(compiled,file));results.push({boardId:board.id,task,fqbn:board.fqbn,sourceSha256:createHash('sha256').update(result.code).digest('hex'),artifact:join(compiled,file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),compilerVerified:true,physicalVerified:false});console.log(log.trim());await writeFile(join(folder,'results.json'),JSON.stringify({builtAt:new Date().toISOString(),cli:version,cores,results},null,2));
}

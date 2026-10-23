import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {exportArduino} from '../generator.js';
import {numberProject} from './numbers-fixtures.mjs';
const run=promisify(execFile),root=resolve('work/release-070/numbers-sensor-firmware'),sketch=join(root,'DuetNumbersSensor'),compiled=join(root,'compiled');await mkdir(sketch,{recursive:true});await mkdir(compiled,{recursive:true});
const project=numberProject();project.targets[1].blocks.input1.inputs.VALUE=[2,'sensor'];project.targets[1].blocks.sensor={opcode:'duetHardware_readAnalog',inputs:{PIN:[1,[10,'A0']]},fields:{},topLevel:false,shadow:false,parent:'input1',next:null};
const result=exportArduino(project,{boardId:'arduino-uno',name:'DuetNumbersSensor'});if(!result.ok)throw new Error(JSON.stringify(result.diagnostics));await writeFile(join(sketch,result.filename),result.code);await writeFile(join(root,'project.json'),JSON.stringify(project,null,2));
const log=(await run(resolve('work/arduino/bin/arduino-cli'),['--config-file',resolve('work/arduino/arduino-cli.yaml'),'compile','--fqbn','arduino:avr:uno','--output-dir',compiled,sketch],{timeout:600000,maxBuffer:8e6})).stdout;await writeFile(join(root,'compile.txt'),log);
const files={};for(const name of ['DuetNumbersSensor.ino.hex','DuetNumbersSensor.ino.elf']){const bytes=await readFile(join(compiled,name));files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
await writeFile(join(root,'identity.json'),JSON.stringify({sourceSha256:createHash('sha256').update(result.code).digest('hex'),files,compilerVerified:true,physicalVerified:false,dynamicFeature:'A0 analog input'},null,2));console.log(log);

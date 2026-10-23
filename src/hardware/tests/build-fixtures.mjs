// Generate reproducible compiler input; no compiler installation or device access.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {boardRegistry} from '../boards.js';
import {generateArduino} from '../generator.js';
export function fixtureIR(board) {
  const esp=board.core==='esp32:esp32',cam=board.id==='esp32-cam';
  const pin=esp ? 13 : 9, pwm=esp ? 4 : 5, buzzer=esp ? 14 : 8;
  return {version:1,variables:[{id:'count',name:'counter',initial:0}],setup:[
    {op:'setPinMode',pin,mode:'OUTPUT'}, {op:'digitalWrite',pin,value:1},
    {op:'servoWrite',pin,angle:90},{op:'wait',seconds:0.02},{op:'servoDetach',pin},
    {op:'analogWrite',pin:pwm,value:128},
    {op:'tone',pin:buzzer,frequency:440,seconds:0.05},{op:'wait',seconds:0.05},{op:'noTone',pin:buzzer},
    {op:'setVariable',id:'count',value:{op:'round',value:{op:'random',left:1,right:10}}},
    {op:'setVariable',id:'count',value:{op:'map',value:cam ? 123 : {op:'readAnalog',pin:esp?'34':'A0'},inMin:0,inMax:board.analogMax,outMin:0,outMax:255}},
    {op:'repeat',times:2,body:[{op:'changeVariable',id:'count',value:1}]},
    {op:'waitUntil',condition:{op:'gt',left:1,right:0}},
    {op:'repeatUntil',condition:{op:'gt',left:{op:'variable',id:'count'},right:256},body:[{op:'changeVariable',id:'count',value:1}]},
    {op:'if',condition:{op:'readDigital',pin},then:[{op:'digitalWrite',pin,value:0}],else:[{op:'digitalWrite',pin,value:1}]}
  ],loop:[{op:'wait',seconds:0.1}]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const root=process.argv[2] || fileURLToPath(new URL('../../../work/hardware-fixtures',import.meta.url));
  for(const board of boardRegistry.filter(b=>b.export)) {
    const ir=fixtureIR(board),result=generateArduino(ir,{boardId:board.id,name:'DuetProgram'});
    if(!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    const directory=join(root,board.id,'DuetProgram');await mkdir(directory,{recursive:true});
    await writeFile(join(directory,'DuetProgram.ino'),result.code);await writeFile(join(directory,'fixture.json'),JSON.stringify(ir,null,2));
    console.log(`${board.id}: ${directory} (${board.fqbn})`);
  }
}

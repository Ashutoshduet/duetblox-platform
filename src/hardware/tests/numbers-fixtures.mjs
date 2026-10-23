import {trainNumbers} from '../../ml/numbers/model.js';
import {exampleNumberDataset} from '../../ml/numbers/fixtures.js';
export function numberProject(task='classification',pin=13) {
  const model=trainNumbers(exampleNumberDataset(task));
  const blocks={start:{opcode:'duetHardware_whenBoardStarts',topLevel:true,next:'input1'},input1:{opcode:'duetNumbers_setInput',next:task==='classification'?'input2':'predict',inputs:{INDEX:[1,[4,'1']],VALUE:[1,[4,task==='classification'?'740':'37']]}},input2:{opcode:'duetNumbers_setInput',next:'predict',inputs:{INDEX:[1,[4,'2']],VALUE:[1,[4,'29']]}},predict:{opcode:'duetNumbers_predict',next:'result'},result:{opcode:'data_setvariableto',next:'write',fields:{VARIABLE:['result','result']},inputs:{VALUE:[2,'value']}},value:{opcode:task==='classification'?'duetNumbers_classIndex':'duetNumbers_value'},write:{opcode:'duetHardware_digitalWrite',inputs:{PIN:[1,[4,String(pin)]],VALUE:[2,'accepted']}},accepted:{opcode:'duetNumbers_isAccepted'}};
  if(task==='regression')delete blocks.input2;
  for(const block of Object.values(blocks)){block.next??=null;block.parent??=null;block.inputs??={};block.fields??={};block.shadow??=false;block.topLevel??=false;}
  return {targets:[{isStage:true,name:'Stage',variables:{result:['result',0]},blocks:{}},{isStage:false,name:'Sensor model',variables:{},blocks}],duetbloxModels:{numbers:model}};
}

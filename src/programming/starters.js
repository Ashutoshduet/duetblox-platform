import {requireBoard} from '../hardware/boards.js';

// Add a separate sprite, preserving the student's original scripts and assets.
export function addStarter(project, kind, boardId='arduino-uno') {
  if (!['motion','blink','sensor'].includes(kind)) throw new Error('Choose an available example.');
  const next=structuredClone(project), original=next.targets?.find(t=>!t.isStage);
  if (!original) throw new Error('Add a sprite in Code first, then try this example.');
  const board=kind==='motion'?null:requireBoard(boardId), pin=board?.outputPins.includes(13)?13:board?.outputPins[0], analog=board?.analogPins[0];
  if(kind==='sensor'&&!analog)throw new Error('This board profile has no analog input. Try the LED example.');
  const titles={motion:'My first animation',blink:'LED test',sensor:'Sensor test'};
  let name=titles[kind], suffix=2;
  while(next.targets.some(t=>t.name===name))name=`${titles[kind]} ${suffix++}`;
  const sprite={...structuredClone(original),name,variables:{},lists:{},broadcasts:{},comments:{},blocks:{},x:0,y:0,direction:90,size:100,visible:true,layerOrder:Math.max(...next.targets.map(t=>t.layerOrder||0))+1};
  const b=(id,opcode,parent,nextId,inputs={},fields={})=>sprite.blocks[id]={opcode,parent,next:nextId,inputs,fields,shadow:false,topLevel:parent===null,...(parent===null?{x:40,y:40}:{})};
  const n=value=>[1,[4,String(value)]],s=value=>[1,[10,String(value)]];
  const digital=(id,parent,nextId,value)=>b(id,'duetHardware_digitalWrite',parent,nextId,{PIN:n(pin),VALUE:n(value)});
  b('start','event_whenflagclicked',null,kind==='motion'?'say':'loop');
  if(kind==='motion'){
    b('say','looks_sayforsecs','start','repeat',{MESSAGE:s('Hello! I made this.'),SECS:n(1)});
    b('repeat','control_repeat','say',null,{TIMES:n(10),SUBSTACK:[2,'move']});
    b('move','motion_movesteps','repeat','wait',{STEPS:n(10)});
    b('wait','control_wait','move',null,{DURATION:n(.1)});
  } else {
    b('loop','control_forever','start',null,{SUBSTACK:[2,kind==='blink'?'on':'if']});
    if(kind==='blink'){
      digital('on','loop','waitOn',1);b('waitOn','control_wait','on','off',{DURATION:n(.5)});
      digital('off','waitOn','waitOff',0);b('waitOff','control_wait','off',null,{DURATION:n(.5)});
    } else {
      b('if','control_if_else','loop','pause',{CONDITION:[2,'greater'],SUBSTACK:[2,'on'],SUBSTACK2:[2,'off']});
      b('greater','operator_gt','if',null,{OPERAND1:[3,'read',[10,'']],OPERAND2:n(Math.floor(board.analogMax/2))});
      b('read','duetHardware_readAnalog','greater',null,{PIN:s(analog)});
      digital('on','if',null,1);digital('off','if',null,0);
      b('pause','control_wait','if',null,{DURATION:n(.05)});
    }
    next.extensions=[...new Set([...(next.extensions||[]),'duetHardware'])];
  }
  next.targets.push(sprite);
  return {project:next,name,pin,analog,threshold:board?Math.floor(board.analogMax/2):null};
}

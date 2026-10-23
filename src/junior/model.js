import {BACKDROP_ART, SPRITE_ART} from './assets.js';
import {validateMediaAsset} from './media.js';
export const MESSAGE_COLORS = ['orange','red','blue','green','purple','yellow'];
export const TRIGGERS = {flag:'When play starts',tap:'When character tapped',bump:'When characters bump',message:'When message arrives',key:'When a key is pressed'};
export const CONDITION_TYPES = Object.freeze({touchingEdge:'Touching the edge',touchingCharacter:'Touching another character',keyPressed:'A key is pressed',mlAccepted:'Prediction is accepted',mlLabel:'Accepted prediction has a label'});
export const JUNIOR_MODEL_TYPES = Object.freeze({image:'Image',sound:'Sound',pose:'Pose'});
export const JUNIOR_KEYS = Object.freeze(['space','up arrow','down arrow','left arrow','right arrow',...'abcdefghijklmnopqrstuvwxyz0123456789','any']);
export function makeJuniorCondition(kind='touchingEdge') {
 if(!Object.hasOwn(CONDITION_TYPES,kind))throw new Error('Choose a supported Junior condition.');
 return {kind,...(kind.startsWith('ml')?{model:'image'}:{}),...(kind==='mlLabel'?{label:'Class 1'}:{}),...(kind==='keyPressed'?{key:'space'}:{})};
}
export function validateJuniorCondition(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(CONDITION_TYPES,value.kind))throw new Error('Choose a supported Junior condition.');
 const condition={kind:value.kind};
 if(value.kind.startsWith('ml')){if(!Object.hasOwn(JUNIOR_MODEL_TYPES,value.model))throw new Error('Choose Image, Sound or Pose for a Junior decision.');condition.model=value.model;}
 if(value.kind==='mlLabel'){if(typeof value.label!=='string'||!value.label.trim()||value.label.length>80)throw new Error('A decision class label needs 1–80 characters.');condition.label=value.label.trim();}
 if(value.kind==='keyPressed'){if(!JUNIOR_KEYS.includes(value.key))throw new Error('Choose a supported key for the Junior decision.');condition.key=value.key;}
 return condition;
}
const number = (label,category,value,min,max,unit) => ({label,category,value,min,max,unit});
export const BLOCK_TYPES = {
 bounce:{label:'Bounce at edge',category:'motion'},direction:number('Face direction','motion',90,-180,180,'degrees'),setX:number('Set X','motion',0,-240,240,'pixels'),setY:number('Set Y','motion',0,-180,180,'pixels'),rotationStyle:{label:'Turn style',category:'motion',choice:'left-right'},
 move:number('Move','motion',20,-480,480,'pixels'),turn:number('Turn','motion',90,-360,360,'degrees'),
 right:number('Go right','motion',1,0,24,'squares'),left:number('Go left','motion',1,0,24,'squares'),up:number('Go up','motion',1,0,18,'squares'),down:number('Go down','motion',1,0,18,'squares'),
 turnLeft:number('Turn left','motion',30,0,360,'degrees'),hop:number('Hop','motion',2,0,9,'squares'),home:{label:'Go home',category:'motion'},random:{label:'Random place',category:'motion'},
 say:{...number('Say','looks',2,.1,30,'seconds'),text:'Hello!'},grow:number('Grow','looks',10,1,100,'percent'),shrink:number('Shrink','looks',10,1,100,'percent'),resetSize:{label:'Reset size',category:'looks'},show:{label:'Show',category:'looks'},hide:{label:'Hide',category:'looks'},nextCostume:{label:'Next costume',category:'looks'},costume:{label:'Costume',category:'looks',choice:'first'},
 wait:number('Wait','control',1,0,30,'seconds'),repeat:{...number('Repeat','control',4,1,100,'times'),container:true},forever:{label:'Forever',category:'control',container:true},stop:{label:'Stop',category:'control',choice:'all'},speed:{label:'Speed',category:'control',choice:'normal'},end:{label:'End script',category:'control'},scene:{label:'Go to scene',category:'control',choice:''},
 waitUntil:{label:'Wait until',category:'control',predicate:true},repeatUntil:{label:'Repeat until',category:'control',container:true,predicate:true},
 if:{label:'If',category:'control',container:true,decision:true},ifElse:{label:'If / otherwise',category:'control',container:true,decision:true,otherwise:true},
 message:{label:'Send message',category:'events',choice:'orange'},messageWait:{label:'Send and wait',category:'events',choice:'orange'},startSound:{label:'Start sound',category:'sound',choice:'chime'},stopSounds:{label:'Stop sounds',category:'sound'},volume:number('Volume','sound',100,0,100,'percent'),sound:{label:'Play sound',category:'sound',choice:'chime'},
 penDown:{label:'Pen down',category:'pen'},penUp:{label:'Pen up',category:'pen'},clear:{label:'Clear drawing',category:'pen'},penColor:{label:'Pen color',category:'pen',choice:'#7c5bc5'},penSize:number('Pen size','pen',3,1,50,'pixels'),stamp:{label:'Stamp',category:'pen'},
 predict:{label:'Recognize',category:'ai',choice:'image'},sayPrediction:{...number('Say prediction','ai',2,.1,30,'seconds'),choice:'image'},
 pinHigh:{label:'Pin on',category:'devices',choice:'13'},pinLow:{label:'Pin off',category:'devices',choice:'13'},pwm:{...number('PWM output','devices',128,0,255,'power'),choice:'9'},servo:{...number('Servo angle','devices',90,0,180,'degrees'),choice:'9'},tone:{...number('Play tone','devices',440,31,10000,'hertz'),choice:'8'},noTone:{label:'Stop tone',category:'devices',choice:'8'},analogSay:{label:'Say analog','category':'devices',choice:'A0'},digitalSay:{label:'Say digital','category':'devices',choice:'2'}
};
let nextId=0;
export function juniorId(prefix='item'){return `${prefix}-${Date.now().toString(36)}-${(++nextId).toString(36)}`;}
export function makeJuniorBlock(type){const def=BLOCK_TYPES[type];if(!Object.hasOwn(BLOCK_TYPES,type))throw new Error('Unknown block type.');return {id:juniorId('block'),type,...(def.value===undefined?{}:{value:def.value}),...(def.text===undefined?{}:{text:def.text}),...(def.choice===undefined?{}:{choice:def.choice}),...(def.container?{children:[]}:{}),...((def.decision||def.predicate)?{condition:makeJuniorCondition()}:{}),...(def.otherwise?{elseChildren:[]}:{})};}
export function makeJuniorScript(trigger='flag'){return {id:juniorId('script'),trigger,message:'orange',...(trigger==='key'?{key:'space'}:{}),blocks:[]};}
export function makeJuniorSprite(kind='fox',index=0){return {id:juniorId('sprite'),name:{fox:'Fox',robot:'Robot',star:'Star'}[kind]||'Character',kind:SPRITE_ART[kind]?kind:'fox',x:index*55,y:-38,size:85,direction:90,costumeAssetIds:[],scripts:[makeJuniorScript()]};}
export function makeJuniorScene(index=0){return {id:juniorId('scene'),name:['Meadow','Space','Studio'][index%3],background:['meadow','space','studio'][index%3],sprites:[makeJuniorSprite()]};}
export function makeJuniorProject(){const scene=makeJuniorScene();scene.sprites[0].scripts[0].blocks=[{...makeJuniorBlock('move'),value:40},{...makeJuniorBlock('say'),text:'Hello, world!',value:2},{...makeJuniorBlock('turn'),value:15}];return {schema:'duetblox-junior',version:2,id:juniorId('project'),title:'My first story',selectedSceneId:scene.id,selectedSpriteId:scene.sprites[0].id,selectedScriptId:scene.sprites[0].scripts[0].id,scenes:[scene],assets:[]};}
export function boundedNumber(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function validateBlocks(blocks,counter,depth=0){if(!Array.isArray(blocks))throw new Error('A script must contain a list of blocks.');if(depth>8)throw new Error('This project has too many nested loops or decisions (maximum 8).');return blocks.map(block=>{if(++counter.count>1000)throw new Error('This project has too many blocks (maximum 1,000).');const def=BLOCK_TYPES[block?.type];if(!Object.hasOwn(BLOCK_TYPES,block?.type))throw new Error(`Unsupported Junior block: ${String(block?.type)}.`);const result={id:juniorId('block'),type:block.type};if(def.value!==undefined){result.value=boundedNumber(block.value,def.min,def.max,def.value);if(block.type==='repeat')result.value=Math.round(result.value);}if(def.text!==undefined)result.text=String(block.text??def.text).slice(0,160);if(def.choice!==undefined)result.choice=String(block.choice??def.choice).slice(0,100);if(def.decision||def.predicate)result.condition=validateJuniorCondition(block.condition);if(def.container)result.children=validateBlocks(block.children??[],counter,depth+1);if(def.otherwise)result.elseChildren=validateBlocks(block.elseChildren??[],counter,depth+1);return result;});}
export function parseJuniorProject(input){
 if(typeof input==='string'&&input.length>35_000_000)throw new Error('Junior projects must be smaller than 35 MB.');
 const data=typeof input==='string'?JSON.parse(input):input;
 if(data?.schema!=='duetblox-junior'||![1,2].includes(data.version))throw new Error('Choose a DuetBlox Junior .junior.json project.');
 if(!Array.isArray(data.scenes)||!data.scenes.length||data.scenes.length>12)throw new Error('A Junior project needs between 1 and 12 scenes.');
 if(data.assets!==undefined&&(!Array.isArray(data.assets)||data.assets.length>100))throw new Error('Use at most 100 custom media assets.');
 let bytes=0;const assets=(data.assets||[]).map(asset=>{const valid=validateMediaAsset(asset);bytes+=valid.data.length;if(bytes>30_000_000)throw new Error('Custom media must total less than 30 MB.');return valid;});
 if(new Set(assets.map(a=>a.id)).size!==assets.length)throw new Error('This project contains duplicate media IDs.');
 const assetIds=new Set(assets.filter(a=>a.dataFormat==='png').map(a=>a.id));const counter={count:0};
 const scenes=data.scenes.map((scene,index)=>{
  if(!Array.isArray(scene?.sprites)||!scene.sprites.length||scene.sprites.length>12)throw new Error('Each scene needs between 1 and 12 characters.');
  if(scene.backdropAssetId&&!assetIds.has(scene.backdropAssetId))throw new Error('A scene references missing image media.');
  return {id:String(scene.id||juniorId('scene')).slice(0,100),name:String(scene.name||`Scene ${index+1}`).slice(0,40),background:BACKDROP_ART[scene.background]?scene.background:'meadow',...(scene.backdropAssetId?{backdropAssetId:scene.backdropAssetId}:{}),sprites:scene.sprites.map(sprite=>{
   const scripts=sprite.scripts?.length?sprite.scripts:[makeJuniorScript()];if(!Array.isArray(scripts)||scripts.length>20)throw new Error('Use between 1 and 20 scripts per character.');
   const costumes=Array.isArray(sprite.costumeAssetIds)?sprite.costumeAssetIds:[];if(costumes.length>20||costumes.some(id=>!assetIds.has(id)))throw new Error('A character references missing costume media.');
   return {id:String(sprite.id||juniorId('sprite')).slice(0,100),name:String(sprite.name||'Character').slice(0,40),kind:SPRITE_ART[sprite.kind]?sprite.kind:'fox',x:boundedNumber(sprite.x,-240,240,0),y:boundedNumber(sprite.y,-180,180,0),size:boundedNumber(sprite.size,20,200,85),direction:boundedNumber(sprite.direction,-180,180,90),costumeAssetIds:[...new Set(costumes)],initialCostume:boundedNumber(sprite.initialCostume,0,costumes.length,0),scripts:scripts.map(script=>{
    if(!Object.hasOwn(TRIGGERS,script.trigger||'flag'))throw new Error('Unsupported Junior start event.');
    if(script.trigger==='key'&&!JUNIOR_KEYS.includes(script.key??'space'))throw new Error('Choose a supported key for the Junior start event.');
    return {id:String(script.id||juniorId('script')).slice(0,100),trigger:script.trigger||'flag',message:MESSAGE_COLORS.includes(script.message)?script.message:'orange',...(script.trigger==='key'?{key:script.key??'space'}:{}),blocks:validateBlocks(script.blocks||[],counter)};
   })};
  })};
 });
 if(new Set(scenes.map(s=>s.id)).size!==scenes.length||scenes.some(s=>new Set(s.sprites.map(p=>p.id)).size!==s.sprites.length||s.sprites.some(p=>new Set(p.scripts.map(x=>x.id)).size!==p.scripts.length)))throw new Error('This project contains duplicate scene, character or script IDs.');
 const scene=scenes.find(s=>s.id===data.selectedSceneId)||scenes[0],sprite=scene.sprites.find(s=>s.id===data.selectedSpriteId)||scene.sprites[0];
 return {schema:'duetblox-junior',version:2,id:String(data.id||juniorId('project')),title:String(data.title||'My story').slice(0,80),selectedSceneId:scene.id,selectedSpriteId:sprite.id,selectedScriptId:sprite.scripts.find(s=>s.id===data.selectedScriptId)?.id||sprite.scripts[0].id,scenes,assets};
}
export function serializeJuniorProject(project){return JSON.stringify(project,null,2);}
export function juniorBranches(block){return BLOCK_TYPES[block.type]?.otherwise?['children','elseChildren']:BLOCK_TYPES[block.type]?.container?['children']:[];}
export function updateBlockList(blocks,id,change){return blocks.map(b=>b.id===id?{...b,...change}:{...b,...Object.fromEntries(juniorBranches(b).map(branch=>[branch,updateBlockList(b[branch]||[],id,change)]))});}
export function removeJuniorBlock(blocks,id){return blocks.filter(b=>b.id!==id).map(b=>({...b,...Object.fromEntries(juniorBranches(b).map(branch=>[branch,removeJuniorBlock(b[branch]||[],id)]))}));}
export function findJuniorBlock(blocks,id){for(const block of blocks){if(block.id===id)return block;for(const branch of juniorBranches(block)){const found=findJuniorBlock(block[branch]||[],id);if(found)return found;}}}
// Resolve a nested editor path against the current program. After deletion or
// undo, keep the nearest existing parent instead of editing a stale branch.
export function resolveJuniorBranch(blocks,path=[]){
 const breadcrumbs=[];let list=blocks;
 for(const entry of path){const block=list.find(b=>b.id===entry.id);if(!block||!juniorBranches(block).includes(entry.branch))break;breadcrumbs.push({id:block.id,branch:entry.branch,block});list=block[entry.branch]||[];}
 return {blocks:list,breadcrumbs,path:breadcrumbs.map(({id,branch})=>({id,branch}))};
}
export {compileJuniorProject} from './compiler.js';

// Search includes child-friendly explanations as well as exact block names.
export const JUNIOR_BLOCK_HELP = Object.freeze({
 bounce:'Turn away when you touch the stage edge. Put this after Move inside a loop.',direction:'Choose which way to face: 90 right, −90 left, 0 up, 180 down.',setX:'Place your character left or right. X = 0 is the middle.',setY:'Place your character up or down. Y = 0 is the middle.',rotationStyle:'Choose left-right flipping, full rotation, or no turning.',
 move:'Move forward in the direction your character faces.',turn:'Turn clockwise by this many degrees.',turnLeft:'Turn counterclockwise by this many degrees.',right:'Glide right by squares. Each square is 20 pixels.',left:'Glide left by squares. Each square is 20 pixels.',up:'Glide up by squares. Each square is 20 pixels.',down:'Glide down by squares. Each square is 20 pixels.',hop:'Jump up and return to the same height.',home:'Return to the character’s starting position.',random:'Jump to a random place on the stage.',
 say:'Show a speech bubble for a few seconds.',grow:'Make your character bigger.',shrink:'Make your character smaller.',resetSize:'Return to the character’s starting size.',show:'Make your character visible.',hide:'Make your character invisible.',nextCostume:'Switch to the next costume.',costume:'Choose a built-in or uploaded costume.',
 wait:'Pause this script for a few seconds.',waitUntil:'Pause until a condition becomes true. Other scripts keep running.',repeat:'Run the steps inside a fixed number of times.',repeatUntil:'Repeat the steps inside while the condition is false. Stop when it becomes true.',forever:'Keep repeating the steps inside until Stop.',if:'Run Then steps only when a condition is true.',ifElse:'Choose Then or Otherwise steps using a condition.',stop:'Stop all scripts, this script, or the other scripts for this character.',end:'Finish this script now.',speed:'Change the speed of square moves and hops.',scene:'Switch the scene and start its characters.',
 message:'Send a colored message to start matching scripts.',messageWait:'Send a colored message and wait for the matching scripts to finish.',sound:'Play a sound and wait until it finishes.',startSound:'Start a sound and continue to the next block immediately.',stopSounds:'Stop all playing sounds.',volume:'Choose how loud this character’s sounds play: 0 is mute, 100 is loudest.',
 penDown:'Start drawing as the character moves.',penUp:'Stop drawing as the character moves.',clear:'Erase all pen drawings and stamps.',penColor:'Choose the drawing color.',penSize:'Choose the pen thickness.',stamp:'Draw a copy of the character on the stage.',
 predict:'Recognize the current image, sound, or pose using your trained model.',sayPrediction:'Show the latest prediction label in a speech bubble.',pinHigh:'Turn a connected board’s digital output on.',pinLow:'Turn a connected board’s digital output off.',pwm:'Set the power of a supported PWM output pin.',servo:'Set a connected servo motor angle.',tone:'Play a tone through a connected buzzer.',noTone:'Stop the connected buzzer.',analogSay:'Read an analog sensor pin and show its value.',digitalSay:'Read a digital input pin and show its value.'
});
export function findJuniorBlocks(query='',category='all') {
 const terms=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
 return Object.entries(BLOCK_TYPES).filter(([type,definition])=>(category==='all'||category===definition.category)&&terms.every(term=>`${definition.label} ${definition.category} ${JUNIOR_BLOCK_HELP[type]||''}`.toLowerCase().includes(term)));
}
export function countJuniorBlocks(blocks) {return blocks.reduce((count,block)=>count+1+juniorBranches(block).reduce((sum,branch)=>sum+countJuniorBlocks(block[branch]||[]),0),0);}
export function copyJuniorBlock(block) {return {...structuredClone(block),id:juniorId('block'),...Object.fromEntries(juniorBranches(block).map(branch=>[branch,(block[branch]||[]).map(copyJuniorBlock)]))};}
export function copyJuniorScript(script) {return {...structuredClone(script),id:juniorId('script'),blocks:script.blocks.map(copyJuniorBlock)};}

export function juniorSequenceWarning(blocks) {
 const index=blocks.findIndex(block=>['forever','end','scene'].includes(block.type)||(block.type==='stop'&&block.choice!=='other scripts in sprite'));
 if(index<0||index===blocks.length-1)return '';
 const block=blocks[index],remaining=blocks.length-index-1;
 return `${remaining} ${remaining===1?'block after':'blocks after'} ${BLOCK_TYPES[block.type].label} will not run in this script. ${block.type==='forever'?'Move those steps inside Forever or into another script.':'Move those steps before it or into another script.'}`;
}

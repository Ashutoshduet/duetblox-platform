import {ASSET_IDS,BACKDROP_ART,BEEP_BASE64,SPRITE_ART} from './assets.js';
import {BLOCK_TYPES,boundedNumber,MESSAGE_COLORS,JUNIOR_KEYS,validateJuniorCondition} from './model.js';
const SCENE='junior-active-scene',SPEED='junior-speed';
const msg=name=>({_broadcast:name});
const expr=(op,inputs={},fields={})=>({op,inputs,fields});
const variable=(name,id)=>expr('data_variable',{}, {VARIABLE:[name,id]});
const eq=(a,b)=>expr('operator_equals',{OPERAND1:a,OPERAND2:b});
const not=a=>expr('operator_not',{OPERAND:a});
const math=(op,a,b)=>expr(`operator_${op}`,{NUM1:a,NUM2:b});
const command=(op,inputs={},fields={})=>({op,inputs,fields});
const broadcast=(name,wait=false)=>command(wait?'event_broadcastandwait':'event_broadcast',{BROADCAST_INPUT:msg(name)});
const stop=option=>({...command('control_stop',{}, {STOP_OPTION:[option,null]}),mutation:{tagName:'mutation',children:[],hasnext:option==='other scripts in sprite'?'true':'false'}});
const startName=id=>`__duet_start_${id}`,goName=id=>`__duet_go_${id}`;
function builder(prefix,broadcasts){
 const blocks={};let count=0;const alloc=()=>`${prefix}-sb-${++count}`;
 const make=(op,parent,shadow=false)=>({opcode:op,next:null,parent,inputs:{},fields:{},shadow,topLevel:false});
 const menuTypes={SOUND_MENU:['sound_sounds_menu','SOUND_MENU'],COSTUME:['looks_costume','COSTUME'],BACKDROP:['looks_backdrops','BACKDROP'],TOUCHINGOBJECTMENU:['sensing_touchingobjectmenu','TOUCHINGOBJECTMENU'],KEY_OPTION:['sensing_keyoptions','KEY_OPTION']};
 function namedInput(key,value,parent){const menu=menuTypes[key];if(menu&&typeof value==='string'){const id=alloc();blocks[id]={...make(menu[0],parent,true),fields:{[menu[1]]:[value,null]}};return [1,id];}return input(value,parent);}
 function input(value,parent){
  if(value?._broadcast){const name=value._broadcast;broadcasts[name]=name;return [1,[11,name,name]];}
  if(value?._color)return [1,[9,value._color]];
  if(value?.op){const id=alloc(),block=make(value.op,parent);blocks[id]=block;block.fields=value.fields||{};for(const [key,v] of Object.entries(value.inputs||{}))block.inputs[key]=namedInput(key,v,id);return [2,id];}
  return [1,[typeof value==='number'?4:10,String(value??'')]];
 }
 function chain(commands,parent){let first=null,last=null;for(const source of commands){const id=alloc(),block=make(source.op,last||parent);blocks[id]=block;if(!first)first=id;if(last)blocks[last].next=id;block.fields=source.fields||{};if(source.mutation)block.mutation=source.mutation;for(const [key,value]of Object.entries(source.inputs||{}))block.inputs[key]=namedInput(key,value,id);if(source.children){const child=chain(source.children,id);if(child)block.inputs.SUBSTACK=[2,child];}if(source.elseChildren){const child=chain(source.elseChildren,id);if(child)block.inputs.SUBSTACK2=[2,child];}last=id;}return first;}
 function hat(id,opcode,fields,commands,y=64){blocks[id]={...make(opcode,null),fields,topLevel:true,x:64,y};blocks[id].next=chain(commands,id);return id;}
 return {blocks,hat};
}
function originalCostume(name,kind,backdrop=false){const [w,h]=backdrop?[480,360]:{fox:[112,104],robot:[100,112],star:[108,108]}[kind];return {name,assetId:ASSET_IDS[kind],dataFormat:'svg',md5ext:`${ASSET_IDS[kind]}.svg`,bitmapResolution:1,rotationCenterX:w/2,rotationCenterY:h/2};}
function customCostume(asset,name,backdrop=false){return {name,assetId:asset.id,dataFormat:'png',md5ext:`${asset.id}.png`,bitmapResolution:backdrop?1:2,rotationCenterX:asset.width/2,rotationCenterY:asset.height/2};}
function soundRef(asset){return {name:asset.name,assetId:asset.id,dataFormat:'wav',format:'',rate:asset.rate,sampleCount:asset.sampleCount,md5ext:`${asset.id}.wav`};}
const chime={id:ASSET_IDS.beep,name:'Chime',dataFormat:'wav',rate:8000,sampleCount:1280};
/** One real Scratch project contains every scene; native broadcasts coordinate scene lifecycles. */
export function compileJuniorProject(project){
 const scenes=project.scenes;if(!scenes?.length)throw new Error('Choose a scene first.');
 const initial=scenes.find(s=>s.id===project.selectedSceneId)||scenes[0],assets=new Map(),media=new Map((project.assets||[]).map(a=>[a.id,a])),broadcasts={};
 const add=(key,value)=>assets.set(key,value);
 const addOriginal=kind=>add(`${ASSET_IDS[kind]}.svg`,{md5ext:`${ASSET_IDS[kind]}.svg`,dataFormat:'svg',data:BACKDROP_ART[kind]||SPRITE_ART[kind]});
 const addCustom=asset=>{if(asset)add(`${asset.id}.${asset.dataFormat}`,{md5ext:`${asset.id}.${asset.dataFormat}`,dataFormat:asset.dataFormat,data:asset.data,encoding:'base64'});};
 add(`${ASSET_IDS.beep}.wav`,{md5ext:`${ASSET_IDS.beep}.wav`,dataFormat:'wav',data:BEEP_BASE64,encoding:'base64'});
 const customSounds=(project.assets||[]).filter(a=>a.dataFormat==='wav');customSounds.forEach(addCustom);
 const soundNames=new Map(customSounds.map(a=>[a.id,`${a.name} ${a.id.slice(0,5)}`]));
 const costumes=scenes.map((scene,i)=>{const custom=media.get(scene.backdropAssetId);if(custom){addCustom(custom);return customCostume(custom,`Scene ${i+1}`,true);}addOriginal(scene.background);return originalCostume(`Scene ${i+1}`,scene.background,true);});
 const extensions=new Set(),stageBuild=builder('junior-stage',broadcasts),currentScene=variable('Scene',SCENE);
 function sceneCommands(scene){return [stop('other scripts in sprite'),command('sound_stopallsounds'),command('data_setvariableto',{VALUE:scene.id},{VARIABLE:['Scene',SCENE]}),command('looks_switchbackdropto',{BACKDROP:`Scene ${scenes.indexOf(scene)+1}`}),broadcast('__duet_setup',true),broadcast(startName(scene.id))];}
 stageBuild.hat('junior-stage-flag','event_whenflagclicked',{},sceneCommands(initial));
 scenes.forEach((scene,i)=>{broadcasts[goName(scene.id)]=goName(scene.id);stageBuild.hat(`junior-stage-go-${i}`,'event_whenbroadcastreceived',{BROADCAST_OPTION:[goName(scene.id),goName(scene.id)]},sceneCommands(scene),220+i*180);});
 const common={lists:{},comments:{},volume:100};
 const stage={...common,isStage:true,name:'Stage',variables:{[SCENE]:['Scene',initial.id]},broadcasts,blocks:stageBuild.blocks,costumes,sounds:[],currentCostume:scenes.indexOf(initial),layerOrder:0,tempo:60,videoTransparency:50,videoState:'off',textToSpeechLanguage:null};
 const names=new Map(),usedNames=new Set();scenes.forEach(scene=>scene.sprites.forEach(sprite=>{let name=sprite.name,number=2;while(usedNames.has(name))name=`${sprite.name} ${number++}`;usedNames.add(name);names.set(`${scene.id}/${sprite.id}`,name);}));
 const targets=[];
 scenes.forEach((scene,sceneIndex)=>scene.sprites.forEach((sprite,spriteIndex)=>{
  const prefix=`scene${sceneIndex}-${sprite.id}`,build=builder(prefix,broadcasts),speedId=`${prefix}-${SPEED}`,speed=variable('Speed',speedId),active=eq(currentScene,scene.id),positionX=expr('motion_xposition'),positionY=expr('motion_yposition');
  const x=boundedNumber(sprite.x,-240,240,0),y=boundedNumber(sprite.y,-180,180,0),size=boundedNumber(sprite.size,20,200,85),direction=boundedNumber(sprite.direction,-180,180,90);
  addOriginal(sprite.kind);const spriteCostumes=[originalCostume(sprite.name,sprite.kind),...(sprite.costumeAssetIds||[]).map(id=>{const asset=media.get(id);if(!asset)throw new Error('A costume is missing.');addCustom(asset);return customCostume(asset,`${asset.name} ${id.slice(0,5)}`);})];
  const initialCostume=Math.min(spriteCostumes.length-1,Math.max(0,Math.round(sprite.initialCostume||0)));
	  function conditionFor(value){
	   const condition=validateJuniorCondition(value);
	   if(condition.kind==='touchingEdge')return expr('sensing_touchingobject',{TOUCHINGOBJECTMENU:'_edge_'});
	   if(condition.kind==='touchingCharacter')return scene.sprites.filter(s=>s.id!==sprite.id).map(s=>expr('sensing_touchingobject',{TOUCHINGOBJECTMENU:names.get(`${scene.id}/${s.id}`)})).reduce((a,b)=>a?expr('operator_or',{OPERAND1:a,OPERAND2:b}):b,null)||eq(0,1);
	   if(condition.kind==='keyPressed')return expr('sensing_keypressed',{KEY_OPTION:condition.key});
	   const extension={image:'duetML',sound:'duetSound',pose:'duetPose'}[condition.model];extensions.add(extension);
	   const accepted=expr(`${extension}_isAccepted`);
	   // A rejected prediction must not trigger a class action, even when the
	   // student's label happens to be "Unknown". Recognition is explicit.
	   return condition.kind==='mlAccepted'?accepted:expr('operator_and',{OPERAND1:accepted,OPERAND2:eq(expr(`${extension}_label`),condition.label)});
	  }
  function compile(items){return items.flatMap(source=>{const def=BLOCK_TYPES[source.type];if(!Object.hasOwn(BLOCK_TYPES,source.type))throw new Error(`Unsupported Junior block ${source.type}.`);const v=def.value===undefined?0:boundedNumber(source.value,def.min,def.max,def.value);const choice=source.choice??def.choice;const basic={direction:['motion_pointindirection','DIRECTION'],setX:['motion_setx','X'],setY:['motion_sety','Y'],volume:['sound_setvolumeto','VOLUME'],move:['motion_movesteps','STEPS'],turn:['motion_turnright','DEGREES'],turnLeft:['motion_turnleft','DEGREES'],wait:['control_wait','DURATION'],grow:['looks_changesizeby','CHANGE'],penSize:['pen_setPenSizeTo','SIZE']};
   if(basic[source.type]){if(source.type==='penSize')extensions.add('pen');const [op,input]=basic[source.type];return [command(op,{[input]:v})];}
   if(['right','left','up','down'].includes(source.type)){const dx=source.type==='right'?v*20:source.type==='left'?-v*20:0,dy=source.type==='up'?v*20:source.type==='down'?-v*20:0;return [command('motion_glidesecstoxy',{SECS:math('divide',Math.max(.03,v*.3),speed),X:math('add',positionX,dx),Y:math('add',positionY,dy)})];}
   switch(source.type){
    case'bounce':return [command('motion_ifonedgebounce')];
    case'rotationStyle':return [command('motion_setrotationstyle',{}, {STYLE:[['left-right','all around',"don't rotate"].includes(choice)?choice:'left-right',null]})];
    case'waitUntil':return [command('control_wait_until',{CONDITION:conditionFor(source.condition)})];
    case'repeatUntil':return [{...command('control_repeat_until',{CONDITION:conditionFor(source.condition)}),children:compile(source.children||[])}];
    case'hop':return [command('motion_glidesecstoxy',{SECS:math('divide',Math.max(.05,v*.12),speed),X:positionX,Y:math('add',positionY,v*20)}),command('motion_glidesecstoxy',{SECS:math('divide',Math.max(.05,v*.12),speed),X:positionX,Y:math('subtract',positionY,v*20)})];
    case'home':return [command('motion_gotoxy',{X:x,Y:y})];
    case'random':return [command('motion_gotoxy',{X:expr('operator_random',{FROM:-200,TO:200}),Y:expr('operator_random',{FROM:-140,TO:140})})];
    case'say':return [command('looks_sayforsecs',{MESSAGE:source.text||'',SECS:v})];
    case'shrink':return [command('looks_changesizeby',{CHANGE:-v})];
    case'resetSize':return [command('looks_setsizeto',{SIZE:size})];
    case'show':return [command('looks_show')];case'hide':return [command('looks_hide')];
    case'nextCostume':return [command('looks_nextcostume')];
    case'costume':return [command('looks_switchcostumeto',{COSTUME:choice==='first'?spriteCostumes[0].name:spriteCostumes[(sprite.costumeAssetIds||[]).indexOf(choice)+1]?.name||spriteCostumes[0].name})];
    case'repeat':return [{...command('control_repeat',{TIMES:Math.round(v)}),children:compile(source.children||[])}];
    case'forever':return [{...command('control_forever'),children:compile(source.children||[])}];
	    case'if':case'ifElse':return [{...command(source.type==='ifElse'?'control_if_else':'control_if',{CONDITION:conditionFor(source.condition)}),children:compile(source.children||[]),...(source.type==='ifElse'?{elseChildren:compile(source.elseChildren||[])}:{})}];
    case'stop':return [stop(['all','this script','other scripts in sprite'].includes(choice)?choice:'all')];
    case'end':return [stop('this script')];
    case'speed':return [command('data_setvariableto',{VALUE:{slow:.5,normal:1,fast:3}[choice]||1},{VARIABLE:['Speed',speedId]})];
    case'message':case'messageWait':return [broadcast(`Junior ${MESSAGE_COLORS.includes(choice)?choice:'orange'}`,source.type==='messageWait')];
    case'scene':{const destination=scenes.find(s=>s.id===choice)||scenes[(sceneIndex+1)%scenes.length];return [broadcast(goName(destination.id)),stop('this script')];}
    case'sound':case'startSound':return [command(source.type==='sound'?'sound_playuntildone':'sound_play',{SOUND_MENU:soundNames.get(choice)||'Chime'})];
    case'stopSounds':return [command('sound_stopallsounds')];
    case'penDown':extensions.add('pen');return [command('pen_penDown')];case'penUp':extensions.add('pen');return [command('pen_penUp')];case'clear':extensions.add('pen');return [command('pen_clear')];case'stamp':extensions.add('pen');return [command('pen_stamp')];case'penColor':extensions.add('pen');return [command('pen_setPenColorToColor',{COLOR:{_color:/^#[0-9a-f]{6}$/i.test(choice)?choice:'#7c5bc5'}})];
    case'predict':{const ext={image:'duetML',sound:'duetSound',pose:'duetPose'}[choice]||'duetML';extensions.add(ext);return [command(`${ext}_predict`)];}
    case'sayPrediction':{const ext={image:'duetML',sound:'duetSound',pose:'duetPose'}[choice]||'duetML';extensions.add(ext);return [command('looks_sayforsecs',{MESSAGE:expr(`${ext}_label`),SECS:v})];}
    case'pinHigh':case'pinLow':case'pwm':case'servo':case'tone':case'noTone':case'analogSay':case'digitalSay':{extensions.add('duetHardware');const pin=String(choice||'13');if(source.type==='analogSay'||source.type==='digitalSay')return [command('looks_sayforsecs',{MESSAGE:expr(`duetHardware_${source.type==='analogSay'?'readAnalog':'readDigital'}`,{PIN:pin}),SECS:2})];if(source.type==='servo')return [command('duetHardware_servoWrite',{PIN:pin,ANGLE:v})];if(source.type==='tone')return [command('duetHardware_tone',{PIN:pin,FREQUENCY:v,DURATION:1})];if(source.type==='noTone')return [command('duetHardware_noTone',{PIN:pin})];return [command('duetHardware_setPinMode',{PIN:pin,MODE:'OUTPUT'}),command(`duetHardware_${source.type==='pwm'?'analogWrite':'digitalWrite'}`,{PIN:pin,VALUE:source.type==='pwm'?v:source.type==='pinHigh'?1:0})];}
    default:throw new Error(`Cannot run ${source.type}.`);
   }
  });}
  const setup=[stop('other scripts in sprite'),command('motion_setrotationstyle',{}, {STYLE:['all around',null]}),command('sound_setvolumeto',{VOLUME:100}),{...command('control_if_else',{CONDITION:active}),children:[command('motion_gotoxy',{X:x,Y:y}),command('motion_pointindirection',{DIRECTION:direction}),command('looks_setsizeto',{SIZE:size}),command('looks_switchcostumeto',{COSTUME:spriteCostumes[initialCostume].name}),command('data_setvariableto',{VALUE:1},{VARIABLE:['Speed',speedId]}),command('looks_show')],elseChildren:[command('looks_hide')]}];
  broadcasts.__duet_setup='__duet_setup';build.hat(`${prefix}-setup`,'event_whenbroadcastreceived',{BROADCAST_OPTION:['__duet_setup','__duet_setup']},setup);
  sprite.scripts.forEach((script,i)=>{
   const commands=compile(script.blocks),hatId=`${prefix}-script-${i}`,start=startName(scene.id);broadcasts[start]=start;
   if(script.trigger==='key'){if(!JUNIOR_KEYS.includes(script.key??'space'))throw new Error('Choose a supported key for the Junior start event.');build.hat(hatId,'event_whenkeypressed',{KEY_OPTION:[script.key??'space',null]},[{...command('control_if',{CONDITION:active}),children:commands}],260+i*200);}
   else if(script.trigger==='tap'){build.hat(hatId,'event_whenthisspriteclicked',{},[{...command('control_if',{CONDITION:active}),children:commands}],260+i*200);}
   else if(script.trigger==='message'){const name=`Junior ${script.message||'orange'}`;broadcasts[name]=name;build.hat(hatId,'event_whenbroadcastreceived',{BROADCAST_OPTION:[name,name]},[{...command('control_if',{CONDITION:active}),children:commands}],260+i*200);}
   else if(script.trigger==='bump'){
    const others=scene.sprites.filter(s=>s.id!==sprite.id).map(s=>expr('sensing_touchingobject',{TOUCHINGOBJECTMENU:names.get(`${scene.id}/${s.id}`)}));const touching=others.reduce((result,item)=>result?expr('operator_or',{OPERAND1:result,OPERAND2:item}):item,null)||eq(0,1);
    build.hat(hatId,'event_whenbroadcastreceived',{BROADCAST_OPTION:[start,start]},[{...command('control_forever'),children:[command('control_wait_until',{CONDITION:touching}),...commands,command('control_wait_until',{CONDITION:not(touching)})]}],260+i*200);
   }else build.hat(hatId,'event_whenbroadcastreceived',{BROADCAST_OPTION:[start,start]},commands,260+i*200);
  });
  targets.push({...common,isStage:false,name:names.get(`${scene.id}/${sprite.id}`),variables:{[speedId]:['Speed',1]},broadcasts:{},blocks:build.blocks,costumes:spriteCostumes,sounds:[soundRef(chime),...customSounds.map(a=>soundRef({...a,name:soundNames.get(a.id)}))],currentCostume:initialCostume,layerOrder:targets.length+1,visible:scene.id===initial.id,x,y,size,direction,draggable:false,rotationStyle:'all around'});
 }));
 // Pen state belongs to each sprite and must reset before each scene starts.
 if(extensions.has('pen')){for(const target of targets){const setup=Object.values(target.blocks).find(b=>b.opcode==='event_whenbroadcastreceived'&&b.fields.BROADCAST_OPTION?.[0]==='__duet_setup');if(setup){const id=`${target.name}-pen-reset`,next=setup.next;target.blocks[id]={opcode:'pen_penUp',next,parent:Object.keys(target.blocks).find(key=>target.blocks[key]===setup),inputs:{},fields:{},shadow:false,topLevel:false};if(next)target.blocks[next].parent=id;setup.next=id;}}}
 return {project:{targets:[stage,...targets],monitors:[],extensions:[...extensions],meta:{semver:'3.0.0',vm:'0.2.0',agent:'DuetBlox Junior'}},assets:[...assets.values()]};
}

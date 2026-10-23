import test from 'node:test';
import assert from 'node:assert/strict';
import {createJuniorStageQueue} from './stage-queue.js';
import {createHash} from 'node:crypto';
import {compileJuniorProject, makeJuniorBlock, makeJuniorProject, makeJuniorScene, makeJuniorSprite, parseJuniorProject,
  removeJuniorBlock, serializeJuniorProject, updateBlockList,findJuniorBlock,resolveJuniorBranch,BLOCK_TYPES,JUNIOR_BLOCK_HELP,findJuniorBlocks,countJuniorBlocks,copyJuniorBlock,copyJuniorScript,makeJuniorScript,juniorSequenceWarning} from './model.js';

test('Junior project round trips and keeps scene, sprite and block values', () => {
  const project = makeJuniorProject();
  const loaded = parseJuniorProject(serializeJuniorProject(project));
  assert.equal(loaded.title, project.title);
  assert.equal(loaded.selectedSceneId, project.selectedSceneId);
  assert.equal(loaded.scenes[0].sprites[0].scripts[0].blocks[1].text, 'Hello, world!');
  assert.equal(loaded.scenes[0].sprites[0].scripts[0].blocks[0].value, 40);
});

test('compiler connects flag, sequential motion, nested repeat, and post-repeat continuation', () => {
  const project = makeJuniorProject();
  const sprite = project.scenes[0].sprites[0];
  sprite.scripts[0].blocks = [{...makeJuniorBlock('repeat'), value: 3, children: [makeJuniorBlock('move'), makeJuniorBlock('turn')]}, makeJuniorBlock('say')];
  const {project: sb3} = compileJuniorProject(project);
  const blocks = sb3.targets[1].blocks;
  const flagId = Object.keys(blocks).find(id => id.endsWith('-script-0'));
  const flag = blocks[flagId];
  assert.equal(flag.opcode, 'event_whenbroadcastreceived');
  assert.match(flag.fields.BROADCAST_OPTION[0], /^__duet_start_/);
  const repeat = blocks[flag.next];
  assert.equal(repeat.opcode, 'control_repeat');
  assert.equal(repeat.parent, flagId);
  assert.deepEqual(repeat.inputs.TIMES, [1, [4, '3']]);
  const firstChild = blocks[repeat.inputs.SUBSTACK[1]];
  assert.equal(firstChild.opcode, 'motion_movesteps');
  assert.equal(firstChild.parent, flag.next);
  assert.equal(blocks[firstChild.next].opcode, 'motion_turnright');
  assert.equal(blocks[firstChild.next].next, null);
  assert.equal(blocks[repeat.next].opcode, 'looks_sayforsecs');
  for (const [id, block] of Object.entries(blocks)) {
    if (block.next) assert.ok(blocks[block.next], `${id} next reference exists`);
    if (block.parent) assert.ok(blocks[block.parent], `${id} parent reference exists`);
  }
});

test('every Scratch costume and sound reference has a real matching MD5 asset', () => {
  const project = makeJuniorProject();
  project.scenes[0].sprites.push(makeJuniorSprite('robot'), makeJuniorSprite('star'));
  const compiled = compileJuniorProject(project);
  const assets = new Map(compiled.assets.map(asset => [asset.md5ext, asset]));
  for (const target of compiled.project.targets) {
    for (const assetRef of [...target.costumes, ...target.sounds]) {
      const asset = assets.get(assetRef.md5ext);
      assert.ok(asset, `present asset ${assetRef.name}`);
      const bytes = asset.encoding === 'base64' ? Buffer.from(asset.data, 'base64') : Buffer.from(asset.data, 'utf8');
      assert.equal(createHash('md5').update(bytes).digest('hex'), assetRef.assetId);
      assert.ok(bytes.length > 100);
    }
  }
});

test('compiler retains all scenes and initially shows only the selected scene', () => {
  const project = makeJuniorProject();
  const other = makeJuniorScene(1);
  other.sprites.push(makeJuniorSprite('robot'));
  project.scenes.push(other); project.selectedSceneId = other.id;
  const {project: sb3} = compileJuniorProject(project);
  assert.equal(sb3.targets.length, 4);
  assert.equal(sb3.targets[0].currentCostume, 1);
  assert.equal(sb3.targets[0].costumes.length, 2);
  assert.equal(sb3.targets[1].visible, false);
  assert.equal(sb3.targets[2].visible, true);
  assert.equal(sb3.targets[3].name, 'Robot');
  assert.ok(Object.values(sb3.targets[3].blocks).some(b=>b.opcode==='event_whenbroadcastreceived'));
});

test('nested edits and deletion keep the remaining program intact', () => {
  const repeat = {...makeJuniorBlock('repeat'), children: [makeJuniorBlock('move'), makeJuniorBlock('wait')]};
  const [updated] = updateBlockList([repeat], repeat.children[0].id, {value: 78});
  assert.equal(updated.children[0].value, 78);
  assert.equal(repeat.children[0].value, 20);
  assert.equal(removeJuniorBlock([updated], updated.children[0].id)[0].children[0].type, 'wait');
});

test('project import rejects incompatible schema and unknown execution blocks', () => {
  assert.throws(() => parseJuniorProject('{}'), /Junior/);
  const project = makeJuniorProject();
  project.scenes[0].sprites[0].scripts[0].blocks.push({type: 'execute-js'});
  assert.throws(() => parseJuniorProject(project), /Unsupported/);
});

test('import bounds numeric values and rejects ambiguous scene selection', () => {
  const project = makeJuniorProject();
  project.scenes[0].sprites[0].scripts[0].blocks[0].value = 99999;
  assert.equal(parseJuniorProject(project).scenes[0].sprites[0].scripts[0].blocks[0].value, 480);
  project.scenes.push({...project.scenes[0]});
  assert.throws(() => parseJuniorProject(project), /duplicate/);
});

test('sound block compiles a Scratch sound menu shadow', () => {
  const project = makeJuniorProject();
  project.scenes[0].sprites[0].scripts[0].blocks = [makeJuniorBlock('sound')];
  const blocks = compileJuniorProject(project).project.targets[1].blocks;
  const sound = Object.values(blocks).find(block => block.opcode === 'sound_playuntildone');
  assert.equal(blocks[sound.inputs.SOUND_MENU[1]].fields.SOUND_MENU[0], 'Chime');
  assert.equal(blocks[sound.inputs.SOUND_MENU[1]].shadow, true);
});

test('v1 migration preserves programs while v2 retains multiple independent event scripts',()=>{
 const old=makeJuniorProject();old.version=1;delete old.assets;delete old.selectedScriptId;
 const migrated=parseJuniorProject(old);assert.equal(migrated.version,2);assert.equal(migrated.scenes[0].sprites[0].scripts[0].blocks[0].value,40);
 const sprite=migrated.scenes[0].sprites[0];sprite.scripts.push({id:'tap',trigger:'tap',blocks:[makeJuniorBlock('grow')]},{id:'blue',trigger:'message',message:'blue',blocks:[makeJuniorBlock('hide')]});
 const loaded=parseJuniorProject(serializeJuniorProject(migrated));assert.deepEqual(loaded.scenes[0].sprites[0].scripts.map(s=>s.trigger),['flag','tap','message']);assert.equal(loaded.scenes[0].sprites[0].scripts[2].message,'blue');
 const compiled=compileJuniorProject(loaded),blocks=Object.values(compiled.project.targets[1].blocks);
 assert.equal(blocks.filter(b=>b.opcode==='event_whenthisspriteclicked').length,1);
 assert.ok(blocks.some(b=>b.opcode==='event_whenbroadcastreceived'&&b.fields.BROADCAST_OPTION?.[0]==='Junior blue'));
 assert.ok(blocks.filter(b=>b.opcode==='control_if').length>=2,'tap and message programs guard their scene');
});

test('scene transitions reset characters and stop old loops before starting destination scripts',()=>{
 const project=makeJuniorProject(),next=makeJuniorScene(1);project.scenes.push(next);
 project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('scene'),choice:next.id}];
 const compiled=compileJuniorProject(project).project,stage=Object.values(compiled.targets[0].blocks);
 const requests=stage.filter(b=>b.opcode==='event_whenbroadcastreceived');assert.equal(requests.length,2);
 assert.ok(stage.some(b=>b.opcode==='event_broadcastandwait'&&b.inputs.BROADCAST_INPUT[1][1]==='__duet_setup'));
 for(const target of compiled.targets.slice(1))assert.ok(Object.values(target.blocks).some(b=>b.opcode==='control_stop'&&b.fields.STOP_OPTION[0]==='other scripts in sprite'));
 const source=Object.values(compiled.targets[1].blocks);assert.ok(source.some(b=>b.opcode==='event_broadcast'&&b.inputs.BROADCAST_INPUT[1][1]===`__duet_go_${next.id}`));
 assert.ok(source.some(b=>b.opcode==='control_stop'&&b.fields.STOP_OPTION[0]==='this script'));
});

test('bump watchers wait for contact and separation using unique target names',()=>{
 const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];project.scenes[0].sprites.push({...makeJuniorSprite(),name:sprite.name});
 sprite.scripts=[{id:'bump',trigger:'bump',blocks:[makeJuniorBlock('sound')]}];
 const compiled=compileJuniorProject(project).project,blocks=Object.values(compiled.targets[1].blocks);
 assert.notEqual(compiled.targets[1].name,compiled.targets[2].name);
 assert.equal(blocks.filter(b=>b.opcode==='control_wait_until').length,2);
 assert.ok(blocks.some(b=>b.opcode==='sensing_touchingobjectmenu'&&b.fields.TOUCHINGOBJECTMENU[0]===compiled.targets[2].name));
});

test('all extended block graphs have complete parent, next and nested input references',()=>{
 const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
 const types=['right','left','up','down','hop','home','random','turnLeft','grow','shrink','resetSize','show','hide','nextCostume','costume','speed','penDown','penUp','penColor','penSize','stamp','clear','message','predict','sayPrediction','pinHigh','pinLow','pwm','servo','tone','noTone','analogSay','digitalSay','stop','end'];
 sprite.scripts[0].blocks=types.map(makeJuniorBlock);sprite.scripts.push({id:'loop',trigger:'flag',blocks:[{...makeJuniorBlock('forever'),children:[makeJuniorBlock('wait')]}]});
 const {project:compiled}=compileJuniorProject(project);assert.ok(compiled.extensions.includes('pen'));assert.ok(compiled.extensions.includes('duetHardware'));assert.ok(compiled.extensions.includes('duetML'));
 const writes=Object.values(compiled.targets[1].blocks).filter(b=>b.opcode==='duetHardware_digitalWrite');
 assert.deepEqual(writes.map(b=>b.inputs.VALUE[1][1]),['1','0'],'hardware RPC expects numeric high and low levels');
 for(const target of compiled.targets)for(const [id,block] of Object.entries(target.blocks)){
  for(const ref of [block.next,block.parent])if(ref)assert.ok(target.blocks[ref],`${id} links ${ref}`);
  for(const input of Object.values(block.inputs))if(typeof input[1]==='string')assert.ok(target.blocks[input[1]],`${id} input links ${input[1]}`);
 }
});

test('decision story round trip retains both branches and nested condition parameters',()=>{
 const project=makeJuniorProject(),nested={...makeJuniorBlock('if'),condition:{kind:'keyPressed',key:'space'},children:[{...makeJuniorBlock('move'),value:17}]};
 const decision={...makeJuniorBlock('ifElse'),condition:{kind:'mlLabel',model:'pose',label:'Hands up'},children:[{...makeJuniorBlock('repeat'),value:3,children:[nested]}],elseChildren:[{...makeJuniorBlock('say'),text:'Try again',value:1}]};
 project.scenes[0].sprites[0].scripts[0].blocks=[decision];
 const loaded=parseJuniorProject(serializeJuniorProject(project)).scenes[0].sprites[0].scripts[0].blocks[0];
 assert.deepEqual(loaded.condition,decision.condition);assert.equal(loaded.children[0].value,3);
 assert.deepEqual(loaded.children[0].children[0].condition,nested.condition);
 assert.equal(loaded.children[0].children[0].children[0].value,17);assert.equal(loaded.elseChildren[0].text,'Try again');
});

test('nested edits, deletion and path recovery keep Then and Otherwise independent',()=>{
 const then=makeJuniorBlock('move'),otherwise=makeJuniorBlock('say');
 const nested={...makeJuniorBlock('repeat'),children:[otherwise]};
 const decision={...makeJuniorBlock('ifElse'),children:[then],elseChildren:[nested]};
 const original=[decision],changed=updateBlockList(original,otherwise.id,{text:'Otherwise worked'});
 assert.equal(findJuniorBlock(changed,otherwise.id).text,'Otherwise worked');assert.equal(otherwise.text,'Hello!');
 assert.deepEqual(changed[0].children,original[0].children);
 const path=[{id:decision.id,branch:'elseChildren'},{id:nested.id,branch:'children'}];
 assert.equal(resolveJuniorBranch(changed,path).blocks[0].text,'Otherwise worked');
 const removed=removeJuniorBlock(changed,nested.id),recovered=resolveJuniorBranch(removed,path);
 assert.equal(findJuniorBlock(removed,nested.id),undefined);assert.deepEqual(recovered.path,[path[0]]);assert.deepEqual(recovered.blocks,[]);
 assert.equal(removed[0].children[0].id,then.id);
 assert.deepEqual(resolveJuniorBranch(changed,[{id:then.id,branch:'children'}]).blocks,changed);
});

test('decision import rejects malformed predicates and branches rather than changing their meaning',()=>{
 const invalid=[undefined,{kind:'execute-js'},{kind:'mlAccepted',model:'text'},{kind:'mlLabel',model:'image',label:''},{kind:'mlLabel',model:'pose',label:'x'.repeat(81)},{kind:'keyPressed',key:'Escape'},{kind:'constructor'}];
 for(const condition of invalid){const project=makeJuniorProject();project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('ifElse'),condition}];assert.throws(()=>parseJuniorProject(project),/condition|decision|label|key/);}
 const project=makeJuniorProject();project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('ifElse'),elseChildren:{}}];
 assert.throws(()=>parseJuniorProject(project),/list of blocks/);
 project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('ifElse'),elseChildren:Array.from({length:1000},()=>makeJuniorBlock('wait'))}];
 assert.throws(()=>parseJuniorProject(project),/1,000/);
 let nested=makeJuniorBlock('wait');for(let i=0;i<9;i++)nested={...makeJuniorBlock('ifElse'),elseChildren:[nested]};
 project.scenes[0].sprites[0].scripts[0].blocks=[nested];assert.throws(()=>parseJuniorProject(project),/nested loops or decisions/);
});

test('compiled decisions keep both substacks, nested loops and the following action separate',()=>{
 const project=makeJuniorProject();
 project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('ifElse'),condition:{kind:'touchingEdge'},children:[{...makeJuniorBlock('repeat'),value:2,children:[makeJuniorBlock('turn')]}],elseChildren:[makeJuniorBlock('move'),makeJuniorBlock('wait')]},makeJuniorBlock('say')];
 const target=compileJuniorProject(project).project.targets[1],blocks=target.blocks,hat=Object.values(blocks).find(b=>b.opcode==='event_whenbroadcastreceived'&&b.fields.BROADCAST_OPTION[0].startsWith('__duet_start_'));
 const decisionId=hat.next,decision=blocks[decisionId];assert.equal(decision.opcode,'control_if_else');
 const thenId=decision.inputs.SUBSTACK[1],elseId=decision.inputs.SUBSTACK2[1];assert.equal(blocks[thenId].parent,decisionId);assert.equal(blocks[elseId].parent,decisionId);
 assert.equal(blocks[thenId].opcode,'control_repeat');assert.equal(blocks[thenId].next,null);
 assert.equal(blocks[blocks[thenId].inputs.SUBSTACK[1]].opcode,'motion_turnright');
 assert.equal(blocks[elseId].opcode,'motion_movesteps');assert.equal(blocks[blocks[elseId].next].opcode,'control_wait');assert.equal(blocks[blocks[elseId].next].next,null);
 assert.equal(blocks[decision.next].opcode,'looks_sayforsecs');assert.equal(blocks[decision.next].parent,decisionId);
 for(const [id,block]of Object.entries(blocks)){for(const ref of [block.parent,block.next])if(ref)assert.ok(blocks[ref],`${id} links ${ref}`);for(const input of Object.values(block.inputs))if(typeof input[1]==='string')assert.ok(blocks[input[1]],`${id} input exists`);}
});

test('accepted-label decisions require both acceptance and matching label for all three media models',()=>{
 for(const [model,extension]of [['image','duetML'],['sound','duetSound'],['pose','duetPose']]){
  const project=makeJuniorProject();project.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('if'),condition:{kind:'mlAccepted',model},children:[makeJuniorBlock('move')]},{...makeJuniorBlock('ifElse'),condition:{kind:'mlLabel',model,label:'Unknown'},children:[makeJuniorBlock('grow')],elseChildren:[makeJuniorBlock('hide')]}];
  const compiled=compileJuniorProject(project).project,blocks=compiled.targets[1].blocks;assert.ok(compiled.extensions.includes(extension));
  const decision=Object.values(blocks).find(b=>b.opcode==='control_if_else'&&b.inputs.SUBSTACK2&&blocks[b.inputs.SUBSTACK2[1]].opcode==='looks_hide'&&blocks[b.inputs.SUBSTACK[1]]?.opcode==='looks_changesizeby');
  const and=blocks[decision.inputs.CONDITION[1]];assert.equal(and.opcode,'operator_and');assert.equal(blocks[and.inputs.OPERAND1[1]].opcode,`${extension}_isAccepted`);
  const equals=blocks[and.inputs.OPERAND2[1]];assert.equal(equals.opcode,'operator_equals');assert.equal(blocks[equals.inputs.OPERAND1[1]].opcode,`${extension}_label`);assert.equal(equals.inputs.OPERAND2[1][1],'Unknown');
  assert.ok(!Object.values(blocks).some(b=>b.opcode===`${extension}_predict`),'decision does not silently classify or access inputs');
 }
});

test('character and key predicates compile real Scratch sensing with distinct character names',()=>{
 const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
 sprite.scripts[0].blocks=[{...makeJuniorBlock('if'),condition:{kind:'touchingCharacter'},children:[makeJuniorBlock('grow')]},{...makeJuniorBlock('if'),condition:{kind:'keyPressed',key:'space'},children:[makeJuniorBlock('move')]}];
 const alone=compileJuniorProject(project).project.targets[1].blocks;assert.ok(Object.values(alone).some(b=>b.opcode==='operator_equals'&&b.inputs.OPERAND1?.[1]?.[1]==='0'&&b.inputs.OPERAND2?.[1]?.[1]==='1'),'no other character produces a false condition');
 project.scenes[0].sprites.push({...makeJuniorSprite(),name:sprite.name},makeJuniorSprite('robot'));
 const compiled=compileJuniorProject(project).project,blocks=Object.values(compiled.targets[1].blocks),names=blocks.filter(b=>b.opcode==='sensing_touchingobjectmenu').map(b=>b.fields.TOUCHINGOBJECTMENU[0]);
 assert.deepEqual(names,[compiled.targets[2].name,compiled.targets[3].name]);assert.notEqual(compiled.targets[1].name,compiled.targets[2].name);
 assert.ok(blocks.some(b=>b.opcode==='operator_or'));assert.ok(blocks.some(b=>b.opcode==='sensing_keyoptions'&&b.shadow&&b.fields.KEY_OPTION[0]==='space'));
});


test('all Junior blocks have search descriptions and useful terms find them across categories',()=>{
 for(const type of Object.keys(BLOCK_TYPES))assert.ok(JUNIOR_BLOCK_HELP[type]?.length>15,type);
 assert.deepEqual(findJuniorBlocks('bounce').map(([type])=>type),['bounce']);
 assert.ok(findJuniorBlocks('digital input').some(([type])=>type==='digitalSay'));
 assert.deepEqual(findJuniorBlocks('sound','motion'),[]);
 assert.ok(findJuniorBlocks('TRUE').some(([type])=>type==='waitUntil'));
 assert.deepEqual(findJuniorBlocks('not-a-real-block'),[]);
});

test('duplicate nested blocks and scripts receive independent IDs and editable values',()=>{
 const original={...makeJuniorBlock('repeatUntil'),condition:{kind:'keyPressed',key:'space'},children:[{...makeJuniorBlock('ifElse'),children:[makeJuniorBlock('move')],elseChildren:[makeJuniorBlock('say')]}]};
 const copied=copyJuniorBlock(original);
 const ids=blocks=>blocks.flatMap(b=>[b.id,...ids(b.children||[]),...ids(b.elseChildren||[])]);
 assert.equal(countJuniorBlocks([original]),4);assert.equal(countJuniorBlocks([copied]),4);
 assert.equal(new Set([...ids([original]),...ids([copied])]).size,8);
 copied.condition.key='a';copied.children[0].elseChildren[0].text='Copied';
 assert.equal(original.condition.key,'space');assert.equal(original.children[0].elseChildren[0].text,'Hello!');
 const script={...makeJuniorScript('key'),key:'z',blocks:[original]},copy=copyJuniorScript(script);
 assert.notEqual(copy.id,script.id);assert.equal(copy.key,'z');assert.notEqual(copy.blocks[0].id,original.id);
});

test('keyboard starts and until predicates round trip without changing their meaning',()=>{
 const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
 sprite.scripts=[{...makeJuniorScript('key'),key:'left arrow',blocks:[{...makeJuniorBlock('waitUntil'),condition:{kind:'keyPressed',key:'space'}},{...makeJuniorBlock('repeatUntil'),condition:{kind:'touchingEdge'},children:[makeJuniorBlock('move')]}]}];
 const restored=parseJuniorProject(serializeJuniorProject(project)).scenes[0].sprites[0].scripts[0];
 assert.equal(restored.key,'left arrow');assert.equal(restored.trigger,'key');assert.equal(restored.blocks[0].condition.key,'space');assert.equal(restored.blocks[1].children[0].type,'move');
 sprite.scripts[0].key='Escape';assert.throws(()=>parseJuniorProject(project),/supported key/);
 for(const type of ['constructor','__proto__','toString']){assert.throws(()=>makeJuniorBlock(type),/Unknown block/);sprite.scripts=[{...makeJuniorScript(),blocks:[{type}]}];assert.throws(()=>parseJuniorProject(project),/Unsupported Junior block/);}
 sprite.scripts=[{...makeJuniorScript(),trigger:'constructor'}];assert.throws(()=>parseJuniorProject(project),/Unsupported Junior start/);
});

test('new basic blocks compile native Scratch inputs, correct menus and scene-guarded key hats',()=>{
 const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
 sprite.scripts=[{...makeJuniorScript('key'),key:'up arrow',blocks:['bounce','direction','setX','setY','rotationStyle','waitUntil','repeatUntil','messageWait','startSound','stopSounds','volume'].map(makeJuniorBlock)}];
 const compiled=compileJuniorProject(project).project,blocks=Object.values(compiled.targets[1].blocks);
 for(const opcode of ['motion_ifonedgebounce','motion_pointindirection','motion_setx','motion_sety','motion_setrotationstyle','control_wait_until','control_repeat_until','event_broadcastandwait','sound_play','sound_stopallsounds','sound_setvolumeto'])assert.ok(blocks.some(block=>block.opcode===opcode),opcode);
 const hat=blocks.find(block=>block.opcode==='event_whenkeypressed');assert.deepEqual(hat.fields.KEY_OPTION,['up arrow',null]);assert.equal(compiled.targets[1].blocks[hat.next].opcode,'control_if');
 const sound=blocks.find(block=>block.opcode==='sound_play'),menu=compiled.targets[1].blocks[sound.inputs.SOUND_MENU[1]];assert.equal(menu.fields.SOUND_MENU[0],'Chime');
 assert.ok(blocks.some(block=>block.opcode==='motion_setrotationstyle'&&block.fields.STYLE[0]==='left-right'));
 assert.ok(Object.values(compiled.targets[0].blocks).some(block=>block.opcode==='sound_stopallsounds'),'scene transitions stop lingering sounds');
 for(const target of compiled.targets)for(const [id,block]of Object.entries(target.blocks)){for(const ref of [block.next,block.parent])if(ref)assert.ok(target.blocks[ref],`${id} links ${ref}`);for(const input of Object.values(block.inputs))if(typeof input[1]==='string')assert.ok(target.blocks[input[1]],`${id} input exists`);}
});


test('beginner sequence advice flags steps after terminal blocks but allows waiting and other-script stops',()=>{
 for(const type of ['forever','end','scene','stop'])assert.match(juniorSequenceWarning([makeJuniorBlock(type),makeJuniorBlock('move')]),/1 block after .* will not run/);
 for(const type of ['repeatUntil','waitUntil','messageWait'])assert.equal(juniorSequenceWarning([makeJuniorBlock(type),makeJuniorBlock('move')]),'');
 assert.equal(juniorSequenceWarning([{...makeJuniorBlock('stop'),choice:'other scripts in sprite'},makeJuniorBlock('move')]),'');
 assert.equal(juniorSequenceWarning([makeJuniorBlock('forever')]),'');
});


test('slow stage loads coalesce previews and invalidate stale Play continuations',async()=>{
 const calls=[],gates=[];const queue=createJuniorStageQueue(project=>{calls.push(project);return new Promise(resolve=>gates.push(resolve));});
 const first=queue.load('first');await Promise.resolve();await Promise.resolve();
 const obsolete=queue.load('obsolete'),latest=queue.load('latest');
 gates.shift()();assert.equal(await first,false);assert.equal(await obsolete,false);
 await Promise.resolve();assert.deepEqual(calls,['first','latest']);
 queue.cancel();gates.shift()();assert.equal(await latest,false,'Stop invalidates the completed load before Play can start');
 const afterStop=queue.load('after-stop');await Promise.resolve();await Promise.resolve();gates.shift()();assert.equal(await afterStop,true);
});

test('restarting a stuck stage allows fresh loads without waiting for its old promise',async()=>{
 const calls=[];let release;const queue=createJuniorStageQueue(project=>{calls.push(project);return project==='stuck'?new Promise(resolve=>{release=resolve;}):Promise.resolve();});
 const old=queue.load('stuck');await Promise.resolve();await Promise.resolve();queue.reset();assert.equal(await queue.load('new-frame'),true);release();assert.equal(await old,false);assert.deepEqual(calls,['stuck','new-frame']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getBuiltinCostumes,juniorCostumeChoices} from './assets.js';
import {makeJuniorProject,makeJuniorSprite,makeJuniorBlock,parseJuniorProject,serializeJuniorProject,compileJuniorProject} from './model.js';
const names=['Hello','Walk A','Walk B','Jump','Cheer','Think'];
function story(kind='zuni') {
  const project=makeJuniorProject(),sprite=makeJuniorSprite(kind);
  project.scenes[0].sprites=[sprite];project.selectedSpriteId=sprite.id;project.selectedScriptId=sprite.scripts[0].id;
  return {project,sprite};
}
function customImage(){
  const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  return {id:createHash('md5').update(Buffer.from(data,'base64')).digest('hex'),name:'My costume',dataFormat:'png',data,width:1,height:1};
}
test('Junior Zuni keeps six distinct embedded SVG costumes and the chosen starting pose through save/open',()=>{
  const {project,sprite}=story();sprite.initialCostume=5;
  const loaded=parseJuniorProject(serializeJuniorProject(project));
  assert.equal(loaded.scenes[0].sprites[0].kind,'zuni');
  assert.equal(loaded.scenes[0].sprites[0].initialCostume,5);
  const compiled=compileJuniorProject(loaded),target=compiled.project.targets[1];
  assert.equal(target.name,'Zuni');assert.equal(target.currentCostume,5);
  assert.deepEqual(target.costumes.map(c=>c.name),names);
  assert.equal(new Set(target.costumes.map(c=>c.assetId)).size,6);
  for(const costume of target.costumes){
    const asset=compiled.assets.find(a=>a.md5ext===costume.md5ext);
    assert.ok(asset);assert.equal(createHash('md5').update(asset.data).digest('hex'),costume.assetId);
    assert.equal(costume.rotationCenterX,60);assert.equal(costume.rotationCenterY,60);
  }
});
test('every named Junior Zuni costume resolves to the matching native Scratch costume menu',()=>{
  const {project,sprite}=story();
  sprite.scripts[0].blocks=getBuiltinCostumes('zuni').map(c=>({...makeJuniorBlock('costume'),choice:c.choice}));
  sprite.scripts[0].blocks.push(makeJuniorBlock('nextCostume'));
  const target=compileJuniorProject(project).project.targets[1];
  const menus=Object.values(target.blocks).filter(b=>b.opcode==='looks_costume').map(b=>b.fields.COSTUME[0]);
  for(const name of names)assert.ok(menus.includes(name),name);
  assert.equal(Object.values(target.blocks).filter(b=>b.opcode==='looks_nextcostume').length,1);
});
test('uploaded costumes follow all Zuni poses while legacy characters keep their original indexes',()=>{
  for(const kind of ['zuni','fox','robot','star']){
    const {project,sprite}=story(kind),asset=customImage(),builtinCount=getBuiltinCostumes(kind).length;
    project.assets=[asset];sprite.costumeAssetIds=[asset.id];sprite.initialCostume=builtinCount;
    sprite.scripts[0].blocks=[{...makeJuniorBlock('costume'),choice:asset.id}];
    const loaded=parseJuniorProject(serializeJuniorProject(project));
    assert.equal(loaded.scenes[0].sprites[0].initialCostume,builtinCount);
    const target=compileJuniorProject(loaded).project.targets[1];
    assert.equal(target.currentCostume,builtinCount);assert.equal(target.costumes[builtinCount].assetId,asset.id);
    assert.equal(juniorCostumeChoices(sprite,project.assets)[builtinCount].choice,asset.id);
    assert.ok(Object.values(target.blocks).some(b=>b.opcode==='looks_costume'&&b.fields.COSTUME[0]===target.costumes[builtinCount].name));
  }
});
test('Zuni instances share immutable art but retain separate costumes and independent programs',()=>{
  const {project,sprite}=story(),second=makeJuniorSprite('zuni');second.initialCostume=4;
  second.scripts[0].blocks=[{...makeJuniorBlock('costume'),choice:'builtin:think'}];project.scenes[0].sprites.push(second);
  const compiled=compileJuniorProject(parseJuniorProject(project)),a=compiled.project.targets[1],b=compiled.project.targets[2];
  assert.equal(a.currentCostume,0);assert.equal(b.currentCostume,4);assert.notEqual(a.name,b.name);
  assert.notEqual(sprite.scripts[0].id,second.scripts[0].id);
  assert.equal(compiled.assets.filter(asset=>a.costumes.some(c=>c.md5ext===asset.md5ext)).length,6);
});

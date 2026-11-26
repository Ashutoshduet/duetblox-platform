import test from 'node:test';
import assert from 'node:assert/strict';
import {juniorStarter,starterFile} from './examples.js';
import {parseJuniorProject,serializeJuniorProject,compileJuniorProject} from '../junior/model.js';

test('Zuni welcome starts an independent portable story with matching selected sprite and native costumes',()=>{
 const story=juniorStarter('zuni'),other=juniorStarter('zuni');
 assert.equal(story.title,'Hello from Zuni');
 const sprite=story.scenes[0].sprites[0];
 assert.equal(sprite.name,'Zuni');assert.equal(sprite.kind,'zuni');
 assert.equal(story.selectedSpriteId,sprite.id);assert.equal(story.selectedScriptId,sprite.scripts[0].id);
 assert.notEqual(story.id,other.id);assert.notEqual(sprite.id,other.scenes[0].sprites[0].id);
 const saved=parseJuniorProject(serializeJuniorProject(story)),target=compileJuniorProject(saved).project.targets[1];
 assert.equal(target.costumes.length,6);assert.equal(target.currentCostume,0);
 const menus=Object.values(target.blocks).filter(b=>b.opcode==='looks_costume').map(b=>b.fields.COSTUME[0]);
 assert.ok(menus.includes('Jump'));assert.ok(menus.includes('Cheer'));
 assert.ok(Object.values(target.blocks).some(b=>b.opcode==='looks_sayforsecs'));
 assert.equal(target.x,0);assert.equal(target.y,-38);
});
test('generic first-story and downloadable lesson remain Fox without changing existing examples',()=>{
 const generic=juniorStarter(),download=starterFile('junior');
 assert.equal(generic.title,'Hello from Fox');assert.equal(generic.scenes[0].sprites[0].kind,'fox');
 assert.deepEqual(generic.scenes[0].sprites[0].scripts[0].blocks.map(b=>b.type),['right','say','hop']);
 assert.equal(download.name,'DUETBlox-Hello-Fox.junior.json');
 assert.equal(download.data.scenes[0].sprites[0].name,'Fox');
 assert.throws(()=>juniorStarter('unknown'),/Choose Fox or Zuni/);
});

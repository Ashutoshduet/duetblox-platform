import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createCharacterLibrary} from '../src/character-library.js';
import {ZUNI_COSTUMES} from '../../../src/characters/zuni.js';

const require = createRequire(import.meta.url);
const {ScratchStorage} = require('@scratch/scratch-storage');

test('Zuni library registers the exact six original SVGs in real ScratchStorage without network access', async () => {
  const storage = new ScratchStorage();
  const library = createCharacterLibrary(storage);
  assert.equal(library.dynamicAssets.sprites.length, 1);
  const sprite = library.dynamicAssets.sprites[0];
  assert.equal(sprite.name, 'Zuni'); assert.equal(sprite.isPublic, true);
  assert.equal(sprite.currentCostume, 0); assert.equal(sprite.rotationStyle, 'left-right');
  assert.deepEqual(sprite.costumes.map(c => c.name), ['Hello', 'Walk A', 'Walk B', 'Jump', 'Cheer', 'Think']);
  assert.equal(new Set(sprite.costumes.map(c => c.assetId)).size, 6);
  for (let index = 0; index < sprite.costumes.length; index++) {
    const costume = sprite.costumes[index], art = ZUNI_COSTUMES[index];
    assert.equal(costume.assetId, createHash('md5').update(art.svg).digest('hex'));
    assert.equal(costume.md5ext, `${costume.assetId}.svg`);
    assert.equal(costume.rotationCenterX, art.rotationCenterX);
    assert.equal(costume.rotationCenterY, art.rotationCenterY);
    const asset = await storage.load(storage.AssetType.ImageVector, costume.assetId, 'svg');
    assert.equal(asset.decodeText(), art.svg);
    assert.equal(library.getAssetURL(costume.assetId, 'svg'), asset.encodeDataURI());
    assert.match(library.getAssetURL(costume.assetId, 'svg'), /^data:image\/svg\+xml/);
  }
  assert.equal(library.getAssetURL('unrelated-Scratch-sprite', 'svg'), undefined);
  assert.equal(library.getAssetURL(sprite.costumes[0].assetId, 'png'), undefined);
});

test('separate editor libraries cannot mutate shared costume definitions or each other', () => {
  const artBefore = JSON.stringify(ZUNI_COSTUMES);
  const first = createCharacterLibrary(new ScratchStorage());
  const second = createCharacterLibrary(new ScratchStorage());
  first.dynamicAssets.sprites[0].x = 75;
  first.dynamicAssets.sprites[0].costumes[0].name = 'Edited student costume';
  assert.equal(second.dynamicAssets.sprites[0].x, 0);
  assert.equal(second.dynamicAssets.sprites[0].costumes[0].name, 'Hello');
  assert.equal(JSON.stringify(ZUNI_COSTUMES), artBefore);
});

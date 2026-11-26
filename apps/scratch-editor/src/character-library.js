import {ZUNI_COSTUMES} from '../../../src/characters/zuni.js';

/** Register original DUETBlox art through the pinned GUI's dynamicAssets API.
 * Assets are held by ScratchStorage, so adding a sprite works without a server
 * request and saveProjectSb3 includes every costume in the student's project.
 */
export function createCharacterLibrary(storage) {
  const thumbnails = new Map();
  const costumes = ZUNI_COSTUMES.map(costume => {
    const asset = storage.createAsset(storage.AssetType.ImageVector, storage.DataFormat.SVG,
      new TextEncoder().encode(costume.svg), null, true);
    storage.builtinHelper._store(asset.assetType, asset.dataFormat, asset.data, asset.assetId);
    const md5ext = `${asset.assetId}.svg`;
    thumbnails.set(md5ext, asset.encodeDataURI());
    return {name: costume.name, assetId: asset.assetId, md5ext, dataFormat: 'svg',
      bitmapResolution: 1, rotationCenterX: costume.rotationCenterX, rotationCenterY: costume.rotationCenterY};
  });
  const sprite = {
    name: 'Zuni', isPublic: true, tags: ['fantasy', 'robot', 'fox', 'duetblox'],
    isStage: false, costumes, sounds: [], variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
    currentCostume: 0, volume: 100, visible: true, x: 0, y: 0, size: 100, direction: 90,
    draggable: false, rotationStyle: 'left-right'
  };
  return {
    // Pinned @scratch/scratch-gui 15.2.0 merges public dynamic sprites into the
    // real Choose a Sprite library. VM addSprite provides unique duplicate names.
    dynamicAssets: {sprites: [sprite]},
    getAssetURL: (id, format) => thumbnails.get(`${id}.${format}`)
  };
}

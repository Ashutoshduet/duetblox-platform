import {editorAppPath} from './app-path';
export const duetSprite = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="112" viewBox="0 0 100 112"><path d="M50 12V3" stroke="#4b5cea" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="5" r="5" fill="#ffbf48"/><rect x="14" y="17" width="72" height="66" rx="22" fill="#6376f5"/><path d="M22 27h56v30c0 16-56 16-56 0z" fill="#8290ff"/><rect x="25" y="36" width="50" height="25" rx="12" fill="#212b56"/><circle cx="38" cy="48" r="5" fill="#fff"/><circle cx="62" cy="48" r="5" fill="#fff"/><path d="M42 70h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="3" y="43" width="12" height="30" rx="6" fill="#ffbf48"/><rect x="85" y="43" width="12" height="30" rx="6" fill="#ffbf48"/><rect x="23" y="81" width="18" height="23" rx="9" fill="#4b5cea"/><rect x="59" y="81" width="18" height="23" rx="9" fill="#4b5cea"/></svg>`;
export const blankBackdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><path fill="#fff" d="M0 0h480v360H0z"/></svg>`;

export function cacheDefaultProject(storage) {
  const costume = storage.createAsset(storage.AssetType.ImageVector, storage.DataFormat.SVG, new TextEncoder().encode(duetSprite), null, true);
  const backdrop = storage.createAsset(storage.AssetType.ImageVector, storage.DataFormat.SVG, new TextEncoder().encode(blankBackdrop), null, true);
  for (const asset of [costume, backdrop]) storage.builtinHelper._store(asset.assetType, asset.dataFormat, asset.data, asset.assetId);
  const project = {
    targets: [{isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0,
      costumes: [{assetId: backdrop.assetId, name: 'Backdrop', md5ext: `${backdrop.assetId}.svg`, dataFormat: 'svg', rotationCenterX: 240, rotationCenterY: 180}],
      sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null},
    {isStage: false, name: 'Duet', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0,
      costumes: [{assetId: costume.assetId, name: 'Duet', md5ext: `${costume.assetId}.svg`, dataFormat: 'svg', rotationCenterX: 50, rotationCenterY: 56}],
      sounds: [], volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around'}],
    monitors: [], extensions: [], meta: {semver: '3.0.0', vm: '15.2.0', agent: 'DUETBlox'}
  };
  // The official GUI asks its storage for project id 0 whenever File > New is used.
  storage.builtinHelper._store(storage.AssetType.Project, storage.DataFormat.JSON, JSON.stringify(project), 0);
  return project;
}

export function addAssetStore(storage) {
  storage.addWebStore([storage.AssetType.ImageVector, storage.AssetType.ImageBitmap, storage.AssetType.Sound],
    asset => editorAppPath(`scratch-media/${asset.assetId}.${asset.dataFormat}`));
}

import {cacheDefaultProject} from './default-project';
import {createExecutionControls} from './execution-controls';
const CHANNEL = 'duetblox';
const COMMANDS = new Set(['loadProject', 'resetProject', 'saveProject', 'getProject', 'greenFlag', 'stopAll', 'status', 'addExtension', 'keyboard', 'ping', 'setBoard', 'showBlock', 'watchValues', 'learningCheck', 'learningStart', 'learningStep', 'learningResume', 'learningStop', 'learningStatus', 'setEditorTab', 'setEditorMenu', 'getBlockCategories', 'selectBlockCategory']);
const builtins = new Set(['pen', 'music', 'videoSensing', 'faceSensing', 'text2speech', 'translate', 'microbit', 'wedo2', 'ev3', 'boost', 'makeymakey', 'gdxfor']);
const executionCommands = new Set(['greenFlag', 'learningStart', 'learningStep', 'learningResume']);
const priorityCommands = new Set(['stopAll', 'status', 'ping']);

export function createBridge(vm, {mode, ready, onAddExtension, onSetBoard, onShowBlocks, onSetEditorTab, onSetEditorMenu, onGetBlockCategories, onSelectBlockCategory}) {
  let sequence = 0;
  let queue = Promise.resolve();
  let executionGeneration = 0;
  const pending = new Map();
  const parentOrigin = location.origin;
  const post = (type, payload = {}, requestId) => {
    if (window.parent !== window) window.parent.postMessage({channel: CHANNEL, type, payload, ...(requestId ? {requestId} : {})}, parentOrigin);
  };
  const learning = mode === 'editor' ? createExecutionControls(vm, {onChange: state => post('learningStatus', state), onShowBlocks}) : null;
  const requireLearning = () => {if (!learning) throw new Error('Learning steps are available in the normal block editor.'); return learning;};
  window.addEventListener('pagehide', () => learning?.dispose(), {once: true});
  function rpc(extension, method, args) {
    if (window.parent === window) return Promise.reject(new Error('Open this editor from DUETBlox to use connected extensions.'));
    const requestId = `scratch-${Date.now()}-${++sequence}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`${extension} did not respond. Open its workspace and check the connection.`)); }, 30000);
      pending.set(requestId, {resolve, reject, timeout});
      post('extensionRequest', {extension, method, args}, requestId);
    }).catch(error => { post('extensionError', {extension, method, message: error.message}); throw error; });
  }
  const snapshot = () => ({mode, running: vm.runtime.threads.some(t => !t.updateMonitor), targets: vm.runtime.targets.filter(t => t.isOriginal).map(t => ({id: t.id, name: t.getName(), isStage: t.isStage, x: t.x, y: t.y})), extensions: [...vm.extensionManager._loadedExtensions.keys()], ...(learning ? {learning: learning.snapshot()} : {})});
  const handlers = {
    getBlockCategories: () => {
      if (mode !== 'editor' || !onGetBlockCategories) throw new Error('The block menu is available in the normal block editor.');
      return onGetBlockCategories();
    },
    selectBlockCategory: payload => {
      if (mode !== 'editor' || !onSelectBlockCategory) throw new Error('The block menu is available in the normal block editor.');
      return onSelectBlockCategory(payload.categoryId);
    },
    learningCheck: () => requireLearning().check(),
    learningStart: payload => requireLearning().start(payload.expectedRevision),
    learningStep: () => requireLearning().step(),
    learningResume: () => requireLearning().resume(),
    learningStop: () => requireLearning().stop('Learning steps stopped.'),
    learningStatus: () => requireLearning().snapshot(),
    setEditorTab: payload => {
      if (mode !== 'editor' || !onSetEditorTab) throw new Error('Editor tabs are available in the normal block editor.');
      if (!['code', 'costumes', 'sounds'].includes(payload.tab)) throw new Error('Choose code, costumes or sounds.');
      onSetEditorTab(payload.tab); return {tab: payload.tab};
    },
    setEditorMenu: payload => {
      if (mode !== 'editor' || !onSetEditorMenu) throw new Error('Editor menus are available in the normal block editor.');
      if (typeof payload.visible !== 'boolean') throw new Error('Editor menu visibility must be true or false.');
      onSetEditorMenu(payload.visible); return {visible: payload.visible};
    },
    setBoard: payload => {
      if (!onSetBoard) throw new Error('Board palette changes are available in the normal block editor.');
      return onSetBoard(payload.boardId);
    },
    showBlock: async payload => {
      const target = vm.runtime.targets.find(t => t.isOriginal && (!payload.targetName || t.getName() === payload.targetName) && t.blocks.getBlock(payload.blockId));
      if (!target) throw new Error('This block changed. Check the current program again.');
      onShowBlocks?.();
      vm.setEditingTarget(target.id);
      // Use the official GUI event contract, not private DOM/Blockly internals.
      let block = target.blocks.getBlock(payload.blockId); const seen = new Set();
      while (block.parent && !seen.has(block.id)) { seen.add(block.id); const parent = target.blocks.getBlock(block.parent); if (!parent) break; block = parent; }
      const id = block.id;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (vm.editingTarget !== target || !target.blocks.getBlock(id)) throw new Error('This script changed. Check the current program again.');
      vm.emit('SCRIPT_GLOW_ON', {id});
      setTimeout(() => {
        // The student can delete a block or switch sprites during the highlight.
        if (vm.editingTarget !== target || !target.blocks.getBlock(id)) return;
        try { vm.emit('SCRIPT_GLOW_OFF', {id}); } catch { /* The GUI can also unmount during navigation. */ }
      }, 1800);
      return {targetName: target.getName(), blockId: payload.blockId};
    },
    watchValues: () => {
      const values = [];
      for (const target of vm.runtime.targets.filter(t => t.isOriginal)) {
        for (const variable of Object.values(target.variables || {})) {
          if (variable.type !== '' && variable.type !== 'list') continue;
          values.push({id: `${target.id}:${variable.id}`, targetName: target.getName(), name: variable.name, type: variable.type || 'variable', value: variable.type === 'list' ? variable.value.slice(0, 10).map(v => String(v).slice(0, 120)) : String(variable.value).slice(0, 240), length: variable.type === 'list' ? variable.value.length : undefined});
        }
      }
      return {running: vm.runtime.threads.some(t => !t.updateMonitor), values: values.slice(0, 200), total: values.length};
    },
    ping: () => ({mode}),
    status: snapshot,
    loadProject: async payload => {
      if (payload.project == null) throw new Error('A project is required.');
      vm.stopAll();
      for (const asset of payload.assets || []) {
        if (!asset.md5ext || typeof asset.data !== 'string') throw new Error('Invalid project asset.');
        const format = (asset.dataFormat || asset.md5ext.split('.').pop()).toLowerCase();
        const assetId = asset.md5ext.slice(0, -(format.length + 1));
        const type = format === 'svg' ? vm.runtime.storage.AssetType.ImageVector : ['png','jpg','jpeg','gif','webp'].includes(format) ? vm.runtime.storage.AssetType.ImageBitmap : vm.runtime.storage.AssetType.Sound;
        const data = asset.encoding === 'base64' ? base64Bytes(asset.data) : new TextEncoder().encode(asset.data);
        vm.runtime.storage.builtinHelper._store(type, format, data, assetId);
      }
      const data = payload.encoding === 'base64' ? base64Bytes(payload.project) : typeof payload.project === 'object' ? JSON.stringify(payload.project) : payload.project;
      await vm.loadProject(data);
      vm.emitWorkspaceUpdate();
      vm.emitTargetsUpdate();
      return snapshot();
    },
    resetProject: async () => {
      vm.stopAll();
      await vm.loadProject(JSON.stringify(cacheDefaultProject(vm.runtime.storage)));
      vm.emitWorkspaceUpdate(); vm.emitTargetsUpdate();
      return snapshot();
    },
    saveProject: async () => {
      const blob = await vm.saveProjectSb3();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return {base64: bytesBase64(bytes), mimeType: 'application/x.scratch.sb3', filename: 'DUETBlox-project.sb3'};
    },
    getProject: () => ({project: JSON.parse(vm.toJSON())}),
    greenFlag: () => { vm.runtime.audioEngine?.audioContext?.resume(); vm.greenFlag(); return snapshot(); },
    stopAll: () => { vm.stopAll(); return snapshot(); },
    keyboard: payload => { vm.postIOData('keyboard', {key: payload.key, isDown: Boolean(payload.isDown)}); return {}; },
    addExtension: async payload => {
      if (!['duetHardware','duetML','duetSound','duetPose','duetText','duetNumbers','duetClassroom','duetData','duetObjects'].includes(payload.id) && !builtins.has(payload.id)) throw new Error('This extension is not in the DUETBlox catalog.');
      if (!vm.extensionManager.isExtensionLoaded(payload.id)) await vm.extensionManager.loadExtensionURL(payload.id);
      vm.emitWorkspaceUpdate();
      await onAddExtension?.(payload.id);
      return snapshot();
    }
  };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== parentOrigin || event.data?.channel !== CHANNEL) return;
    const {type, requestId, payload = {}} = event.data;
    if (type === 'extensionResult') {
      const item = pending.get(requestId);
      if (!item) return;
      clearTimeout(item.timeout); pending.delete(requestId);
      if (payload.error) item.reject(new Error(typeof payload.error === 'string' ? payload.error : payload.error.message || 'Extension operation failed.'));
      else item.resolve(payload.result);
      return;
    }
    if (!COMMANDS.has(type)) return;
    // Stop must remain usable while an asset import/export or extension is
    // waiting. Invalidate older queued Run requests before awaiting readiness,
    // otherwise one could silently start the program after the student stops.
    if (type === 'stopAll') executionGeneration++;
    const requestedGeneration = executionGeneration;
    const run = async () => {
      try {
        await ready;
        if (executionCommands.has(type) && requestedGeneration !== executionGeneration) {
          throw new Error('Run cancelled because Stop was pressed. Press Run again when you are ready.');
        }
        post('result', await handlers[type](payload), requestId);
      }
      catch (error) { post('error', {command: type, message: error.message || String(error)}, requestId); }
    };
    if (priorityCommands.has(type)) run();
    else queue = queue.then(run, run);
  });
  ready.then(() => post('ready', snapshot())).catch(error => post('error', {message: error.message}));
  // PROJECT_START also covers the native Scratch green flag, including a
  // project whose only hats are upload-only and therefore starts no threads.
  vm.runtime.on('PROJECT_START', () => {
    const hasUploadScript = vm.runtime.targets.some(target => target.isOriginal && target.blocks.getScripts()
      .some(id => target.blocks.getBlock(id)?.opcode === 'duetHardware_whenBoardStarts'));
    if (hasUploadScript) post('warning', {code: 'board-start-upload-only', message: 'Board-start scripts run only after compilation/upload. Use “when green flag clicked” for the browser or Virtual Board Lab.'});
  });
  vm.runtime.on('PROJECT_RUN_START', () => post('status', {running: true, mode}));
  vm.runtime.on('PROJECT_RUN_STOP', () => post('status', {running: false, mode}));
  vm.runtime.on('PROJECT_STOP_ALL', () => post('status', {running: false, stopped: true, mode}));
  vm.runtime.on('PROJECT_CHANGED', () => post('changed', {mode}));
  vm.runtime.on('DUET_EXTENSION_ERROR', detail => post('extensionError', detail));
  return {rpc, post, snapshot};
}

function base64Bytes(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
function bytesBase64(bytes) { let result = ''; for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(result); }

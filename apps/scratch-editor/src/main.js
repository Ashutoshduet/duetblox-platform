import {editorAppPath} from './app-path';
import {cacheDefaultProject, addAssetStore} from './default-project';
import {createBridge} from './bridge';
import {registerDuetExtensions} from './extensions';
import {createToolboxNavigation} from './toolbox-navigation';
import {createResponsiveStage} from './responsive-stage';

const mount = document.getElementById('app');
const mode = new URLSearchParams(location.search).get('mode') === 'stage' ? 'stage' : 'editor';

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.onload = resolve; script.onerror = () => reject(new Error(`Could not load editor component: ${src}`));
    document.head.appendChild(script);
  });
}

async function editor() {
  const studio = new URLSearchParams(location.search).get('studio') === '1';
  if (studio) document.body.classList.add('duet-studio');
  let menuVisible = !studio;
  await loadScript('./scratch-gui-standalone.js');
  const GUI = window.GUI;
  const storage = new GUI.ScratchStorage();
  cacheDefaultProject(storage);
  addAssetStore(storage);
  const config = {storage: {
    scratchStorage: storage,
    // Projects are saved through the official Download API / File menu and the
    // parent shell. No Scratch account or write endpoint is used.
    saveProject: async () => { throw new Error('Use Save to your computer to save this DUETBlox project.'); },
    getLibraryAssetUrl: (id, format) => editorAppPath(`scratch-media/${id}.${format}`)
  }};
  const state = new GUI.EditorState({locale: 'en', showTelemetryModal: false}, () => config);
  const disposeResponsiveStage = createResponsiveStage(state, GUI.setStageSize);
  const vm = state.store.getState().scratchGui.vm;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const activateCode = () => state.dispatch({type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: 0});
  const toolbox = createToolboxNavigation({mount, vm, activateCode,
    getToolboxXML: () => state.store.getState().scratchGui.toolbox.toolboxXML});
  const bridge = createBridge(vm, {mode, ready, onSetBoard: boardId => extensions.setBoard(boardId),
    // Pinned GUI 15.2.0 navigation reducer: reveal Code before showing an issue.
    onShowBlocks: activateCode,
    onGetBlockCategories: toolbox.getCategories,
    onSelectBlockCategory: toolbox.selectCategory,
    onAddExtension: categoryId => toolbox.selectCategory(categoryId, {waitForRegistration: true}),
    onSetEditorTab: tab => state.dispatch({type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: {code:0,costumes:1,sounds:2}[tab]}),
    onSetEditorMenu: visible => { menuVisible = visible; renderEditor(); }});
  const extensions = registerDuetExtensions(vm, bridge.rpc);
  GUI.setAppElement(mount);
  const root = GUI.createStandaloneRoot(state, mount);
  function renderEditor() { root.render({
    menuBarHidden: !menuVisible,
    canEditTitle: true, projectTitle: 'My DUETBlox project', canSave: false,
    canShare: false, canUseCloud: false, enableCommunity: false, backpackVisible: false,
    showComingSoon: false, showNewFeatureCallouts: false, showTelemetryModal: false,
    onClickLogo: () => bridge.post('navigate', {page: 'home'}),
    onProjectLoaded: () => { resolveReady(); brandEditor(); },
    onProjectTelemetryEvent: () => {}
  }); }
  renderEditor();
  state.dispatch(GUI.setProjectId('0'));
  // CSS uses the explicit logo id from official source; the observer updates the
  // accessible label if the menu is remounted after fullscreen/settings changes.
  const observer = new MutationObserver(brandEditor);
  observer.observe(mount, {childList: true, subtree: true});
  function brandEditor() {
    const logo = document.getElementById('logo_img');
    if (logo && logo.alt !== 'DUETBlox') { logo.src = './duetblox-logo.svg'; logo.alt = 'DUETBlox'; }
  }
  window.addEventListener('pagehide', () => { observer.disconnect(); disposeResponsiveStage(); vm.stopAll(); root.unmount(); });
}

(async () => {
  try {
    if (mode === 'stage') {
      document.body.classList.add('stage-only');
      const {startStage} = await import('./stage');
      await startStage(mount, loadScript);
    } else await editor();
  } catch (error) {
    mount.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'load-error'; panel.setAttribute('role', 'alert');
    const title = document.createElement('h2'); title.textContent = 'The editor could not start';
    const detail = document.createElement('p'); detail.textContent = error.message;
    const button = document.createElement('button'); button.textContent = 'Reload editor'; button.onclick = () => location.reload();
    panel.append(title, detail, button); mount.append(panel);
    console.error(error);
    if (parent !== window) parent.postMessage({channel: 'duetblox', type: 'error', payload: {message: error.message}}, location.origin);
  }
})();

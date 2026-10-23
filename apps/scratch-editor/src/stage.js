import AudioEngine from 'scratch-audio';
import {cacheDefaultProject, addAssetStore} from './default-project';
import {createBridge} from './bridge';
import {registerDuetExtensions} from './extensions';

export async function startStage(mount, loadScript) {
  await Promise.all([
    loadScript('./vendor/scratch-vm.js'), loadScript('./vendor/scratch-render.min.js'),
    loadScript('./vendor/scratch-storage.js'), loadScript('./vendor/scratch-svg-renderer.js')
  ]);
  const vm = new window.VirtualMachine();
  const storage = new window.ScratchStorage.ScratchStorage();
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Interactive project stage. Click to use keyboard controls.');
  mount.replaceChildren(canvas);
  const renderer = new window.ScratchRender(canvas);
  const audio = new AudioEngine();
  vm.attachStorage(storage);
  vm.attachRenderer(renderer);
  vm.attachAudioEngine(audio);
  vm.attachV2BitmapAdapter(new window.ScratchSVGRenderer.BitmapAdapter());
  vm.setCompatibilityMode(true);
  vm.setLocale('en');
  addAssetStore(storage);
  const project = cacheDefaultProject(storage);
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const bridge = createBridge(vm, {mode: 'stage', ready});
  registerDuetExtensions(vm, bridge.rpc);
  vm.start();
  await vm.loadProject(JSON.stringify(project));
  const resize = () => { const rect = mount.getBoundingClientRect(); renderer.resize(rect.width, rect.height); renderer.draw(); };
  const observer = new ResizeObserver(resize); observer.observe(mount);
  resize();
  const downKeys = new Set();
  const keyboard = (event, isDown) => {
    if (event.target instanceof HTMLInputElement) return;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    isDown ? downKeys.add(event.key) : downKeys.delete(event.key);
    vm.postIOData('keyboard', {key: event.key, isDown});
    if (isDown) audio.audioContext?.resume();
  };
  window.addEventListener('keydown', event => keyboard(event, true));
  window.addEventListener('keyup', event => keyboard(event, false));
  window.addEventListener('blur', () => { for (const key of downKeys) vm.postIOData('keyboard', {key, isDown: false}); downKeys.clear(); });
  const pointer = (event, isDown) => {
    const rect = canvas.getBoundingClientRect();
    vm.postIOData('mouse', {x: event.clientX - rect.left, y: event.clientY - rect.top, canvasWidth: rect.width, canvasHeight: rect.height, ...(typeof isDown === 'boolean' ? {isDown} : {})});
  };
  canvas.addEventListener('pointerdown', event => { canvas.focus(); canvas.setPointerCapture(event.pointerId); audio.audioContext?.resume(); pointer(event, true); });
  canvas.addEventListener('pointermove', event => pointer(event));
  canvas.addEventListener('pointerup', event => pointer(event, false));
  canvas.addEventListener('pointercancel', event => pointer(event, false));
  vm.runtime.on('QUESTION', question => {
    document.getElementById('stage-answer')?.remove();
    if (question == null) return;
    const form = document.createElement('form'); form.id = 'stage-answer';
    const label = document.createElement('label'); label.textContent = question;
    const input = document.createElement('input'); input.setAttribute('aria-label', 'Your answer');
    const submit = document.createElement('button'); submit.textContent = 'Answer'; submit.type = 'submit';
    label.append(input); form.append(label, submit); mount.append(form); input.focus();
    form.onsubmit = event => { event.preventDefault(); vm.runtime.emit('ANSWER', input.value); form.remove(); canvas.focus(); };
  });
  window.addEventListener('pagehide', () => { observer.disconnect(); vm.stopAll(); vm.quit(); });
  resolveReady();
}

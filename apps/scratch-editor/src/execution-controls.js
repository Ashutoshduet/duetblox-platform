import execute from '../node_modules/@scratch/scratch-vm/src/engine/execute';
import Thread from '../node_modules/@scratch/scratch-vm/src/engine/thread';
import vmPackage from '../node_modules/@scratch/scratch-vm/package.json';

// This adapter deliberately targets the pinned VM, not a public debugger API.
// Inputs and primitives run through the official interpreter. Only scheduling
// changes: one synchronous stack block per click, then round-robin scripts.
export const LEARNING_SCOPE = 'Green-flag scripts using synchronous core blocks and non-warp My Blocks. Waits, glides, sound, extensions, clones and other event hats use normal Run.';
const allowed = new Set(`
event_whenflagclicked
motion_movesteps motion_gotoxy motion_goto motion_turnright motion_turnleft motion_pointindirection motion_pointtowards motion_ifonedgebounce motion_setrotationstyle motion_changexby motion_setx motion_changeyby motion_sety motion_xposition motion_yposition motion_direction
looks_say looks_think looks_show looks_hide looks_switchcostumeto looks_nextcostume looks_changesizeby looks_setsizeto looks_changeeffectby looks_seteffectto looks_cleargraphiceffects looks_gotofrontback looks_goforwardbackwardlayers looks_costumenumbername looks_size
control_repeat control_repeat_until control_while control_for_each control_forever control_if control_if_else control_stop
data_setvariableto data_changevariableby data_showvariable data_hidevariable data_variable data_addtolist data_deleteoflist data_deletealloflist data_insertatlist data_replaceitemoflist data_itemoflist data_itemnumoflist data_lengthoflist data_listcontainsitem data_showlist data_hidelist data_listcontents
operator_add operator_subtract operator_multiply operator_divide operator_random operator_lt operator_equals operator_gt operator_and operator_or operator_not operator_join operator_letter_of operator_length operator_contains operator_mod operator_round operator_mathop
sensing_touchingobject sensing_touchingcolor sensing_coloristouchingcolor sensing_distanceto sensing_of sensing_mousex sensing_mousey sensing_mousedown sensing_keypressed sensing_answer
procedures_definition procedures_prototype procedures_call argument_reporter_string_number argument_reporter_boolean
math_number math_positive_number math_whole_number math_integer math_angle text colour_picker
motion_goto_menu motion_pointtowards_menu looks_costume sensing_touchingobjectmenu sensing_distancetomenu sensing_keyoptions sensing_of_object
`.trim().split(/\s+/));

export function createExecutionControls(vm, {onChange = () => {}, onShowBlocks = () => {}} = {}) {
  const runtime = vm.runtime;
  if (vmPackage.version !== '15.2.0' || typeof runtime._step !== 'function' || !runtime.sequencer?.stepToBranch) {
    throw new Error('Learning steps require the verified Scratch VM 15.2.0 integration.');
  }
  let active = false, status = 'idle', stepCount = 0, last = null, reason = null, revision = 0;
  let ordered = [], cursor = 0, starting = false, stopping = false, stepping = false, disposed = false;
  let glowing = null, highlightSequence = 0;
  const originalStep = runtime._step;
  const alive = thread => !thread.isKilled && thread.stack.length && thread.status !== Thread.STATUS_DONE;
  const description = thread => {
    const blockId = thread?.peekStack();
    return blockId ? {targetName: thread.target.getName(), blockId, opcode: thread.target.blocks.getBlock(blockId)?.opcode} : null;
  };
  const nextThread = () => {
    for (let i = 0; i < ordered.length; i++) {
      const index = (cursor + i) % ordered.length;
      if (alive(ordered[index])) return {thread: ordered[index], index};
    }
    return null;
  };
  const snapshot = () => ({active, status, stepCount, last, next: active ? description(nextThread()?.thread) : null,
    threadCount: active ? ordered.filter(alive).length : 0, reason, revision});
  const publish = () => {const state = snapshot(); onChange(state); return state;};
  function clearGlow() {
    highlightSequence++;
    if (glowing) {try {vm.emit('SCRIPT_GLOW_OFF', {id: glowing});} catch { /* Editor may be unmounting. */ }}
    glowing = null;
  }
  function highlight(thread) {
    clearGlow();
    if (!thread || !alive(thread)) return;
    onShowBlocks(); vm.setEditingTarget(thread.target.id);
    // Pinned GUI 15.2.0 ignores BLOCK_GLOW_ON. Use its supported whole-script
    // highlight; the parent shows the precise next opcode separately.
    let block = thread.target.blocks.getBlock(thread.peekStack());
    const seen = new Set();
    while (block?.parent && !seen.has(block.id)) {
      seen.add(block.id); const parent = thread.target.blocks.getBlock(block.parent);
      if (!parent) break; block = parent;
    }
    const id = block?.id, sequence = highlightSequence;
    if (id) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!active || sequence !== highlightSequence || vm.editingTarget !== thread.target || !thread.target.blocks.getBlock(id)) return;
      glowing = id; vm.emit('SCRIPT_GLOW_ON', {id});
    }));
  }
  function render() {
    runtime.renderer?.draw();
    if (runtime._refreshTargets) {vm.emitTargetsUpdate(false); runtime._refreshTargets = false;}
  }
  const gatedStep = function (...args) {
    if (!active) return originalStep.apply(this, args);
    // No monitor or edge-hat threads run while held. Parent Watch values reads
    // variables directly; ordinary Scratch monitors refresh on normal Run.
    render();
  };
  runtime._step = gatedStep;

  function check() {
    const issues = []; let greenFlags = 0;
    for (const target of runtime.targets.filter(t => t.isOriginal)) {
      for (const block of Object.values(target.blocks._blocks)) {
        if (block.opcode === 'event_whenflagclicked') greenFlags++;
        let message;
        if (!allowed.has(block.opcode)) message = 'Use normal Run for this block. Learning steps only support synchronous core blocks and green-flag scripts.';
        if (block.opcode === 'procedures_prototype' && [true, 'true'].includes(block.mutation?.warp)) message = 'Turn off “Run without screen refresh” for this My Block before using Learning steps.';
        if (message) issues.push({targetName: target.getName(), blockId: block.id, opcode: block.opcode, message});
      }
    }
    if (!greenFlags) issues.push({targetName: '', blockId: null, opcode: null, message: 'Add a “when green flag clicked” script to start Learning steps.'});
    return {ok: issues.length === 0, issues: issues.slice(0, 50), totalIssues: issues.length, supported: LEARNING_SCOPE, revision};
  }
  function leave(nextStatus, message = null) {
    active = false; status = nextStatus; reason = message; clearGlow(); ordered = []; cursor = 0;
    return publish();
  }
  function stop(message = null) {
    // A stale panel cleanup must never stop a newer ordinary green-flag run.
    if (!active) return snapshot();
    revision++;
    // Change state first: stopAll emits an event synchronously.
    leave('stopped', message); stopping = true;
    try {vm.stopAll();} finally {stopping = false;}
    return snapshot();
  }
  function start(expectedRevision) {
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) throw new Error('Learning revision must be a nonnegative safe integer.');
    if (expectedRevision !== undefined && expectedRevision !== revision) throw new Error('The program or execution changed after this learning check. Start Learning steps again.');
    const result = check();
    if (!result.ok) throw new Error(`${result.issues.slice(0, 3).map(i => `${i.targetName ? i.targetName + ': ' : ''}${i.opcode ? i.opcode + ' — ' : ''}${i.message}`).join(' ')}${result.totalIssues > 3 ? ` (${result.totalIssues} issues in total.)` : ''}`);
    starting = true;
    try {
      revision++;
      vm.greenFlag();
      ordered = runtime.threads.filter(t => !t.updateMonitor && alive(t));
      active = ordered.length > 0; status = active ? 'paused' : 'completed';
      stepCount = 0; last = null; reason = null; cursor = 0;
      runtime._emitProjectRunStatus(ordered.length);
      highlight(nextThread()?.thread); render();
      return publish();
    } finally {starting = false;}
  }
  function step() {
    if (!active) throw new Error('Start Learning steps before stepping this program.');
    if (runtime.threads.some(t => !t.updateMonitor && alive(t) && !ordered.includes(t))) {
      return stop('A script was started outside Learning steps. Start Learning steps again.');
    }
    const entry = nextThread();
    if (!entry) return leave('completed');
    const {thread, index} = entry;
    if (thread.stack.length > 256) return stop('This My Block has too many nested calls. Check recursion before restarting.');
    last = description(thread);
    stepping = true;
    try {
      runtime.sequencer.activeThread = thread;
      oneStackBlock(runtime.sequencer, thread);
      stepCount++;
      runtime.threads = runtime.threads.filter(alive);
      if (active) cursor = (index + 1) % ordered.length;
      render();
      if (!active) return publish(); // A “stop all” block ended the session.
      if (!nextThread()) return leave('completed');
      highlight(nextThread().thread);
      return publish();
    } catch (error) {
      stop(`Learning steps stopped: ${error.message}`);
      throw error;
    } finally {runtime.sequencer.activeThread = null; stepping = false;}
  }
  function resume() {
    if (!active) throw new Error('There is no paused Learning steps program to resume.');
    revision++;
    return leave('running', 'Continuing with normal Scratch scheduling.');
  }
  // Publish external intent even before a learning run has started: a parent
  // preflight/tab RPC may still be pending and must not supersede a newer Stop
  // or green-flag click. Our own start/stop sequence is guarded separately.
  const onStop = () => {if (!starting && !stopping) {revision++; leave('stopped', stepping ? 'The program stopped itself.' : 'Program stopped.');}};
  const onStart = () => {if (!starting) {revision++; leave('running', 'Green flag started normal execution.');}};
  const onRunStop = () => {if (!active && status === 'running') leave('completed', 'Normal execution finished.');};
  const onEdit = () => {if (!starting && !stepping) {revision++; if (active) stop('The project changed. Start Learning steps again.');}};
  runtime.on('PROJECT_STOP_ALL', onStop);
  runtime.on('PROJECT_START', onStart);
  runtime.on('PROJECT_RUN_STOP', onRunStop);
  runtime.on('PROJECT_CHANGED', onEdit);
  function dispose() {
    if (disposed) return;
    if (active) stop('Editor closed.');
    disposed = true;
    if (runtime._step === gatedStep) runtime._step = originalStep;
    runtime.removeListener('PROJECT_STOP_ALL', onStop);
    runtime.removeListener('PROJECT_START', onStart);
    runtime.removeListener('PROJECT_RUN_STOP', onRunStop);
    runtime.removeListener('PROJECT_CHANGED', onEdit);
    clearGlow();
  }
  return {check, start, step, resume, stop, snapshot, dispose};
}

// Stack progression follows pinned Sequencer.stepThread, but deliberately
// returns after ONE execute call. Reporter inputs belong to that same visit.
// Loop tests and My Block entries/returns can therefore take their own step.
function oneStackBlock(sequencer, thread) {
  const current = thread.peekStack();
  if (!current) {unwind(thread); return;}
  if ([Thread.STATUS_YIELD, Thread.STATUS_YIELD_TICK].includes(thread.status)) thread.status = Thread.STATUS_RUNNING;
  if (thread.status !== Thread.STATUS_RUNNING) throw new Error('An asynchronous block cannot be stepped. Use normal Run.');
  execute(sequencer, thread);
  thread.blockGlowInFrame = current;
  if (thread.status === Thread.STATUS_PROMISE_WAIT) throw new Error('An asynchronous block cannot be stepped. Use normal Run.');
  if ([Thread.STATUS_YIELD, Thread.STATUS_YIELD_TICK].includes(thread.status)) {
    thread.status = Thread.STATUS_RUNNING;
    return;
  }
  if (thread.peekStack() === current) thread.goToNextBlock();
  unwind(thread);
}

function unwind(thread) {
  if (!thread.stack.length) {thread.status = Thread.STATUS_DONE; return;}
  while (!thread.peekStack()) {
    thread.popStack();
    if (!thread.stack.length) {thread.status = Thread.STATUS_DONE; return;}
    const frame = thread.peekStackFrame();
    if (frame.isLoop || frame.waitingReporter) return;
    thread.goToNextBlock();
  }
}

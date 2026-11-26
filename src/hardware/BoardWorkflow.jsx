import React, {useState} from 'react';
import {Plug, Unplug, Code2, Download} from 'lucide-react';
import './board-workflow.css';
import BoardAcceptance from './BoardAcceptance.jsx';

export default function BoardWorkflow({board, boards, mode, onMode, busy, connectionPending, state, canConnect,
  onSelect, onPrepare, onUseBlocks, onCompile, canCompile, onConnect, onDisconnect, onCancelConnection,
  onReconnect, canReconnect, compilerPanel, firmwarePanel, boardSettings, onTryVirtual, transportMessage, error}) {
  const [compilerOpen, setCompilerOpen] = useState(false);
  const connected = state.status === 'connected';
  return <section className="hardware-workflow" aria-label="Board programming workflow">
    <div className="hardware-workflow-heading"><label>Choose your board
      <select aria-label="Choose your board" value={board.id} disabled={busy || connectionPending || connected} onChange={event => onSelect(event.target.value)}>
        {!board.live && <option value={board.id}>{board.name} · planned</option>}
        {boards.filter(item => item.live).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label><p>{board.live ? 'Choose a mode to get started.' : 'This adapter is planned. Choose an available Arduino or ESP32 to begin.'}</p>{board.live&&<button className="button secondary" disabled={busy||connectionPending||connected} onClick={onTryVirtual}>Try without a board</button>}</div>
    {error&&<p className="notice error-text" role="alert">{error}</p>}
    {board.live && <>
      {boardSettings}
      {transportMessage&&<p className="notice">{transportMessage}</p>}
      <div className="hardware-mode-choice" role="group" aria-label="Programming mode">
        <button type="button" aria-pressed={mode === 'live'} disabled={busy || connectionPending} onClick={() => onMode('live')}><strong>Live control</strong><span>Keep USB connected.</span></button>
        <button type="button" aria-pressed={mode === 'standalone'} disabled={busy || connectionPending} onClick={() => onMode('standalone')}><strong>Run after unplugging</strong><span>Upload code to your board.</span></button>
      </div>
      {mode === 'live' ? <ol className="hardware-guided-steps">
        <li><div><strong>Prepare firmware</strong><p>First time? Upload the live firmware.</p></div><button className="button secondary" disabled={busy || connectionPending} onClick={onPrepare}><Download size={16}/> Prepare live firmware</button></li>
        <li><div><strong>Connect</strong><p>{connected ? 'Live control is connected.' : state.status === 'connecting' ? 'Choose the USB board in your browser. Cancel stops this connection attempt.' : 'Already prepared? Connect the USB board.'}</p></div>
          {state.status === 'connecting' ? <button className="button secondary" onClick={onCancelConnection}>Cancel connection</button> : <button className="button primary" disabled={busy || connectionPending || !canConnect} onClick={connected ? onDisconnect : onConnect}>{connected ? <Unplug size={16}/> : <Plug size={16}/>} {connected ? 'Disconnect' : 'Connect board'}</button>}
          {!connected && canReconnect && <button className="small-button" disabled={busy || connectionPending || !canConnect} onClick={onReconnect}>Reconnect last board</button>}
        </li>
        <li><div><strong>Code with blocks</strong><p>Add Boards and robots blocks.</p></div><button className="button secondary" disabled={busy || connectionPending} onClick={onUseBlocks}><Code2 size={16}/> Program with blocks</button></li>
      </ol> : <ol className="hardware-guided-steps">
        <li><div><strong>Write your program</strong><p>Add supported hardware blocks in the Blocks editor.</p></div><button className="button secondary" disabled={busy || connectionPending} onClick={onUseBlocks}><Code2 size={16}/> Program with blocks</button></li>
        <li><div><strong>Compile current blocks</strong><p>{canCompile ? 'The local compiler is ready.' : 'Set up the local compiler on this computer first.'}</p></div><button className="button secondary" disabled={busy} aria-expanded={compilerOpen} aria-controls="hardware-compiler-setup" onClick={() => setCompilerOpen(open => !open)}>{canCompile ? 'Compiler settings' : 'Set up local compiler'}</button><button className="button primary" disabled={busy || !canCompile} onClick={onCompile}>Compile current blocks</button></li>
        <li><div><strong>Upload and unplug</strong><p>After compilation, choose “Select port & upload” below. The board needs its own power when unplugged.</p></div>{connected && <button className="button secondary" disabled={busy || connectionPending} onClick={onDisconnect}><Unplug size={16}/> Disconnect live control</button>}</li>
      </ol>}
      {mode === 'standalone' && <div id="hardware-compiler-setup" hidden={!compilerOpen}>{compilerPanel}</div>}
      {firmwarePanel}
      <BoardAcceptance key={`${board.id}:${mode}`} board={board} mode={mode}/>
      <p className="hardware-workflow-note">Physical board testing is still pending. Image, sound and pose models run in the browser; only supported hardware blocks and small numbers models can run on a disconnected board.</p>
    </>}
  </section>;
}

import {getBoard} from './boards.js';

const connectionStatuses = new Set(['disconnected', 'connecting', 'connected', 'disconnecting', 'error']);

export function getHardwareReadiness(boardId, {secureContext = globalThis.isSecureContext === true,
  serialAvailable = Boolean(globalThis.navigator?.serial), helperStatus = null} = {}) {
  const board = getBoard(boardId);
  const live = Boolean(board?.live);
  return {
    secureContext: secureContext === true,
    serialAvailable: serialAvailable === true,
    canConnect: live && secureContext === true && serialAvailable === true,
    canCompile: Boolean(board?.export) && helperStatus?.cliAvailable === true,
    physicalVerified: board?.physicalVerified === true,
    checks: [
      {label: 'Secure page', ready: secureContext === true, detail: secureContext ? 'HTTPS or localhost is active.' : 'Open this app over HTTPS or localhost to use a serial port.'},
      {label: 'Browser serial API', ready: serialAvailable === true, detail: serialAvailable ? 'Available; selecting a port still requires your permission.' : 'Unavailable here. Use a desktop browser with Web Serial enabled.'},
      {label: 'Local compiler', ready: helperStatus?.cliAvailable === true, detail: helperStatus?.cliAvailable === true ? 'Last check passed. Used for compiling blocks, not required for live control.' : 'Not connected. Connect below to compile blocks; prepared live firmware works without it.'},
      {label: 'Physical validation', ready: board?.physicalVerified === true, detail: board?.physicalVerified === true ? 'Recorded physical checks passed.' : 'Pending. Compilation and simulated transport tests do not verify a physical board.'}
    ]
  };
}

/** Clear the previous compiler before a recheck, even if health() rejects. */
export async function verifyCompilerConnection(client, publish) {
  publish(null);
  const health = await client.health();
  if (health?.cliAvailable !== true) throw new Error(health?.cliError || 'Arduino CLI is unavailable in the local compiler.');
  publish({client, health});
  return health;
}

/** Deliberate allowlist: never serialize errors, logs, tokens, URLs, or native ports. */
export function createHardwareDiagnostics({boardId, state = {}, helperStatus = null,
  secureContext = globalThis.isSecureContext === true, serialAvailable = Boolean(globalThis.navigator?.serial)} = {}) {
  const board = getBoard(boardId);
  return {
    format: 'duetblox-hardware-diagnostics', version: 1,
    board: board ? {id: board.id, name: board.name, softwareImplemented: Boolean(board.live),
      standaloneExport: Boolean(board.export), physicalVerified: board.physicalVerified === true,
      logicVoltage: board.voltage ?? null, outputPins: [...board.outputPins],
      analogPins: [...board.analogPins], pwmPins: [...board.pwmPins]} : null,
    browser: {secureContext: secureContext === true, serialAvailable: serialAvailable === true},
    connection: {status: connectionStatuses.has(state.status) ? state.status : 'unknown',
      protocolVersion: state.firmwareVersion === 1 ? 1 : null, hasError: Boolean(state.error)},
    compiler: {checkedSuccessfully: helperStatus?.cliAvailable === true, cliAvailable: helperStatus?.cliAvailable === true}
  };
}

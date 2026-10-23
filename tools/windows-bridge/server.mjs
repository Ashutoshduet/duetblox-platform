import http from 'node:http';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, rm, lstat, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {exportArduino} from '../../src/hardware/generator.js';
import {getBoard} from '../../src/hardware/boards.js';

export const BOARD_FQBN = Object.freeze({
  'arduino-uno': 'arduino:avr:uno',
  'arduino-mega': 'arduino:avr:mega:cpu=atmega2560',
  'arduino-nano': 'arduino:avr:nano:cpu=atmega328',
  'esp32': 'esp32:esp32:esp32',
  'esp32-cam': 'esp32:esp32:esp32cam'
});
const MAX_BODY = 1024 * 1024;
const MAX_OUTPUT = 512 * 1024;
const ARTIFACT_TTL = 30 * 60 * 1000;
const MAX_FIRMWARE = 8 * 1024 * 1024;

export function validSerialPort(port) {
  return typeof port === 'string' && port.length <= 256 && !port.includes('..') &&
    (/^COM[1-9]\d{0,3}$/i.test(port) || /^\/dev\/(?:tty[A-Za-z0-9._-]+|cu\.[A-Za-z0-9._-]+|serial\/by-id\/[A-Za-z0-9._:-]+)$/.test(port));
}
const samePort = (a,b) => /^COM/i.test(a) ? a.toUpperCase() === b.toUpperCase() : a === b;

/** Only server-owned compiler output names, never user-supplied file paths. */
export async function artifactBundle(artifact,artifactId) {
  const esp=getBoard(artifact.boardId)?.core === 'esp32:esp32';
  let descriptors=[{name:'DuetProgram.ino.hex',address:0}];
  if(esp) {
    try { await lstat(join(artifact.output,'DuetProgram.ino.merged.bin')); descriptors=[{name:'DuetProgram.ino.merged.bin',address:0}]; }
    catch(error) {
      if(error.code!=='ENOENT') throw error;
      descriptors=[{name:'DuetProgram.ino.bootloader.bin',address:0x1000},{name:'DuetProgram.ino.partitions.bin',address:0x8000},{name:'boot_app0.bin',address:0xe000},{name:'DuetProgram.ino.bin',address:0x10000}];
    }
  }
  let total=0; const files=[];
  for(const file of descriptors) {
    const path=join(artifact.output,file.name);
    let stat;try { stat=await lstat(path); }catch { throw Object.assign(new Error(`Compiler output ${file.name} is unavailable. Export a complete merged ESP32 image or the complete segment set.`),{status:422}); }
    if(!stat.isFile() || stat.isSymbolicLink() || stat.size<=0 || (total+=stat.size)>MAX_FIRMWARE) throw Object.assign(new Error('Compiler firmware output is invalid or exceeds 8 MiB.'),{status:422});
    const bytes=await readFile(path);
    files.push({...file,size:bytes.length,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return {kind:'duetblox-firmware',version:1,artifactId,boardId:artifact.boardId,fqbn:artifact.fqbn,
    format:esp?'esp32':'ihex',source:'compiled-project',files,physicalVerified:false};
}

export function validateOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin === value && ['http:', 'https:'].includes(url.protocol) &&
      (url.protocol === 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  } catch { return false; }
}

export function authorize(request, {origins, token, port}) {
  if (request.headers.host !== `127.0.0.1:${port}`) return 'Invalid Host header.';
  const origin = request.headers.origin;
  if (!origins.includes(origin)) return 'Origin is not allowed.';
  if (request.method === 'OPTIONS') return null;
  const auth = request.headers.authorization || '';
  const supplied = Buffer.from(auth);
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return 'Pairing token is invalid.';
  return null;
}

export function runCLI(executable, args, {timeout = 120000} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'});
    let stdout = '', stderr = '', settled = false;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {shell: false, windowsHide: true, stdio: 'ignore'});
        killer.on('error', () => { child.kill(); });
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); } }
    };
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => { stop(); finish(new Error('Arduino CLI operation timed out.')); }, timeout);
    const receive = key => data => {
      if (key === 'stdout') stdout += data.toString(); else stderr += data.toString();
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > MAX_OUTPUT) { stop(); finish(new Error('Arduino CLI output limit exceeded.')); }
    };
    child.stdout.on('data', receive('stdout')); child.stderr.on('data', receive('stderr'));
    child.on('error', error => finish(new Error(`Arduino CLI could not start: ${error.message}`)));
    child.on('close', code => finish(null, {code, stdout, stderr}));
  });
}

async function readJSON(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] || '')) throw Object.assign(new Error('Use application/json.'), {status: 415});
  let size = 0; const parts = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request is too large.'), {status: 413});
    parts.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON.'), {status: 400}); }
}

export function createBridgeServer({port = 8765, origins = ['http://localhost:5173'], token = randomBytes(32).toString('hex'),
  cli = 'arduino-cli', configFile, enableUpload = false, runner = runCLI} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid bridge port.');
  if (!origins.length || origins.some(origin => !validateOrigin(origin))) throw new Error('Use exact HTTPS origins or local development HTTP origins; no wildcards.');
  if (typeof token !== 'string' || token.length < 32 || token.length > 256 || /\s/.test(token)) throw new Error('Pairing token must be 32–256 non-whitespace characters.');
  const config = {port, origins, token}; const artifacts = new Map(); let busy = false;
  const run = (args,options) => runner(cli,[...(configFile ? ['--config-file',configFile] : []),...args],options);
  const cleanExpired = async () => {
    for (const [id, artifact] of artifacts) if (Date.now() - artifact.created > ARTIFACT_TTL) {
      artifacts.delete(id); await rm(artifact.root, {recursive: true, force: true});
    }
  };
  const cleanup = async () => { for (const artifact of artifacts.values()) await rm(artifact.root, {recursive: true, force: true}); artifacts.clear(); };
  const listBoards = async () => {
    const result = await run(['board', 'list', '--format', 'json'], {timeout: 15000});
    if (result.code !== 0) throw new Error(result.stderr || result.stdout || 'Arduino CLI board discovery failed.');
    const data = JSON.parse(result.stdout);
    if (!Array.isArray(data.detected_ports)) throw new Error('Unexpected Arduino CLI board-list schema. Use Arduino CLI 1.x.');
    return data.detected_ports.map(item => ({address: item.port?.address, protocol: item.port?.protocol,
      label: item.port?.label || item.port?.address, matchingBoards: item.matching_boards || []})).filter(item => typeof item.address === 'string');
  };
  const server = http.createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(JSON.stringify(body));
    };
    const authError = authorize(request, config);
    if (authError) { send(403, {error: authError}); return; }
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      const requestedHeaders = (request.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (!['GET','POST'].includes(request.headers['access-control-request-method']) || requestedHeaders.some(h => !['authorization','content-type'].includes(h))) { send(403, {error: 'Preflight rejected.'}); return; }
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      if (request.headers['access-control-request-private-network'] === 'true') response.setHeader('Access-Control-Allow-Private-Network', 'true');
      response.writeHead(204); response.end(); return;
    }
    if (request.url === '/health' && request.method === 'GET') {
      let cliAvailable = false, cliVersion = null, cliError = null;
      try {
        const result = await run(['version', '--format', 'json'], {timeout: 5000});
        cliAvailable = result.code === 0;
        if (cliAvailable) {
          try { const data = JSON.parse(result.stdout); cliVersion = data.VersionString || data.version || null; }
          catch { cliVersion = result.stdout.trim().slice(0, 256) || null; }
        } else cliError = (result.stderr || result.stdout || 'Arduino CLI version check failed.').slice(0, 1024);
      } catch (error) { cliError = error.message; }
      send(200, {name: 'DUETBlox Arduino Bridge', version: 1, uploadEnabled: enableUpload, platform:process.platform,
        supportedBoards: Object.keys(BOARD_FQBN), physicalVerified: false, cliAvailable, cliVersion, cliError,
        requirements:{avr:{core:'arduino:avr',libraries:['Servo']},esp32:{core:'esp32:esp32',majorVersion:3,indexURL:'https://espressif.github.io/arduino-esp32/package_esp32_index.json'}}}); return;
    }
    const artifactMatch=/^\/artifact\/([0-9a-f]{48})$/.exec(request.url);
    if (!artifactMatch && !['/boards','/compile','/upload'].includes(request.url)) { send(404, {error: 'Unknown route.'}); return; }
    if (request.method !== (request.url === '/boards' || artifactMatch ? 'GET' : 'POST')) { send(405, {error: 'Method not allowed.'}); return; }
    if (busy) { send(409, {error: 'Another board operation is in progress.'}); return; }
    busy = true;
    try {
      await cleanExpired();
      if(artifactMatch) {
        const artifact=artifacts.get(artifactMatch[1]);
        if(!artifact) throw Object.assign(new Error('Build artifact missing or expired. Compile again.'),{status:404});
        send(200,await artifactBundle(artifact,artifactMatch[1]));return;
      }
      if (request.url === '/boards') { send(200, {ports: await listBoards()}); return; }
      const body = await readJSON(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Expected a JSON object.'), {status: 400});
      if (request.url === '/compile') {
        if (!Object.hasOwn(BOARD_FQBN, body.boardId)) throw Object.assign(new Error('Unsupported board.'), {status: 400});
        if (body.variant && !(body.boardId === 'arduino-nano' && body.variant === 'old-bootloader')) throw Object.assign(new Error('Unsupported board variant.'), {status: 400});
        // Re-generate server-side: never accept arbitrary C++, paths, shell commands or FQBNs from a browser.
        const generated = exportArduino(body.project, {boardId: body.boardId, name: 'DuetProgram'});
        if (!generated.ok) { send(422, {error: 'Project cannot be exported.', diagnostics: generated.diagnostics}); return; }
        if (artifacts.size >= 8) throw Object.assign(new Error('Artifact limit reached. Restart the bridge or wait for older builds to expire.'), {status: 429});
        const fqbn = body.variant === 'old-bootloader' ? 'arduino:avr:nano:cpu=atmega328old' : BOARD_FQBN[body.boardId];
        const root = await mkdtemp(join(tmpdir(), 'duetblox-'));
        try {
          const sketch = join(root, 'DuetProgram'); const output = join(root, 'build');
          await mkdir(sketch); await mkdir(output); await writeFile(join(sketch, 'DuetProgram.ino'), generated.code, 'utf8');
          const result = await run(['compile', '--fqbn', fqbn, '--output-dir', output, '--format', 'json', sketch], {timeout:600000});
          if (result.code !== 0) { await rm(root, {recursive: true, force: true}); send(422, {error: 'Compilation failed.', log: result.stderr || result.stdout}); return; }
          const artifactId = randomBytes(24).toString('hex');
          artifacts.set(artifactId, {root, output, fqbn, boardId: body.boardId, created: Date.now()});
          send(200, {artifactId, artifactURL:`/artifact/${artifactId}`,boardId: body.boardId, fqbn, expiresInSeconds: ARTIFACT_TTL / 1000, log: result.stdout, uploadEnabled: enableUpload});
        } catch (error) { await rm(root, {recursive: true, force: true}); throw error; }
      } else {
        if (!enableUpload) throw Object.assign(new Error('Upload is disabled. Start the bridge with DUETBLOX_ENABLE_UPLOAD=1 when ready to flash.'), {status: 403});
        if (body.confirm !== true) throw Object.assign(new Error('Upload requires an explicit confirmation.'), {status: 400});
        const artifact = artifacts.get(body.artifactId);
        if (!artifact) throw Object.assign(new Error('Build artifact missing or expired. Compile again.'), {status: 404});
        if (!validSerialPort(body.port)) throw Object.assign(new Error('Select a discovered Windows COM or macOS/Linux serial device.'), {status: 400});
        const ports = await listBoards();
        if (!ports.some(port => samePort(port.address,body.port) && port.protocol === 'serial')) throw Object.assign(new Error('The selected serial port is no longer connected.'), {status: 400});
        const result = await run(['upload', '--fqbn', artifact.fqbn, '--port', body.port, '--input-dir', artifact.output, '--format', 'json'],{timeout:180000});
        if (result.code !== 0) { send(422, {error: 'Upload failed.', log: result.stderr || result.stdout}); return; }
        send(200, {uploaded: true, boardId: artifact.boardId, boardName: getBoard(artifact.boardId).name, port: body.port, log: result.stdout});
      }
    } catch (error) { send(error.status || 500, {error: error.message}); }
    finally { busy = false; }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.on('close', () => { cleanup().catch(() => {}); });
  return {server, token, port, origins, cleanup};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bridge = createBridgeServer({
    origins: (process.env.DUETBLOX_ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),
    token: process.env.DUETBLOX_BRIDGE_TOKEN || undefined,
    cli: process.env.DUETBLOX_ARDUINO_CLI || 'arduino-cli',
    configFile: process.env.DUETBLOX_ARDUINO_CONFIG || undefined,
    enableUpload: process.env.DUETBLOX_ENABLE_UPLOAD === '1'
  });
  bridge.server.listen(bridge.port, '127.0.0.1', () => {
    console.log(`DUETBlox Arduino bridge: http://127.0.0.1:${bridge.port}`);
    console.log(`Allowed app origins: ${bridge.origins.join(', ')}`);
    console.log(`Pairing token (paste into DUETBlox; never into a URL): ${bridge.token}`);
    console.log(`Upload enabled: ${process.env.DUETBLOX_ENABLE_UPLOAD === '1'}`);
  });
  const shutdown = () => bridge.server.close(async () => { await bridge.cleanup(); process.exit(0); });
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {boardRegistry, validatePin, getBoard} from '../boards.js';
import {readFile} from 'node:fs/promises';
import {liveFirmwareSource} from '../firmware-source.js';
import {fixtureIR} from './build-fixtures.mjs';
import {LineDecoder, encodeRequest, parseResponse} from '../protocol.js';
import {generateArduino, scratchProjectToIR, exportArduino} from '../generator.js';
import {ArduinoSerialService} from '../serial-service.js';
import {getHardwareReadiness, createHardwareDiagnostics, verifyCompilerConnection} from '../readiness.js';

const input = value => [1, [typeof value === 'number' ? 4 : 10, String(value)]];
function blinkProject() {
  return {targets: [{isStage: false, variables: {}, blocks: {
    start: {opcode: 'duetHardware_whenBoardStarts', topLevel: true, next: 'forever'},
    forever: {opcode: 'control_forever', next: null, inputs: {SUBSTACK: [2, 'high']}},
    high: {opcode: 'duetHardware_digitalWrite', next: 'wait1', inputs: {PIN: input(13), VALUE: input(1)}},
    wait1: {opcode: 'control_wait', next: 'low', inputs: {DURATION: input(0.5)}},
    low: {opcode: 'duetHardware_digitalWrite', next: 'wait2', inputs: {PIN: input(13), VALUE: input(0)}},
    wait2: {opcode: 'control_wait', next: null, inputs: {DURATION: input(0.5)}}
  }}]};
}

test('catalog separates implemented software from physical verification and plans', () => {
  assert.equal(boardRegistry.filter(b => b.inCurrentWebCatalog).length, 14);
  assert.equal(boardRegistry.filter(b => b.live).length, 5);
  assert.ok(boardRegistry.every(b => b.physicalVerified === false));
  assert.equal(validatePin('arduino-mega', 46, 'pwm'), 46);
  assert.equal(validatePin('arduino-nano', 'A7', 'analog'), 'A7');
  assert.throws(() => validatePin('arduino-uno', 0), /reserved/);
  assert.throws(() => validatePin('arduino-uno', 4, 'pwm'), /PWM/);
  assert.throws(() => validatePin('arduino-uno', 'A7', 'analog'), /unavailable/);
  assert.throws(() => validatePin('esp32', 2), /reserved/);
});

test('ESP32 profiles reserve boot, memory and camera peripherals, and input-only pins',()=>{
  assert.equal(validatePin('esp32',34),34);
  assert.throws(()=>validatePin('esp32',34,'output'),/input-only/);
  assert.throws(()=>validatePin('esp32',34,'pullup'),/pull-up/);
  assert.equal(validatePin('esp32','34','analog'),'34');
  for(const pin of ['A0','25','2']) assert.throws(()=>validatePin('esp32',pin,'analog'),/unavailable/);
  assert.deepEqual(getBoard('esp32-cam').outputPins,[4,13,14]);
  for(const pin of [0,1,2,3,5,12,15,16,17,21,22,23,25,26,27,32,34,35,36,39]) assert.throws(()=>validatePin('esp32-cam',pin));
  assert.equal(getBoard('esp32-cam').analogPins.length,0);
});

test('checked-in firmware exactly matches shared runtime and the explicit CAM profile',async()=>{
  assert.equal(await readFile(new URL('../firmware/DuetBloxLive/DuetBloxLive.ino',import.meta.url),'utf8'),liveFirmwareSource());
  assert.equal(await readFile(new URL('../firmware/DuetBloxLiveESP32CAM/DuetBloxLiveESP32CAM.ino',import.meta.url),'utf8'),liveFirmwareSource({camera:true}));
});

test('wire protocol handles chunk splits and drops invalid/oversized frames', () => {
  assert.equal(new TextDecoder().decode(encodeRequest(4, 'WRITE', 13, 1)), '4 WRITE 13 1\n');
  assert.throws(() => encodeRequest(1, 'WRITE', '13\nSTOP', 1));
  const decoder = new LineDecoder();
  assert.deepEqual(decoder.push(new TextEncoder().encode('12 OK DUET')), []);
  assert.deepEqual(decoder.push(new TextEncoder().encode('BLOX 1 UNO\r\n13 OK 42\n')), ['12 OK DUETBLOX 1 UNO', '13 OK 42']);
  assert.deepEqual(decoder.push(new TextEncoder().encode('x'.repeat(10000) + '\n14 OK\n')), ['14 OK']);
  assert.equal(parseResponse('65536 OK'), null);
  assert.equal(parseResponse('1 OK \u0000'), null);
  assert.deepEqual(parseResponse('9 ERR PWM_PIN'), {id: 9, ok: false, payload: 'PWM_PIN'});
});

test('real Scratch JSON blink exports setup/loop and board-specific C++', () => {
  const parsed = scratchProjectToIR(blinkProject());
  assert.equal(parsed.ir.setup.length, 0);
  assert.equal(parsed.ir.loop.length, 4);
  const result = exportArduino(blinkProject(), {boardId:'arduino-uno', name:'Class project!'});
  assert.equal(result.ok, true);
  assert.equal(result.filename, 'Class_project_.ino');
  assert.match(result.code, /void loop\(\) \{\n  duetDigitalWrite\(13, 1\);/);
  assert.match(result.code, /duetWait\(0.5\)/);
});

test('unsupported sprites, parallel entry scripts and cycles fail closed', () => {
  const motion = blinkProject(); motion.targets[0].blocks.high.opcode = 'motion_movesteps';
  assert.equal(exportArduino(motion).code, '');
  const parallel = blinkProject(); parallel.targets[0].blocks.second = {opcode:'event_whenflagclicked', topLevel:true};
  assert.match(exportArduino(parallel).diagnostics[0].message, /exactly one/);
  const cyclic = blinkProject(); cyclic.targets[0].blocks.wait2.next = 'high';
  assert.ok(exportArduino(cyclic).diagnostics.some(d => d.code === 'CYCLE'));
});

test('numeric variables and sensor expressions map to safe generated identifiers', () => {
  const project = blinkProject(); const target = project.targets[0];
  target.variables.v1 = ['hello; #include <bad>', 2];
  target.blocks.high.inputs.VALUE = [3, 'greater', [4,'0']];
  target.blocks.greater = {opcode:'operator_gt', inputs:{OPERAND1:[3,'sensor',[4,'0']], OPERAND2:[3,[12,'hello','v1'],[4,'0']]}};
  target.blocks.sensor = {opcode:'duetHardware_readAnalog', inputs:{PIN:input('A0')}};
  const result = exportArduino(project);
  assert.equal(result.ok, true);
  assert.match(result.code, /double duetVar0 = 2/);
  assert.match(result.code, /analogRead\(A0\)/);
  assert.doesNotMatch(result.code, /<bad>/);
  target.variables.v1[1] = 'word';
  assert.equal(exportArduino(project).ok, false);
});

test('pin restrictions and unknown IR operations produce diagnostics instead of partial code', () => {
  for (const statement of [{op:'analogWrite',pin:4,value:100},{op:'setPinMode',pin:13,mode:'OUTPUT); evil()'},{op:'eval',code:'evil'}]) {
    const result = generateArduino({version:1,setup:[statement],loop:[]});
    assert.equal(result.ok, false); assert.equal(result.code, '');
  }
  assert.equal(generateArduino({version:1,setup:[],loop:[]},{boardId:'quarky'}).ok, false);
});

test('all five feature fixtures export, while AVR timer conflicts and invalid values fail closed',()=>{
  for(const board of boardRegistry.filter(b=>b.export)) {
    const result=generateArduino(fixtureIR(board),{boardId:board.id});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
    assert.match(result.code,/duetServoWrite\(/);assert.match(result.code,/duetTone\(/);assert.match(result.code,/duetMap\(/);
    assert.match(result.code,/duetYield\(\);/);
  }
  for(const [boardId,pwm] of [['arduino-uno',9],['arduino-nano',10],['arduino-mega',44]]) {
    const result=generateArduino({version:1,setup:[{op:'servoWrite',pin:7,angle:90},{op:'analogWrite',pin:pwm,value:128}],loop:[]},{boardId});
    assert.equal(result.ok,false);assert.ok(result.diagnostics.some(d=>d.code==='TIMER_CONFLICT'));
  }
  for(const stmt of [{op:'tone',pin:8,frequency:0,seconds:1},{op:'servoWrite',pin:9,angle:181},{op:'tone',pin:8,frequency:440,seconds:-1},{op:'setPinMode',pin:34,mode:'INPUT_PULLUP'}]) {
    assert.equal(generateArduino({version:1,setup:[stmt],loop:[]},{boardId:stmt.pin===34?'esp32':'arduino-uno'}).ok,false);
  }
});

test('Scratch adapter handles servo/tone/map/random/round and until controls with exact argument names',()=>{
  const blocks={start:{opcode:'duetHardware_whenBoardStarts',topLevel:true,next:'servo'},
    servo:{opcode:'duetHardware_servoWrite',next:'detach',inputs:{PIN:input(9),ANGLE:[3,'round',input(90)[1]]}},
    round:{opcode:'operator_round',inputs:{NUM:[3,'map',input(0)[1]]}},
    map:{opcode:'duetHardware_map',inputs:{VALUE:[3,'random',input(10)[1]],IN_MIN:input(0),IN_MAX:input(100),OUT_MIN:input(0),OUT_MAX:input(180)}},
    random:{opcode:'operator_random',inputs:{FROM:input(1),TO:input(100)}},
    detach:{opcode:'duetHardware_servoDetach',inputs:{PIN:input(9)},next:'tone'},
    tone:{opcode:'duetHardware_tone',inputs:{PIN:input(8),FREQUENCY:input(440),DURATION:input(0.5)},next:'stop'},
    stop:{opcode:'duetHardware_noTone',inputs:{PIN:input(8)},next:'until'},
    until:{opcode:'control_repeat_until',inputs:{CONDITION:[2,'test'],SUBSTACK:[2,'waituntil']}},
    test:{opcode:'operator_equals',inputs:{OPERAND1:input(1),OPERAND2:input(1)}},
    waituntil:{opcode:'control_wait_until',inputs:{CONDITION:[2,'test']}}
  };
  const result=exportArduino({targets:[{blocks,variables:{}}]});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.match(result.code,/duetServoWrite\(9, floor\(\(duetMap\(duetRandom\(1, 100\), 0, 100, 0, 180\)\) \+ 0.5\)\)/);
  assert.match(result.code,/duetTone\(8, 440, 0.5\)/);assert.match(result.code,/while \(!\(/);
});

class FakePort {
  constructor({firmware = 'UNO', silent = false} = {}) { this.firmware = firmware; this.silent = silent; this.commands = []; this.closed = false; }
  async open() {
    this.closed = false;
    this.readable = new ReadableStream({start: controller => { this.controller = controller; }});
    this.writable = new WritableStream({write: bytes => {
      const text = new TextDecoder().decode(bytes).trim(); this.commands.push(text);
      if (this.silent) return;
      const [id, command] = text.split(' ');
      const payload = command === 'HELLO' ? ` DUETBLOX 1 ${this.firmware}` : command === 'ANALOG' ? (this.firmware==='ESP32'?' 3000':' 683') : command === 'READ' ? ' 1' : '';
      this.controller.enqueue(new TextEncoder().encode(`${id} OK${payload}\n`));
    }});
  }
  async close() { this.closed = true; this.readable = null; this.writable = null; }
}
class FakeSerial extends EventTarget {
  constructor(port) { super(); this.port = port; this.allowed = true; }
  async requestPort() { return this.port; }
  async getPorts() { return this.allowed ? [this.port] : []; }
}
function serviceFor(port, options = {}) {
  return new ArduinoSerialService({serial:new FakeSerial(port), requestTimeout:30, handshakeAttempts:1, heartbeatInterval:100000, ...options});
}

test('serial handshakes before I/O, validates pins and cleans locks on disconnect/reconnect', async () => {
  const port = new FakePort(); const service = serviceFor(port);
  try {
    await assert.rejects(service.digitalWrite(13,1), /Connect/);
    await service.connect(); assert.equal(service.getState().status, 'connected');
    assert.equal(await service.readAnalog('A0'), 683);
    assert.equal(await service.readDigital(2), 1);
    await service.setPinMode(2, 'INPUT_PULLUP'); await service.digitalWrite(13,1);
    const count = port.commands.length;
    await assert.rejects(service.analogWrite(4,128), /PWM/);
    assert.equal(port.commands.length, count);
    await service.disconnect(); assert.equal(port.closed, true); assert.match(port.commands.at(-1), /STOP/);
    await service.reconnect(); assert.equal(service.getState().status, 'connected');
  } finally { await service.dispose(); }
});

test('wrong firmware and silent ports never become connected', async () => {
  for (const port of [new FakePort({firmware:'MEGA'}), new FakePort({silent:true})]) {
    const service = serviceFor(port);
    await assert.rejects(service.connect());
    assert.equal(service.getState().status, 'error'); assert.equal(port.closed, true);
    await service.dispose();
  }
});

test('ESP32 serial uses native ADC pins/range, validates GPIO and sends bounded servo/tone commands',async()=>{
  const port=new FakePort({firmware:'ESP32'}),service=serviceFor(port,{boardId:'esp32'});
  try {
    await service.connect();assert.equal(await service.readAnalog('34'),3000);assert.match(port.commands.at(-1),/ANALOG 34$/);
    await service.servoWrite(13,90);assert.match(port.commands.at(-1),/SERVO 13 90$/);
    await service.servoDetach(13);await service.tone(14,440,0.25);assert.match(port.commands.at(-1),/TONE 14 440 250$/);
    await service.tone(14,440,0.0001);assert.match(port.commands.at(-1),/TONE 14 440 1$/);
    await service.noTone(14);const count=port.commands.length;
    await assert.rejects(service.digitalWrite(34,1),/input-only/);
    await assert.rejects(service.setPinMode(34,'INPUT_PULLUP'),/pull-up/);
    await assert.rejects(service.servoWrite(13,90.5),/integer/);
    await assert.rejects(service.tone(14,30,1),/integer/);
    await assert.rejects(service.tone(14,440,Infinity),/duration/);
    assert.equal(port.commands.length,count);
  }finally{await service.dispose();}
});

test('unexpected removal clears pending state and permits explicit reconnect', async () => {
  const port = new FakePort(); const service = serviceFor(port);
  await service.connect(); port.controller.close();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(service.getState().status, 'error');
  assert.equal(service.pending.size, 0);
  await service.reconnect(); assert.equal(service.getState().status, 'connected');
  await service.dispose();
});

test('reconnect refuses a revoked permission and cancelled chooser leaves disconnected', async () => {
  const port = new FakePort(); const service = serviceFor(port);
  await service.connect(); await service.disconnect(); service.serial.allowed = false;
  await assert.rejects(service.reconnect(), /permission/); await service.dispose();
  const cancelled = serviceFor(new FakePort());
  cancelled.serial.requestPort = async () => { throw Object.assign(new Error('Cancelled'), {name:'NotFoundError'}); };
  await assert.rejects(cancelled.connect(), /Cancelled/); assert.equal(cancelled.getState().status, 'disconnected'); await cancelled.dispose();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('cancelled chooser cannot open a late selection or overwrite a later connection', async () => {
  const oldPort = new FakePort(), newPort = new FakePort(), chooser = deferred();
  let oldOpenCount = 0;
  oldPort.open = async () => { oldOpenCount++; };
  const service = serviceFor(oldPort);
  service.serial.requestPort = () => chooser.promise;
  const first = service.connect();
  const rejected = assert.rejects(first, {name:'AbortError'});
  await nextTurn();
  await service.disconnect();
  assert.equal(service.getState().status, 'disconnected');
  await service.connect({port:newPort});
  chooser.resolve(oldPort);
  await rejected;
  assert.equal(oldOpenCount, 0);
  assert.equal(service.port, newPort);
  assert.equal(service.getState().status, 'connected');
  await service.dispose();
});

test('cancel while native open is pending closes the late port without a handshake', async () => {
  const port = new FakePort(), opening = deferred(), service = serviceFor(port);
  const nativeOpen = port.open.bind(port);
  port.open = async () => { await opening.promise; await nativeOpen(); };
  const attempt = service.connect();
  const rejected = assert.rejects(attempt, {name:'AbortError'});
  await nextTurn();
  const cancelling = service.disconnect();
  assert.equal(service.getState().status, 'disconnecting');
  await assert.rejects(service.connect(), /active or closing/);
  opening.resolve();
  await Promise.all([cancelling, rejected]);
  assert.equal(service.getState().status, 'disconnected');
  assert.equal(service.port, null);
  assert.equal(port.closed, true);
  assert.deepEqual(port.commands, []);
  assert.equal(service.pending.size, 0);
  await service.dispose();
});

test('concurrent connect clicks cannot create multiple choosers', async () => {
  const chooser = deferred(), service = serviceFor(new FakePort());
  let chooserCalls = 0;
  service.serial.requestPort = () => { chooserCalls++; return chooser.promise; };
  const connecting = service.connect();
  const rejected = assert.rejects(connecting, {name:'AbortError'});
  await assert.rejects(service.connect(), /active or closing/);
  await nextTurn();
  assert.equal(chooserCalls, 1);
  await service.disconnect();
  chooser.resolve(new FakePort());
  await rejected;
  await service.dispose();
});

test('dispose invalidates a pending chooser permanently', async () => {
  const chooser = deferred(), port = new FakePort(), service = serviceFor(port);
  service.serial.requestPort = () => chooser.promise;
  const connecting = service.connect();
  const rejected = assert.rejects(connecting, {name:'AbortError'});
  await nextTurn();
  await service.dispose();
  chooser.resolve(port);
  await rejected;
  assert.equal(service.getState().status, 'disconnected');
  assert.equal(port.readable, undefined);
  await assert.rejects(service.connect(), /disposed/);
});

test('cancelling a reconnect permission lookup cannot reconnect later', async () => {
  const permission = deferred(), port = new FakePort(), service = serviceFor(port);
  await service.connect();
  await service.disconnect();
  service.serial.getPorts = () => permission.promise;
  const reconnecting = service.reconnect();
  const rejected = assert.rejects(reconnecting, {name:'AbortError'});
  await nextTurn();
  assert.equal(service.getState().status, 'connecting');
  await service.disconnect();
  permission.resolve([port]);
  await rejected;
  assert.equal(port.closed, true);
  assert.equal(service.getState().status, 'disconnected');
  await service.dispose();
});

test('cancelling during handshake clears pending requests and releases the port', async () => {
  const port = new FakePort({silent:true}), service = serviceFor(port);
  const connecting = service.connect();
  const rejected = assert.rejects(connecting, {name:'AbortError'});
  await nextTurn();
  assert.equal(service.pending.size, 1);
  await service.disconnect();
  await rejected;
  assert.equal(service.pending.size, 0);
  assert.equal(service.getState().status, 'disconnected');
  assert.equal(port.closed, true);
  await service.dispose();
});

test('a failed compiler health recheck clears the previous successful connection', async () => {
  let published = {client:{}, health:{cliAvailable:true}};
  const publish = result => { published = result; };
  await assert.rejects(verifyCompilerConnection({health:async () => { throw new Error('Offline'); }}, publish), /Offline/);
  assert.equal(published, null);
  for (const cliAvailable of [false, 'true', undefined]) {
    published = {client:{}, health:{cliAvailable:true}};
    await assert.rejects(verifyCompilerConnection({health:async () => ({cliAvailable})}, publish), /unavailable/);
    assert.equal(published, null);
  }
  const client = {health:async () => ({cliAvailable:true})};
  await verifyCompilerConnection(client, publish);
  assert.equal(published.client, client);
  assert.equal(published.health.cliAvailable, true);
});

test('readiness distinguishes secure context, browser capability, compiler and planned boards', () => {
  assert.equal(getHardwareReadiness('arduino-uno', {secureContext:false, serialAvailable:true}).canConnect, false);
  assert.equal(getHardwareReadiness('arduino-uno', {secureContext:true, serialAvailable:false}).canConnect, false);
  const ready = getHardwareReadiness('esp32', {secureContext:true, serialAvailable:true, helperStatus:{cliAvailable:true}});
  assert.equal(ready.canConnect, true); assert.equal(ready.canCompile, true); assert.equal(ready.physicalVerified, false);
  const planned = getHardwareReadiness('quarky', {secureContext:true, serialAvailable:true, helperStatus:{cliAvailable:true}});
  assert.equal(planned.canConnect, false); assert.equal(planned.canCompile, false);
});

test('hardware diagnostic export is allowlisted and excludes secrets and personal paths', () => {
  const secret = '/Users/person/private-session-token';
  const report = createHardwareDiagnostics({boardId:'esp32-cam', secureContext:true, serialAvailable:true,
    state:{status:'error', firmwareVersion:1, error:secret, port:secret, logs:[secret], token:secret},
    helperStatus:{cliAvailable:true, cliError:secret, cliPath:secret, token:secret, version:secret}, token:secret});
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(report.connection.hasError, true);
  assert.deepEqual(report.board.outputPins, [4,13,14]);
  assert.equal(report.board.physicalVerified, false);
  assert.deepEqual(Object.keys(report), ['format','version','board','browser','connection','compiler']);
  assert.equal(createHardwareDiagnostics({boardId:secret, state:{status:secret, firmwareVersion:secret}}).board, null);
  assert.equal(createHardwareDiagnostics({state:{status:secret}}).connection.status, 'unknown');
});

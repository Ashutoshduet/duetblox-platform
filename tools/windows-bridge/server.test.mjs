import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createBridgeServer, authorize, validateOrigin,validSerialPort,artifactBundle} from './server.mjs';

const token = 'test-pairing-token-at-least-thirty-two-characters';
const origin = 'http://localhost:5173';
const config = {token, origins:[origin], port:8765};
const headers = {host:'127.0.0.1:8765', origin, authorization:`Bearer ${token}`};
test('bridge requires exact origin, loopback Host and constant-time token authorization', () => {
  assert.equal(authorize({method:'GET',headers}, config), null);
  for (const changed of [{origin:'https://evil.example'},{origin:'null'},{host:'evil.example:8765'},{authorization:'Bearer wrong'},{origin:undefined}]) {
    assert.equal(typeof authorize({method:'POST',headers:{...headers,...changed}},config), 'string');
  }
  assert.equal(validateOrigin('*'), false); assert.equal(validateOrigin('http://example.com'), false);
  assert.equal(validateOrigin('https://school.example'), true);
});

async function request(port, path, {method='GET',body,override={}}={}) {
  return new Promise((resolve,reject) => {
    const req = http.request({host:'127.0.0.1',port,path,method,headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'}),...override}}, res => {
      let text=''; res.on('data', chunk => {text += chunk;}); res.on('end',()=>resolve({status:res.statusCode,body:text ? JSON.parse(text) : null}));
    }); req.on('error',reject); if(body!==undefined)req.write(JSON.stringify(body)); req.end();
  });
}
test('bridge compiles regenerated IR, uses fixed arguments and explicit bounded upload route', async () => {
  const calls=[];
  const runner = async (executable,args) => {
    calls.push({executable,args});
    if(args[0]==='board')return {code:0,stdout:JSON.stringify({detected_ports:['COM3','/dev/cu.usbserial-123','/dev/ttyUSB0'].map(address=>({port:{address,protocol:'serial'},matching_boards:[]}))}),stderr:''};
    if(args[0]==='compile') {
      const code=await readFile(join(args.at(-1),'DuetProgram.ino'),'utf8');
      assert.match(code,/duetDigitalWrite\(13/); assert.doesNotMatch(code,/attacker/);
      await writeFile(join(args[args.indexOf('--output-dir')+1],'DuetProgram.ino.hex'),':00000001FF\n');
    }
    return {code:0,stdout:'ok',stderr:''};
  };
  const bridge=createBridgeServer({...config,runner,enableUpload:true});
  bridge.server.listen(0,'127.0.0.1'); await once(bridge.server,'listening'); const port=bridge.server.address().port;
  try {
    assert.equal((await request(port,'/health',{override:{origin:'https://evil.example'}})).status,403);
    assert.equal((await request(port,'/health')).body.uploadEnabled,true);
    assert.equal((await request(port,'/compile',{method:'POST',body:{boardId:'attacker',project:{}}})).status,400);
    const project={version:1,setup:[{op:'digitalWrite',pin:13,value:1}],loop:[]};
    const result=await request(port,'/compile',{method:'POST',body:{boardId:'arduino-uno',project,code:'#include <attacker>',fqbn:'attacker'}});
    assert.equal(result.status,200); assert.equal(result.body.fqbn,'arduino:avr:uno');
    const artifactId=result.body.artifactId;
    const bundle=await request(port,`/artifact/${artifactId}`);
    assert.equal(bundle.status,200);assert.equal(bundle.body.kind,'duetblox-firmware');assert.equal(bundle.body.format,'ihex');
    assert.equal(Buffer.from(bundle.body.files[0].data,'base64').toString(),':00000001FF\n');
    assert.equal((await request(port,`/artifact/${artifactId}`,{override:{authorization:'wrong'}})).status,403);
    assert.equal((await request(port,'/upload',{method:'POST',body:{artifactId,port:'COM3'}})).status,400);
    assert.equal((await request(port,'/upload',{method:'POST',body:{artifactId,port:'COM3 & evil',confirm:true}})).status,400);
    assert.equal((await request(port,'/upload',{method:'POST',body:{artifactId,port:'COM4',confirm:true}})).status,400);
    assert.equal((await request(port,'/upload',{method:'POST',body:{artifactId,port:'COM3',confirm:true}})).body.uploaded,true);
    assert.deepEqual(calls.at(-1).args.slice(0,5),['upload','--fqbn','arduino:avr:uno','--port','COM3']);
    for(const address of ['/dev/cu.usbserial-123','/dev/ttyUSB0']) assert.equal((await request(port,'/upload',{method:'POST',body:{artifactId,port:address,confirm:true}})).body.uploaded,true);
    assert.equal((await request(port,'/health?token=leaked')).status,404);
  } finally { bridge.server.close(); await once(bridge.server,'close'); await bridge.cleanup(); }
});

test('health reports a missing CLI as unavailable without implying hardware support', async () => {
  const bridge = createBridgeServer({...config, runner: async () => { throw new Error('Arduino CLI could not start: ENOENT'); }});
  bridge.server.listen(0, '127.0.0.1'); await once(bridge.server,'listening');
  try {
    const result = await request(bridge.server.address().port, '/health');
    assert.equal(result.status, 200); assert.equal(result.body.cliAvailable, false);
    assert.match(result.body.cliError, /ENOENT/); assert.equal(result.body.physicalVerified, false);
  } finally { bridge.server.close(); await once(bridge.server, 'close'); await bridge.cleanup(); }
});

test('cross-platform ports are bounded and never accept executable options or arbitrary files',()=>{
  for(const p of ['COM1','COM256','/dev/ttyUSB0','/dev/ttyACM1','/dev/cu.usbmodem123','/dev/serial/by-id/usb-Espressif_UART-123'])assert.equal(validSerialPort(p),true,p);
  for(const p of ['COM0','COM1;rm','--port=evil','/tmp/ttyUSB0','/dev/../etc/passwd','/dev/cu.bad\nname','/dev/tty'])assert.equal(validSerialPort(p),false,p);
});

test('firmware bundles expose only bounded compiler outputs, with hashes and no bootloader HEX',async()=>{
  const output=await mkdtemp(join(tmpdir(),'duet-artifact-test-'));
  try{
    const artifact={output,boardId:'esp32',fqbn:'esp32:esp32:esp32'};
    await assert.rejects(artifactBundle(artifact,'id'),/unavailable/);
    const bytes=Buffer.from([0xff,0xff,0xe9,0x01]);
    await writeFile(join(output,'DuetProgram.ino.merged.bin'),bytes);
    const result=await artifactBundle(artifact,'id');
    assert.equal(result.format,'esp32');assert.equal(result.files.length,1);assert.equal(result.files[0].address,0);
    assert.equal(result.files[0].sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.physicalVerified,false);
    await writeFile(join(output,'DuetProgram.ino.with_bootloader.hex'),'not-selected');
    await assert.rejects(artifactBundle({...artifact,boardId:'arduino-uno'},'id'),/unavailable/);
    await writeFile(join(output,'DuetProgram.ino.hex'),Buffer.alloc(8*1024*1024+1));
    await assert.rejects(artifactBundle({...artifact,boardId:'arduino-uno'},'id'),/8 MiB/);
    await rm(join(output,'DuetProgram.ino.merged.bin'));await symlink(join(output,'DuetProgram.ino.hex'),join(output,'DuetProgram.ino.merged.bin'));
    await assert.rejects(artifactBundle(artifact,'id'),/invalid/);
  }finally{await rm(output,{recursive:true,force:true});}
});

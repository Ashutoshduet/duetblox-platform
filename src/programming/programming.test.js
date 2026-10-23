import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateFirmware,validateHex} from './firmware.js';
import {BrowserFlasher} from './browser-flasher.js';
import {BufferedSerialTransport} from './serial-transport.js';
import {Transport as ESPTransport} from 'esptool-js';
import {safeESPTransport} from './safe-esp-transport.js';
const hex=':0400000001020304F2\n:00000001FF\n';
function bundle(boardId='arduino-uno',text=hex){const bytes=Buffer.from(text);return {kind:'duetblox-firmware',version:1,boardId,format:boardId.startsWith('arduino')?'ihex':'esp32',files:[{address:0,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}]};}
test('firmware validates board, HEX memory boundaries and data integrity before write',async()=>{assert.equal((await validateFirmware(bundle(),'arduino-uno')).files[0].text,hex);await assert.rejects(validateFirmware(bundle(),'arduino-mega'),/selected board/);const corrupt=bundle();corrupt.files[0].data=Buffer.from('bad').toString('base64');await assert.rejects(validateFirmware(corrupt,'arduino-uno'),/checksum/);assert.throws(()=>validateHex(hex.replace('F2','F3'),32256),/checksum/);assert.throws(()=>validateHex(hex,2),/bootloader/);assert.throws(()=>validateHex(hex+hex,32256),/after HEX end/);assert.throws(()=>validateHex(':00000001FF',32256),/empty/);});
function serialPort({wrongSignature=false,corruptRead=false}={}){const memory=new Uint8Array(32768).fill(255),signals=[],writes=[];let address=0,controller;const port={memory,signals,writes,opened:false,closed:false,readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(bytes){writes.push(bytes);let reply=[0x14,0x10];switch(bytes[0]){case 0x75:reply=[0x14,0x1e,0x95,wrongSignature?0:0x0f,0x10];break;case 0x55:address=(bytes[1]+bytes[2]*256)*2;break;case 0x64:memory.set(bytes.subarray(4,4+bytes[1]*256+bytes[2]),address);break;case 0x74:{const data=memory.slice(address,address+bytes[1]*256+bytes[2]);if(corruptRead)data[0]^=1;reply=[0x14,...data,0x10];break;}}controller.enqueue(Uint8Array.from(reply));}}),async open(options){port.opened=options;},async close(){port.closed=true;},async setSignals(s){signals.push(s);}};return port;}
test('real STK500 programmer writes and reads back through buffered Web Serial',async()=>{const port=serialPort();const flasher=new BrowserFlasher({serial:{requestPort:async()=>port}});await flasher.flash(bundle(),{boardId:'arduino-uno'});assert.deepEqual([...port.memory.slice(0,4)],[1,2,3,4]);assert.ok(port.writes.some(x=>x[0]===0x74));assert.deepEqual(port.signals,[{dataTerminalReady:false},{dataTerminalReady:true}]);assert.equal(port.closed,true);assert.equal(flasher.busy,false);});
test('wrong AVR signature prevents erase and read-back mismatch fails upload',async()=>{const wrong=serialPort({wrongSignature:true});await assert.rejects(new BrowserFlasher({serial:{requestPort:async()=>wrong}}).flash(bundle(),{boardId:'arduino-uno'}),/signature/i);assert.equal(wrong.writes.some(x=>x[0]===0x52),false);assert.equal(wrong.closed,true);const corrupted=serialPort({corruptRead:true});await assert.rejects(new BrowserFlasher({serial:{requestPort:async()=>corrupted}}).flash(bundle(),{boardId:'arduino-uno'}),/verify/i);assert.equal(corrupted.closed,true);});
test('early serial replies buffer and translate RTS/DTR browser signals',async()=>{const port=serialPort(),transport=new BufferedSerialTransport(port);await transport.open(57600);await transport.write(Uint8Array.from([0x30,0x20]));const reply=await new Promise(resolve=>transport.on('data',resolve));assert.deepEqual([...reply],[0x14,0x10]);await transport.setSignals({rts:true,dtr:false});assert.deepEqual(port.signals[0],{requestToSend:true,dataTerminalReady:false});await transport.close();});
test('ESP upload checks detected chip, uses actual offsets and verifies MD5',async()=>{let disconnected=0,written;class ESPLoader{constructor({transport}){this.transport=transport;}chip={CHIP_NAME:'ESP32'};async main(){await this.transport.connect();}async after(mode){assert.equal(mode,'hard_reset');}async writeFlash(options){written=options;assert.equal(options.calculateMD5Hash(new Uint8Array([1,2,3])),createHash('md5').update(new Uint8Array([1,2,3])).digest('hex'));}}const flasher=new BrowserFlasher({serial:{requestPort:async()=>({async open(){},async close(){disconnected++;}})},loadESP:async()=>({Transport:ESPTransport,ESPLoader})});await flasher.flash(bundle('esp32','binary'),{boardId:'esp32'});assert.equal(written.fileArray[0].address,0);assert.equal(written.eraseAll,false);assert.equal(disconnected,1);ESPLoader.prototype.main=async function(){await this.transport.connect();this.chip={CHIP_NAME:'ESP32-S3'};};await assert.rejects(flasher.flash(bundle('esp32','binary'),{boardId:'esp32'}),/classic ESP32/);assert.equal(disconnected,2);});
test('cancelled chooser releases busy state without opening a serial port',async()=>{const flasher=new BrowserFlasher({serial:{requestPort:async()=>{throw new Error('No port selected');}}});await assert.rejects(flasher.flash(bundle(),{boardId:'arduino-uno'}),/No port/);assert.equal(flasher.busy,false);});
test('Mega wiring bootloader uses correct signature bytes, skips unsupported erase/descriptor and verifies writes',async()=>{
 const memory=new Uint8Array(262144).fill(255),commands=[];let address=0,controller,closed=false;
 const port={async open(){},async close(){closed=true;},async setSignals(){},readable:new ReadableStream({start(c){controller=c;}}),writable:new WritableStream({write(frame){const n=frame[2]*256+frame[3],body=frame.slice(5,5+n),cmd=body[0];commands.push(cmd);let reply=[cmd,0];if(cmd===1)reply=[1,0,3,65,86,82];else if(cmd===0x1b)reply=[cmd,0,[0x1e,0x98,0x01][body[4]],0];else if(cmd===4||cmd===0x12)reply=[cmd,0xc0];else if(cmd===6)address=((body[1]*0x1000000+body[2]*65536+body[3]*256+body[4])&0x7fffffff)*2;else if(cmd===0x13)memory.set(body.subarray(10,10+body[1]*256+body[2]),address);else if(cmd===0x14)reply=[cmd,0,...memory.slice(address,address+body[1]*256+body[2]),0];const response=Uint8Array.from([0x1b,frame[1],reply.length>>8,reply.length&255,0x0e,...reply,0]);response[response.length-1]=response.reduce((a,b)=>a^b,0);controller.enqueue(response.slice(0,3));controller.enqueue(response.slice(3));}})};
 await new BrowserFlasher({serial:{requestPort:async()=>port}}).flash(bundle('arduino-mega'),{boardId:'arduino-mega'});assert.deepEqual([...memory.slice(0,4)],[1,2,3,4]);assert.equal(commands.filter(c=>c===0x1b).length,3);assert.ok(commands.includes(0x14));assert.ok(!commands.includes(4)&&!commands.includes(0x12));assert.ok(closed);
});
test('cancel requested during device choice prevents opening or writing the port',async()=>{let choose;const port=serialPort();const flasher=new BrowserFlasher({serial:{requestPort:()=>new Promise(resolve=>{choose=resolve;})}});const job=flasher.flash(bundle(),{boardId:'arduino-uno'});await flasher.cancel();choose(port);await assert.rejects(job,/cancelled/);assert.equal(port.opened,false);assert.equal(port.writes.length,0);assert.equal(flasher.busy,false);});

test('actual ESP transport releases a rejecting writer and closes only once',async()=>{
 let closes=0;const port={async open(){},async close(){closes++;},writable:new WritableStream({write(){throw new Error('USB disconnected');}})};
 const SafeTransport=safeESPTransport(ESPTransport,{cleanupTimeoutMs:100});const transport=new SafeTransport(port);
 await transport.connect();await assert.rejects(transport.write(new Uint8Array([0xc0,0xdb])),/USB disconnected/);
 assert.equal(port.writable.locked,false);await transport.dispose();await transport.dispose();assert.equal(closes,1);
 await assert.rejects(transport.connect(),/cancelled/);await assert.rejects(transport.write(new Uint8Array([1])),/cancelled/);
});

test('cancel and flash finally share one ESP cleanup owner',async()=>{
 let closes=0,ready,resume;const started=new Promise(resolve=>{ready=resolve;}),continueMain=new Promise(resolve=>{resume=resolve;});
 class ESPLoader{constructor({transport}){this.transport=transport;}async main(){await this.transport.connect();ready();await continueMain;}}
 const port={async open(){},async close(){closes++;if(closes>1)throw new Error('Already closed');}};
 const flasher=new BrowserFlasher({serial:{requestPort:async()=>port},loadESP:async()=>({Transport:ESPTransport,ESPLoader})});
 const job=flasher.flash(bundle('esp32','binary'),{boardId:'esp32'});const rejected=assert.rejects(job,/cancelled/);await started;await flasher.cancel();resume();await rejected;
 assert.equal(closes,1);assert.equal(flasher.busy,false);
});

test('failed ESP connect preserves original error and never closes an unowned port',async()=>{
 const original=new Error('Port is already in use');let closes=0;
 class ESPLoader{constructor({transport}){this.transport=transport;}async main(){await this.transport.connect();}}
 const flasher=new BrowserFlasher({serial:{requestPort:async()=>({async open(){throw original;},async close(){closes++;throw new Error('Cleanup replaced original error');}})},loadESP:async()=>({Transport:ESPTransport,ESPLoader})});
 await assert.rejects(flasher.flash(bundle('esp32','binary'),{boardId:'esp32'}),error=>error===original);assert.equal(closes,0);assert.equal(flasher.busy,false);
});

test('cancel during pending ESP open closes the late port without sending data',async()=>{
 let ready,finishOpen,closes=0,writes=0;const started=new Promise(resolve=>{ready=resolve;}),opening=new Promise(resolve=>{finishOpen=resolve;});
 const port={async open(){ready();await opening;},async close(){closes++;},writable:new WritableStream({write(){writes++;}})};
 class ESPLoader{constructor({transport}){this.transport=transport;}async main(){await this.transport.connect();await this.transport.write(new Uint8Array([1]));}}
 const flasher=new BrowserFlasher({serial:{requestPort:async()=>port},loadESP:async()=>({Transport:ESPTransport,ESPLoader})});
 const job=flasher.flash(bundle('esp32','binary'),{boardId:'esp32'});const rejected=assert.rejects(job,/cancelled/);await started;const cancelled=flasher.cancel();assert.equal(closes,0);finishOpen();await Promise.all([cancelled,rejected]);assert.equal(closes,1);assert.equal(writes,0);
});

test('ESP cleanup is bounded and still closes an open which resolves after timeout',async()=>{
 let finishOpen,closes=0;const opening=new Promise(resolve=>{finishOpen=resolve;});const port={async open(){await opening;},async close(){closes++;}};
 const SafeTransport=safeESPTransport(ESPTransport,{cleanupTimeoutMs:20});const transport=new SafeTransport(port);const connection=transport.connect();const rejected=assert.rejects(connection,/cancelled/);
 await assert.rejects(transport.dispose(),/cleanup timed out/);assert.equal(closes,0);finishOpen();await rejected;await new Promise(resolve=>setTimeout(resolve,0));assert.equal(closes,1);await assert.rejects(transport.connect(),/cancelled/);
});

test('ESP cancellation rejects a stalled write and releases its writer lock',async()=>{
 let finishWrite,closes=0;const writing=new Promise(resolve=>{finishWrite=resolve;});const port={async open(){},async close(){closes++;},writable:new WritableStream({write(){return writing;}})};
 const SafeTransport=safeESPTransport(ESPTransport,{cleanupTimeoutMs:100});const transport=new SafeTransport(port);await transport.connect();
 const write=transport.write(new Uint8Array([1]));const rejected=assert.rejects(write,/cancelled/);await transport.dispose();await rejected;assert.equal(port.writable.locked,false);assert.equal(closes,1);finishWrite();
});

// Compile real firmware + representative exported programs. Never opens/flashes a device.
// DUETBLOX_ARDUINO_CLI=/path/arduino-cli DUETBLOX_ARDUINO_CONFIG=/path/config.yaml node src/hardware/build-firmware-bundles.mjs
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {boardRegistry} from './boards.js';
import {generateArduino} from './generator.js';
import {fixtureIR} from './tests/build-fixtures.mjs';
const run=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const cli=process.env.DUETBLOX_ARDUINO_CLI || 'arduino-cli';
const prefix=process.env.DUETBLOX_ARDUINO_CONFIG ? ['--config-file',resolve(process.env.DUETBLOX_ARDUINO_CONFIG)] : [];
const selected=process.argv.find(a=>a.startsWith('--boards='))?.slice(9).split(',');
const boards=boardRegistry.filter(b=>b.live&&(!selected||selected.includes(b.id)));
if(selected?.some(id=>!boards.some(b=>b.id===id)))throw Error('Unknown board ID in --boards.');
const buildRoot=join(root,'work','hardware-builds'),publicRoot=join(root,'public','firmware');
await mkdir(buildRoot,{recursive:true});await mkdir(publicRoot,{recursive:true});
const invoke=async args=>(await run(cli,[...prefix,...args],{cwd:root,timeout:600000,maxBuffer:4*1024*1024})).stdout;
const cliInfo=JSON.parse(await invoke(['version','--format','json']));
const coreInfo=JSON.parse(await invoke(['core','list','--format','json']));
const libraryInfo=JSON.parse(await invoke(['lib','list','--format','json']));
const toolchain={cli:{version:cliInfo.VersionString,commit:cliInfo.Commit},
  cores:(coreInfo.platforms||[]).map(p=>({id:p.id,version:p.installed_version})),
  libraries:(libraryInfo.installed_libraries||[]).map(({library})=>({name:library.name,version:library.version}))};
for(const board of boards){
  const sketchName=board.id==='esp32-cam'?'DuetBloxLiveESP32CAM':'DuetBloxLive';
  // Espressif savehex hooks create a build/ directory beside the sketch; keep those files in work/.
  const source=await readFile(join(root,'src','hardware','firmware',sketchName,sketchName+'.ino'));
  const sketch=join(buildRoot,board.id,sketchName),output=join(buildRoot,board.id,'live');
  await mkdir(sketch,{recursive:true});await writeFile(join(sketch,sketchName+'.ino'),source);
  await mkdir(output,{recursive:true});console.log(`Compiling live ${board.id} (${board.fqbn})`);
  const liveLog=await invoke(['compile','--fqbn',board.fqbn,'--output-dir',output,sketch]);
  console.log(liveLog.trim());
  const fileName=sketchName+'.ino.'+(board.core==='esp32:esp32'?'merged.bin':'hex');
  const bytes=await readFile(join(output,fileName));
  if(!bytes.length||bytes.length>8*1024*1024)throw Error('Unexpected firmware size');
  const fixture=join(buildRoot,board.id,'DuetProgram'),fixtureOutput=join(buildRoot,board.id,'fixture-build');
  await mkdir(fixture,{recursive:true});await mkdir(fixtureOutput,{recursive:true});
  const generated=generateArduino(fixtureIR(board),{boardId:board.id,name:'DuetProgram'});
  if(!generated.ok)throw Error(JSON.stringify(generated.diagnostics));
  await writeFile(join(fixture,'DuetProgram.ino'),generated.code);
  console.log(`Compiling feature fixture ${board.id}`);
  const fixtureLog=await invoke(['compile','--fqbn',board.fqbn,'--output-dir',fixtureOutput,fixture]);console.log(fixtureLog.trim());
  const builtAt=new Date().toISOString();
  const bundle={kind:'duetblox-firmware',version:1,boardId:board.id,fqbn:board.fqbn,format:board.core==='esp32:esp32'?'esp32':'ihex',
    source:'live-firmware',physicalVerified:false,compilerVerified:true,builtAt,toolchain,
    sourceSha256:createHash('sha256').update(source).digest('hex'),
    files:[{name:fileName,address:0,size:bytes.length,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}]};
  await writeFile(join(publicRoot,board.id+'.json'),JSON.stringify(bundle));
  await writeFile(join(buildRoot,board.id,'validation.json'),JSON.stringify({boardId:board.id,fqbn:board.fqbn,builtAt,toolchain,liveLog,fixtureLog,physicalVerified:false},null,2));
  console.log(`Published local firmware bundle public/firmware/${board.id}.json (${bytes.length} bytes, physical validation pending)`);
}

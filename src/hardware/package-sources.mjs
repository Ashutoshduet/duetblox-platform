// Package corresponding application/platform sources; compiler executables are not included.
import {mkdir,readFile,writeFile,copyFile,readdir,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const data=process.env.DUETBLOX_ARDUINO_DATA||join(root,'work/arduino/data');
const user=process.env.DUETBLOX_ARDUINO_USER||join(root,'work/arduino/user');
const downloads=process.env.DUETBLOX_ARDUINO_DOWNLOADS||join(root,'work/arduino/downloads');
const output=join(root,'public/source/hardware'),notices=join(output,'notices');
await mkdir(notices,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[];
const record=async(name,description)=>{const bytes=await readFile(join(output,name)),entry={name,size:bytes.length,sha256:sha(bytes),description};const index=files.findIndex(f=>f.name===name);if(index<0)files.push(entry);else files[index]=entry;};
const tar=async(name,cwd,paths,description)=>{
  await run('tar',['-czf',join(output,name),...paths],{cwd,env:{...process.env,COPYFILE_DISABLE:'1'},maxBuffer:1024*1024});await record(name,description);
};
await tar('arduino-avr-1.8.8-installed-platform.tar.gz',join(data,'packages/arduino/hardware/avr'),['1.8.8'],'Complete unmodified installed AVR platform, including original per-file notices and bootloader sources.');
await tar('Servo-1.3.0-sources.tar.gz',join(user,'libraries'),['Servo'],'Complete unmodified installed Servo library.');
const coreName='esp32-core-3.3.7.zip',coreBytes=await readFile(join(downloads,'packages',coreName));
const coreSHA='5267dc9a240daf4b8d26d3a1eb4c4f1dc8a40d43d527e6f6ce08cb6baaf6efac';
if(sha(coreBytes)!==coreSHA)throw Error('ESP32 core archive does not match official package checksum.');
const parts=[];
for(let start=0,index=1;start<coreBytes.length;start+=24*1024*1024,index++){
  const name=`${coreName}.part-${String(index).padStart(3,'0')}`;parts.push(name);
  await writeFile(join(output,name),coreBytes.subarray(start,Math.min(start+24*1024*1024,coreBytes.length)));
  await record(name,'Part of the exact official ESP32 3.3.7 source/platform ZIP; concatenate parts in order.');
}
const fetchFile=async(url,name)=>{const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`${response.status}: ${url}`);await writeFile(join(output,name),Buffer.from(await response.arrayBuffer()));await record(name,url);};
await copyFile(join(user,'libraries/Servo/LICENSE.txt'),join(notices,'Servo-LICENSE.txt'));
await copyFile(join(user,'libraries/Servo/LICENSE.txt'),join(notices,'Arduino-AVR-LGPL-2.1.txt'));
await copyFile(join(root,'LICENSE'),join(notices,'DUETBlox-AGPL-3.0.txt'));
await copyFile(join(data,'packages/esp32/hardware/esp32/3.3.7/cores/esp32/libb64/LICENSE'),join(notices,'ESP32-libb64-LICENSE.txt'));
await copyFile(join(data,'packages/esp32/hardware/esp32/3.3.7/libraries/BLE/LICENSE'),join(notices,'ESP32-BLE-LICENSE.txt'));
for(const name of await readdir(notices))await record('notices/'+name,'Original license text; additional copyright/license notices remain in source files.');
await fetchFile('https://raw.githubusercontent.com/espressif/arduino-esp32/3.3.7/LICENSE.md','notices/ESP32-core-LICENSE.md');
await fetchFile('https://raw.githubusercontent.com/espressif/esp-idf/87912cd291d68f4319f13695718af6754879a83f/LICENSE','notices/ESP-IDF-LICENSE.txt');
await fetchFile('https://codeload.github.com/espressif/esp32-arduino-lib-builder/tar.gz/8cabf2c3eaa169754f55f58675e224c918815eb7','esp32-lib-builder-8cabf2c-sources.tar.gz');
const sdk=join(data,'packages/esp32/tools/esp32-libs/3.3.7');
await copyFile(join(sdk,'versions.txt'),join(output,'esp32-sdk-versions.txt'));await record('esp32-sdk-versions.txt','Unmodified versions.txt from the actual esp32-libs 3.3.7 package.');
await tar('esp32-sdk-build-configuration.tar.gz',sdk,['versions.txt','sdkconfig','flags','ld'],'SDK build configuration/linker scripts supplied by the installed SDK. No precompiled archives are included.');
const versions=await readFile(join(sdk,'versions.txt'),'utf8');
const components=versions.trim().split('\n').filter(line=>line.includes('__')).map(line=>{
  const [name,version]=line.split(':').map(s=>s.trim());const [namespace,component]=name.split('__');
  return {name,version:version||null,source:version?`https://components.espressif.com/components/${namespace}/${component}/versions/${encodeURIComponent(version)}`:'https://github.com/espressif/esp32-camera',
    ...(version?{}:{note:'The upstream SDK versions.txt does not record a version for this component. Camera functionality is not linked into the DUETBlox GPIO sketch.'})};
});
const references=[
  {name:'ESP-IDF',ref:'87912cd291d68f4319f13695718af6754879a83f',source:'https://github.com/espressif/esp-idf/tree/87912cd291d68f4319f13695718af6754879a83f',note:'Release/v5.5; Arduino release identifies ESP-IDF5.5.2. Recursive submodules retain their own notices.'},
  {name:'Arduino source used by SDK builder',ref:'86c2c0046d4c732aa7cf6e049ac3b76a4da148b3',source:'https://github.com/espressif/arduino-esp32/tree/86c2c0046d4c732aa7cf6e049ac3b76a4da148b3'},
  {name:'TinyUSB',ref:'2883403ed010c54c33a38c28358a4dd0c67d67c0',source:'https://github.com/hathach/tinyusb/tree/2883403ed010c54c33a38c28358a4dd0c67d67c0'},
  {name:'Espressif Xtensa compiler build sources',version:'14.2.0_20251107',source:'https://github.com/espressif/crosstool-NG/releases/tag/esp-14.2.0_20251107'},
  {name:'Arduino AVR compiler build sources',version:'7.3.0-atmel3.6.1-arduino7',source:'https://github.com/arduino/toolchain-avr/releases/tag/7.3.0-atmel3.6.1-arduino7'}
];
await writeFile(join(output,'sdk-source-references.json'),JSON.stringify({sdkPackage:{name:'esp32-libs',version:'3.3.7',url:'https://github.com/espressif/arduino-esp32/releases/download/3.3.7/esp32-libs-3.3.7.zip',sha256:'913cffb43e7fdd8f8ddcd045908fa49f98dfff28832706c850b66fe9ab324bd7'},references,components,note:'This lists the upstream SDK contents, not a claim that every component is linked into these GPIO firmware images. SDK component sources remain at their pinned upstream references; compiler executables are not mirrored.'},null,2));
await record('sdk-source-references.json','Pinned upstream SDK/component/compiler source references.');
await tar('duetblox-hardware-sources.tar.gz',root,['LICENSE','package.json','src/hardware','src/ml/numbers/model.js','src/ml/decision.js','tools/windows-bridge','docs/hardware.md','public/source/hardware/BUILDING.md'],'Exact current DUETBlox firmware, generator, tests, helper and build/package scripts; repository AGPL license.');
await record('BUILDING.md','Build and relink instructions.');await record('index.html','Hardware source download page.');
const firmware=[];
for(const id of ['arduino-uno','arduino-mega','arduino-nano','esp32','esp32-cam']){
  const bundle=JSON.parse(await readFile(join(root,'public/firmware',id+'.json')));
  firmware.push({boardId:id,fqbn:bundle.fqbn,sourceSha256:bundle.sourceSha256,builtAt:bundle.builtAt,toolchain:bundle.toolchain,files:bundle.files.map(({name,sha256,size})=>({name,sha256,size})),physicalVerified:false});
}
const manifest={schemaVersion:1,createdAt:new Date().toISOString(),files,splitArchive:{name:coreName,size:coreBytes.length,sha256:coreSHA,parts,upstream:'https://github.com/espressif/arduino-esp32/releases/download/3.3.7/esp32-core-3.3.7.zip'},firmware,sourceScope:'Mirrored DUETBlox application, AVR platform, Servo, ESP32 Arduino core and SDK builder/configuration sources. SDK component and compiler sources are linked by pinned upstream references in sdk-source-references.json.'};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(output,'SHA256SUMS'),files.map(f=>`${f.sha256}  ${f.name}`).join('\n')+'\n'+`${sha(await readFile(join(output,'manifest.json')))}  manifest.json\n`);
console.log(`Hardware source bundle: ${files.length} files, largest ${Math.max(...files.map(f=>f.size))} bytes; ESP archive SHA256 verified.`);

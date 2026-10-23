import {writeFile,mkdir} from 'node:fs/promises';
import {liveFirmwareSource} from './firmware-source.js';
await writeFile(new URL('./firmware/DuetBloxLive/DuetBloxLive.ino',import.meta.url),liveFirmwareSource());
await mkdir(new URL('./firmware/DuetBloxLiveESP32CAM/',import.meta.url),{recursive:true});
await writeFile(new URL('./firmware/DuetBloxLiveESP32CAM/DuetBloxLiveESP32CAM.ino',import.meta.url),liveFirmwareSource({camera:true}));

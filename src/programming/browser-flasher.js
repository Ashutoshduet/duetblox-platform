import {md5} from '../junior/media.js';
import {validateFirmware} from './firmware.js';
import {megaProgrammer} from './mega-programmer.js';
import {BufferedSerialTransport} from './serial-transport.js';
import {safeESPTransport,within} from './safe-esp-transport.js';

const BOARD_KEYS={'arduino-uno':'arduino-uno','arduino-mega':'arduino-mega2560','arduino-nano':'arduino-nano'};
export class BrowserFlasher{
  constructor({serial=globalThis.navigator?.serial,onProgress=()=>{},onLog=()=>{},loadAVR=()=>import('webserial-flasher'),loadESP=()=>import('esptool-js')}={}){Object.assign(this,{serial,onProgress,onLog,loadAVR,loadESP});this.busy=false;this.transport=null;this.cancelled=false;}
  async cancel(){this.cancelled=true;if(this.operation){this.operation.cancelled=true;await this.cleanup(this.operation);}}
  checkCancelled(operation=this.operation){if(operation?.cancelled)throw new Error('Firmware upload cancelled.');}
  cleanup(operation){
    if(!operation.transport)return Promise.resolve();
    if(!operation.cleanup){const transport=operation.transport;operation.cleanup=transport.dispose?transport.dispose():within((async()=>{await operation.opening?.catch(()=>{});await transport.close();})(),2000);}
    return operation.cleanup;
  }
  async flash(bundle,{boardId,variant}={}){
    if(this.busy)throw new Error('A firmware upload is already running.');if(!this.serial)throw new Error('Use desktop Chrome or Edge with Web Serial support.');
    // Validation is completed by Prepare/Compile before the user clicks Upload.
    // The chooser is invoked before any await, preserving the user activation.
    if(bundle?.boardId!==boardId)throw new Error('Compile or prepare firmware for the selected board first.');
    this.busy=true;this.cancelled=false;const operation={cancelled:false,transport:null,opening:null,cleanup:null};this.operation=operation;let port,failure;try{
      const chooser=this.serial.requestPort();chooser.catch(()=>{});
      const verified=await validateFirmware(bundle,boardId);port=await chooser;this.checkCancelled(operation);
      if(BOARD_KEYS[boardId]){
        const {STK500,STK500v2,BOARDS}=await this.loadAVR();const key=boardId==='arduino-nano'&&variant==='old-bootloader'?'arduino-nano-old':BOARD_KEYS[boardId];const profile={...BOARDS[key],timeout:2000};this.checkCancelled(operation);
        this.transport=operation.transport=new BufferedSerialTransport(port);operation.opening=this.transport.open(profile.baudRate);await operation.opening;this.checkCancelled(operation);
        const Programmer=boardId==='arduino-mega'?megaProgrammer(STK500v2):STK500;
        const programmer=new Programmer(this.transport,profile,{logger:(level,text)=>this.onLog(text),retry:{syncAttempts:4,retryDelayMs:200}});
        await programmer.bootload(verified.files[0].text,(message,progress)=>this.onProgress({message,progress}));
      }else{
        const {ESPLoader,Transport}=await this.loadESP();this.checkCancelled(operation);const SafeTransport=safeESPTransport(Transport,{checkCancelled:()=>this.checkCancelled(operation)});this.transport=operation.transport=new SafeTransport(port,false);
        const loader=new ESPLoader({transport:this.transport,baudrate:115200,terminal:{clean(){},write:this.onLog,writeLine:this.onLog}});
        this.onProgress({message:'Connecting to ESP32 bootloader…',progress:0});await loader.main();this.checkCancelled(operation);
        if(loader.chip?.CHIP_NAME!=='ESP32')throw new Error('This profile is for classic ESP32, not an S2/S3/C3 or another chip.');
        await loader.writeFlash({fileArray:verified.files.map(f=>({data:f.bytes,address:f.address})),flashMode:'dio',flashFreq:'40m',flashSize:'4MB',eraseAll:false,compress:true,calculateMD5Hash:data=>md5(data),reportProgress:(index,written,total)=>this.onProgress({message:`Writing image ${index+1} of ${verified.files.length}`,progress:Math.round((index+written/total)/verified.files.length*100)})});
        this.checkCancelled(operation);await loader.after('hard_reset');this.onProgress({message:'Firmware written and verified.',progress:100});
      }
      this.checkCancelled(operation);return {uploaded:true,boardId};
    }catch(error){failure=error;throw error;}
    finally{try{await this.cleanup(operation);}catch(error){if(!failure)throw error;this.onLog(`Serial cleanup: ${error.message}`);}finally{if(this.operation===operation){this.transport=null;this.operation=null;this.busy=false;}}}
  }
}

const AVR_LIMITS={'arduino-uno':32256,'arduino-nano':30720,'arduino-mega':253952};
export const MAX_FIRMWARE_BYTES=4*1024*1024;
export function validateHex(text,maxAddress){
  if(typeof text!=='string'||text.length>1500000)throw new Error('The HEX file is too large.');
  let upper=0,end=0,eof=false,count=0;const occupied=new Set();
  for(const [index,line] of text.trim().split(/\r?\n/).entries()){
    if(eof)throw new Error('Unexpected data after HEX end record.');
    if(!/^:[0-9a-fA-F]+$/.test(line)||line.length%2!==1)throw new Error(`Invalid HEX record on line ${index+1}.`);
    const bytes=Uint8Array.from(line.slice(1).match(/../g).map(s=>parseInt(s,16)));
    if(bytes.length<5||bytes.length!==bytes[0]+5||bytes.reduce((a,b)=>(a+b)&255,0)!==0)throw new Error(`Invalid HEX length/checksum on line ${index+1}.`);
    const length=bytes[0],address=bytes[1]*256+bytes[2],type=bytes[3];
    if(type===0){const start=upper+address;if(!length||start+length>maxAddress)throw new Error('Firmware overlaps the bootloader or exceeds the selected board’s application memory.');for(let a=start;a<start+length;a++){if(occupied.has(a))throw new Error('Overlapping HEX records.');occupied.add(a);}end=Math.max(end,start+length);count+=length;}
    else if(type===1){if(length!==0||address!==0)throw new Error('Invalid HEX end record.');eof=true;}
    else if(type===2||type===4){if(length!==2||address!==0)throw new Error('Invalid HEX address record.');upper=(bytes[4]*256+bytes[5])*(type===2?16:65536);if(upper>=maxAddress)throw new Error('HEX address is outside the selected board’s application memory.');}
    else if(type===3||type===5){if(length!==4||address!==0)throw new Error('Invalid HEX start record.');}
    else throw new Error('Unsupported HEX record type.');
  }
  if(!eof||!count)throw new Error('HEX firmware is incomplete or empty.');
  return {bytes:count,endAddress:end};
}
function decodeBase64(value){if(typeof value!=='string'||!value.length||value.length>MAX_FIRMWARE_BYTES*1.4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Invalid firmware payload.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function validateFirmware(bundle,boardId){
  if(bundle?.kind!=='duetblox-firmware'||bundle.version!==1||bundle.boardId!==boardId)throw new Error('This firmware is not for the selected board.');
  const isAVR=Object.hasOwn(AVR_LIMITS,boardId);if(!isAVR&&!['esp32','esp32-cam'].includes(boardId))throw new Error('Browser flashing is not implemented for this board.');
  if(bundle.format!==(isAVR?'ihex':'esp32')||!Array.isArray(bundle.files)||!bundle.files.length||bundle.files.length>4)throw new Error('Invalid firmware format.');
  let total=0;const files=[];
  for(const file of bundle.files){const data=decodeBase64(file.data);total+=data.length;if(total>MAX_FIRMWARE_BYTES)throw new Error('Firmware exceeds the 4 MB profile limit.');if(!/^[a-f0-9]{64}$/i.test(file.sha256||''))throw new Error('Firmware checksum is missing.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256.toLowerCase())throw new Error('Firmware checksum does not match. Download or compile it again.');if(!Number.isInteger(file.address)||file.address<0)throw new Error('Invalid flash address.');files.push({...file,bytes:data});}
  if(isAVR){if(files.length!==1||files[0].address!==0)throw new Error('Arduino firmware must contain one application HEX file.');files[0].text=new TextDecoder().decode(files[0].bytes);validateHex(files[0].text,AVR_LIMITS[boardId]);}
  else {const addresses=files.map(f=>f.address).sort((a,b)=>a-b);if(!(addresses.length===1&&addresses[0]===0)&&addresses.join(',')!=='4096,32768,57344,65536')throw new Error('ESP32 firmware must contain a merged image or a complete bootloader/partition/app set.');for(const [i,file] of files.slice().sort((a,b)=>a.address-b.address).entries()){if(file.address+file.bytes.length>MAX_FIRMWARE_BYTES)throw new Error('ESP32 flash region exceeds the 4 MB profile.');const sorted=files.slice().sort((a,b)=>a.address-b.address);if(i&&sorted[i-1].address+sorted[i-1].bytes.length>file.address)throw new Error('ESP32 firmware regions overlap.');}}
  return {...bundle,files};
}

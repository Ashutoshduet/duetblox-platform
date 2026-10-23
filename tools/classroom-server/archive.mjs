import {inflateRawSync} from 'node:zlib';
export const MAX_UPLOAD=64*1024*1024;
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
// Inspect ZIP metadata and the project manifest without extracting any archive path.
export function validateProjectArchive(bytes,name){
 if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>MAX_UPLOAD)fail('Project size must be between 22 bytes and 64 MB.');
 if(typeof name!=='string'||name.length>120||/[\\/\x00-\x1f\x7f]/.test(name)||!/^.+\.(sb3|duet)$/i.test(name))fail('Choose a named .sb3 or .duet project.');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}}
 if(end<0)fail('The project is not a complete ZIP archive.');
 const entries=bytes.readUInt16LE(end+10),centralSize=bytes.readUInt32LE(end+12),centralOffset=bytes.readUInt32LE(end+16);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==entries||entries===65535||!entries||entries>5000||centralOffset+centralSize!==end)fail('Multi-volume, ZIP64 or oversized project archives are not supported.');
 let cursor=centralOffset,total=0;const names=new Set();let manifest=null;
 const manifestName=/\.sb3$/i.test(name)?'project.json':'duetblox.json';
 for(let i=0;i<entries;i++){
  if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)fail('Invalid ZIP directory.');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),packed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),n=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42);
  if(cursor+46+n+extra+comment>end||flags&1||![0,8].includes(method)||size===0xffffffff||packed===0xffffffff||offset===0xffffffff)fail('Unsupported or invalid ZIP entry.');
  const file=bytes.subarray(cursor+46,cursor+46+n).toString('utf8');
  if(!file||file.includes('\\')||file.startsWith('/')||file.includes('\0')||file.split('/').some(p=>p==='..'||p==='.')||/^[A-Za-z]:/.test(file)||names.has(file))fail('Unsafe or duplicate archive entry.');
  names.add(file);total+=size;if(total>200*1024*1024)fail('Expanded project exceeds 200 MB.');
  if(offset+30>centralOffset||bytes.readUInt32LE(offset)!==0x04034b50)fail('Invalid ZIP entry data.');
  const ln=bytes.readUInt16LE(offset+26),le=bytes.readUInt16LE(offset+28),start=offset+30+ln+le;
  if(start+packed>centralOffset||bytes.subarray(offset+30,offset+30+ln).toString('utf8')!==file||bytes.readUInt16LE(offset+8)!==method)fail('Invalid ZIP entry bounds.');
  if(file===manifestName){
   if(size>30*1024*1024)fail('Project manifest exceeds 30 MB.');
   try{const raw=method===0?bytes.subarray(start,start+packed):inflateRawSync(bytes.subarray(start,start+packed),{maxOutputLength:30*1024*1024});if(raw.length!==size)fail('Manifest size does not match.');manifest=JSON.parse(raw.toString('utf8'));}catch{fail('Project manifest is damaged.');}
  }
  cursor+=46+n+extra+comment;
 }
 if(cursor!==end||!manifest)fail('The project manifest is missing.');
 if(manifestName==='project.json'){
  if(!Array.isArray(manifest.targets)||manifest.targets.filter(t=>t?.isStage===true).length!==1||manifest.targets.some(t=>!t||typeof t!=='object'))fail('Invalid Scratch project.');
 }else if(manifest.kind!=='duetblox-project'||!Number.isInteger(manifest.version)||manifest.version<1||manifest.version>4)fail('Unsupported DUETBlox project.');
 return {type:manifestName==='project.json'?'sb3':'duet',expandedBytes:total};
}

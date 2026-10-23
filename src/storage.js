const DB='duetblox-workspace';
let opening;
function database(){return opening??=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('records');req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opening=undefined;reject(req.error);};});}
export async function readRecord(key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
// No awaits between puts: every record belongs to one atomic IndexedDB transaction.
export function writeRecordBatch(db,entries){return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');let failure;tx.oncomplete=()=>resolve();tx.onerror=()=>{failure??=tx.error;};tx.onabort=()=>reject(failure||tx.error||new Error('Local storage transaction was aborted.'));try{const store=tx.objectStore('records');for(const [key,value] of entries)store.put(value,key);}catch(error){failure=error;try{tx.abort();}catch{reject(error);}}});}
export async function writeRecords(entries){return writeRecordBatch(await database(),entries);}
export async function writeRecord(key,value){return writeRecords([[key,value]]);}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

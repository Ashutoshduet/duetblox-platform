// Nested values travel through Scratch variables as explicit JSON text. No eval.
const MAX_TEXT=24000,MAX_DEPTH=12,MAX_ITEMS=2000;
function validate(value,depth=0,budget={count:0}){
 if(++budget.count>MAX_ITEMS||depth>MAX_DEPTH)throw Error('Data lists allow up to 2,000 values and 12 nesting levels.');
 if(Array.isArray(value)){for(const item of value)validate(item,depth+1,budget);return value;}
 if(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=MAX_TEXT||typeof value==='number'&&Number.isFinite(value))return value;
 throw Error('Data lists contain text, numbers, true/false, null or other lists. Objects are not supported.');
}
const encode=value=>{validate(value);const result=JSON.stringify(value);if(result.length>MAX_TEXT)throw Error('A data list must be smaller than 24,000 characters.');return result;};
export function parseDataList(text){if(typeof text!=='string'||text.length>MAX_TEXT)throw Error('Enter a JSON data list, for example [1, 2, [3, 4]].');let value;try{value=JSON.parse(text);}catch{throw Error('Invalid JSON list. Use square brackets and double quotes around text.');}if(!Array.isArray(value))throw Error('A data list starts with [ and ends with ].');return validate(value);}
function item(value){if(typeof value==='string'&&value.trim().startsWith('['))return parseDataList(value);if(typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean')return value;return String(value);}
function position(index,length,{insert=false}={}){const n=Number(index);if(!Number.isInteger(n)||n<1||n>length+(insert?1:0))throw Error(`Choose an item number from 1 to ${length+(insert?1:0)}.`);return n-1;}
const scalar=value=>Array.isArray(value)?encode(value):value===null?'null':value;
export function dataListRpc(method,args=[]){
 if(method==='empty')return '[]';
 if(method==='fromJSON')return encode(parseDataList(String(args[0])));
 if(method==='pair')return encode([item(args[0]),item(args[1])]);
 const list=parseDataList(String(args[0]));
 switch(method){
  case 'length':return list.length;
  case 'item':return scalar(list[position(args[1],list.length)]);
  case 'append':list.push(item(args[1]));return encode(list);
  case 'replace':list[position(args[1],list.length)]=item(args[2]);return encode(list);
  case 'remove':list.splice(position(args[1],list.length),1);return encode(list);
  case 'slice':{const from=position(args[1],list.length),to=position(args[2],list.length);if(to<from)throw Error('The last item must be at or after the first.');return encode(list.slice(from,to+1));}
  default:throw Error('Unknown data-list operation.');
 }
}

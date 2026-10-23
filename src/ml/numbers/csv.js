import {numberValue,validateNumberDataset} from './model.js';
// Strict bounded RFC 4180-style CSV reader; no expressions, formula evaluation or coercion of blanks.
export function parseCSV(text) {
  if(typeof text!=='string'||text.length>2e6)throw new Error('Choose a CSV file smaller than 2 MB.');
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
  const pushCell=()=>{row.push(cell);cell='';closed=false;if(row.length>9)throw new Error('Use at most 8 input columns and one target column.');};
  const pushRow=()=>{pushCell();if(row.some(v=>v!==''))rows.push(row);row=[];if(rows.length>1001)throw new Error('Use at most 1,000 data rows.');};
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c==='"'){if(cell!==''||closed)throw new Error('A CSV quote must start at the beginning of a cell.');quoted=true;}
    else if(c===',')pushCell();
    else if(c==='\n'||c==='\r'){pushRow();if(c==='\r'&&text[i+1]==='\n')i++;}
    else{if(closed)throw new Error('Unexpected text after a closing CSV quote.');cell+=c;}
  }
  if(quoted)throw new Error('A CSV quoted cell is not closed.');if(cell!==''||row.length||closed)pushRow();return rows;
}
export function importNumberCSV(text,task='classification') {
  const rows=parseCSV(text);if(!rows.length||rows[0].length<2)throw new Error('CSV needs a header, at least one input column, and the target in the last column.');
  const headers=rows[0].map(v=>v.trim()),features=headers.slice(0,-1),targetName=headers.at(-1),data={kind:'duetblox-numbers-dataset',version:1,task,features,targetName,rows:rows.slice(1).map((row,index)=>{if(row.length!==headers.length)throw new Error(`CSV row ${index+2} has ${row.length} columns; expected ${headers.length}.`);return {inputs:row.slice(0,-1).map((v,j)=>numberValue(v,`Row ${index+2}, ${features[j]}`)),target:task==='regression'?numberValue(row.at(-1),`Row ${index+2}, target`):row.at(-1).trim()};})};
  return validateNumberDataset(data);
}
export function exportNumberCSV(data) {
  validateNumberDataset(data);
  // Quote every text cell. JSON export preserves exact labels for tools that treat CSV text as formulas.
  const cell=value=>typeof value==='number'?String(value):`"${String(value).replace(/"/g,'""')}"`;
  return [[...data.features,data.targetName],...data.rows.map(r=>[...r.inputs,r.target])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}

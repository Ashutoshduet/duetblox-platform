export function defaultNumberDataset(task='classification'){return {kind:'duetblox-numbers-dataset',version:1,task,features:['light','temperature'],targetName:task==='classification'?'label':'value',rows:[]};}
export function exampleNumberDataset(task='classification') {
  if(task==='regression')return {kind:'duetblox-numbers-dataset',version:1,task,features:['distance'],targetName:'travel_time',rows:Array.from({length:20},(_,i)=>({inputs:[i*5],target:3*i*5+12}))};
  return {kind:'duetblox-numbers-dataset',version:1,task:'classification',features:['light','temperature'],targetName:'environment',rows:[...Array.from({length:10},(_,i)=>({inputs:[30+i*5,18+i*.3],target:'Shade'})),...Array.from({length:10},(_,i)=>({inputs:[700+i*10,28+i*.3],target:'Sun'}))]};
}

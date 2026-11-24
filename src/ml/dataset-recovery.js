import {datasetGuard,loadDatasetOperation} from './dataset-lifecycle.js';

export const datasetRecoveryKey=kind=>`${kind}-dataset-recovery`;

// Persist both sides before changing the UI. A failed write leaves the working
// dataset intact, and the service lock prevents training/import races.
export async function replaceDatasetWithRecovery({kind,service,load,apply,write,isCurrent=()=>true,recover=true}) {
  return loadDatasetOperation({service,message:recover?'Saving a recovery copy…':'Restoring previous dataset…',isCurrent,
    load:async()=>{
      const current=datasetGuard(service,isCurrent),previous=structuredClone(service.dataset);
      const next=await load();
      if(!current({requireIdle:false}))return null;
      const recovery=recover?{version:1,dataset:previous,savedAt:Date.now()}:null;
      await write([[`${kind}-dataset`,next],[datasetRecoveryKey(kind),recovery]]);
      return {next,recovery};
    },
    apply:result=>{if(result){apply(result.next,result.recovery);service.update?.({message:recover?'Dataset opened. Train again to update the model.':'Previous dataset restored. Train again to update the model.'});}}
  });
}

export function importErrorMessage(error) {
  return error instanceof SyntaxError
    ? 'This file is not valid JSON. Choose a dataset or model exported by DUETBlox, or use the matching model import option. Your current dataset has not been replaced.'
    : error?.message||'The file could not be opened. Please choose an exported DUETBlox file.';
}

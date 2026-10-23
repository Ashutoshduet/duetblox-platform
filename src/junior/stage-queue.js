// Keep only the latest preview waiting behind an in-flight Scratch load.
// Cancellation prevents a stale Play from starting after Stop or a stage restart.
export function createJuniorStageQueue(load) {
 let revision=0,tail=Promise.resolve();
 return {
  load(project){
   const ticket=++revision;
   const operation=tail.catch(()=>{}).then(async()=>{
    if(ticket!==revision)return false;
    await load(project);
    return ticket===revision;
   });
   tail=operation;
   return operation;
  },
  cancel(){revision++;},
  reset(){revision++;tail=Promise.resolve();}
 };
}

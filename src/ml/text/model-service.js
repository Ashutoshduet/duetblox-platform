import {readRecord,writeRecord} from '../../storage.js';
import {DEFAULT_PREDICTION_POLICY,normalizePredictionPolicy,decidePrediction,policyFromPercent} from '../decision.js';
import {trainTextClassifier,predictText,cloneTextArtifact,evaluateTextHoldout,validateTextDataset} from './classifier.js';
export {validateTextArtifact,validateTextDataset,defaultTextClasses} from './classifier.js';

export class TextModelService {
  constructor({read=readRecord,write=writeRecord}={}){
    this.read=read;this.write=write;this.model=null;this.dataset=null;this.operation=null;this.epoch=0;this.workspaceToken=null;this.listeners=new Set();this.cancelRequested=false;
    this.state={phase:'empty',busy:false,message:'Add text examples to start teaching.',progress:0,predictions:[],labels:[],explanation:null,evaluation:null,error:null,predictionPolicy:{...DEFAULT_PREDICTION_POLICY},decision:decidePrediction([])};
  }
  subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
  snapshot=()=>this.state;
  update(patch){this.state={...this.state,...patch};for(const fn of this.listeners)try{fn();}catch{}}
  assertIdle(){if(this.operation)throw new Error('Wait for the current text model operation to finish.');}
  beginOperation(message){this.assertIdle();const token=Symbol('text-model-operation');this.operation=token;this.epoch++;this.cancelRequested=false;this.update({phase:'loading',busy:true,message,error:null});return token;}
  endOperation(token,error){if(!token||this.operation!==token)return false;this.operation=null;if(this.workspaceToken===token)this.workspaceToken=null;this.update({phase:this.model?'ready':'empty',busy:false,...(error?{message:error.message,error:error.message}:{})});return true;}
  beginWorkspaceImport(){return this.workspaceToken=this.beginOperation('Opening workspace text model…');}
  endWorkspaceImport(token,error){if(token&&token===this.workspaceToken&&!error)this.update({message:this.model?'Workspace text model ready.':'Add text examples to start teaching.'});return this.endOperation(token,error);}
  async restore(){const epoch=this.epoch;if(this.operation||this.model)return false;try{const artifact=await this.read('text-model');if(this.operation||this.model||this.epoch!==epoch)return false;if(artifact){await this.importArtifact(artifact,false);return true;}return false;}catch(error){if(!this.operation&&this.epoch===epoch)this.update({message:'Saved text model could not be restored. Import or train it again.',error:error.message});return false;}}
  async setPredictionPolicy(policy,{persist=true}={}){const normalized=normalizePredictionPolicy(policy),token=this.beginOperation('Saving prediction settings…');try{if(persist&&this.model)await this.write('text-model',{...await this.exportArtifact(),predictionPolicy:normalized});const decision=this.state.explanation?.knownWords===0?{label:'Unknown',accepted:false,probability:0,margin:0,reason:'no-known-words'}:decidePrediction(this.state.predictions,normalized);this.update({predictionPolicy:normalized,decision});return normalized;}finally{this.endOperation(token);}}
  async train(classes){
    const data={kind:'duetblox-text-dataset',version:1,classes:structuredClone(classes)};validateTextDataset(data);
    const token=this.beginOperation('Learning word frequencies…');
    try{
      this.update({phase:'training',progress:.1});await new Promise(r=>setTimeout(r,0));
      if(this.cancelRequested)throw new Error('Training cancelled.');
      const candidate={...trainTextClassifier(data.classes),predictionPolicy:normalizePredictionPolicy(this.state.predictionPolicy)},evaluation=evaluateTextHoldout(data.classes);
      if(this.cancelRequested)throw new Error('Training cancelled.');
      // Save before replacing: a storage failure leaves the previous usable model intact.
      await this.write('text-model',candidate);await this.replaceModel(candidate);this.dataset=data;
      this.update({progress:1,evaluation,message:'Text model trained. Test a new sentence before using it in Blocks.'});
    }catch(error){this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}
  }
  cancelTraining(){this.cancelRequested=true;}
  async prepareArtifact(artifact){return cloneTextArtifact(artifact);}
  async exportArtifact(){return this.model?cloneTextArtifact({...this.model,predictionPolicy:this.state.predictionPolicy}):null;}
  async replaceModel(candidate){const predictionPolicy=normalizePredictionPolicy(candidate.predictionPolicy),old=this.model;this.model=candidate;this.update({labels:candidate.classes.map(c=>c.name),predictionPolicy,predictions:[],decision:decidePrediction([],predictionPolicy),explanation:null,evaluation:null,error:null});if(old!==candidate)this.disposeModel(old);}
  disposeModel(){/* This model only owns JSON data; no tensors or media tracks. */}
  async #acceptArtifact(artifact,persist){const candidate=await this.prepareArtifact(artifact);if(persist)await this.write('text-model',candidate);await this.replaceModel(candidate);this.update({message:'Text model ready. Try a new sentence.'});}
  async importArtifact(artifact,persist=true){const token=this.beginOperation('Opening text model…');try{await this.#acceptArtifact(artifact,persist);}catch(error){this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}}
  async importFiles(files){const list=Array.from(files),file=list[0];if(list.length!==1||!file||file.size>8e6)throw new Error('Choose one text model JSON smaller than 8 MB.');const token=this.beginOperation('Reading text model…');try{await this.#acceptArtifact(JSON.parse(await file.text()),true);}catch(error){this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}}
  async importDatasetFile(file){if(!file||file.size>8e6)throw new Error('Choose a text dataset JSON smaller than 8 MB.');const token=this.beginOperation('Reading text examples…');try{const data=JSON.parse(await file.text());validateTextDataset(data);await this.write('text-dataset',data);this.dataset=data;this.update({message:'Text examples opened. Train to update the model.'});return data;}catch(error){this.update({message:error.message,error:error.message});throw error;}finally{this.endOperation(token);}}
  async persist(){await this.write('text-model',await this.exportArtifact());}
  async predict(text){this.assertIdle();if(!this.model)throw new Error('Train or import a text model first.');const result=predictText(this.model,String(text??''));const decision=result.explanation.knownWords===0?{label:'Unknown',accepted:false,probability:0,margin:0,reason:'no-known-words'}:decidePrediction(result.predictions,this.state.predictionPolicy);this.update({...result,decision});return result.predictions;}
  async clear(token,{persist=true}={}){const owned=token===undefined,operation=owned?this.beginOperation('Clearing text model…'):token;if(!owned&&(!token||token!==this.operation||token!==this.workspaceToken))throw new Error('The workspace import operation is no longer active.');try{if(persist)await this.write('text-model',null);this.disposeModel(this.model);this.model=null;this.update({labels:[],predictionPolicy:normalizePredictionPolicy(),predictions:[],decision:decidePrediction([]),explanation:null,evaluation:null,progress:0,error:null,message:'Add text examples to start teaching.'});}finally{if(owned)this.endOperation(operation);}}
  async rpc(method,args=[]){switch(method){case'predict':await this.predict(args[0]);return this.state.decision.label;case'label':return this.state.decision.label;case'confidence':return(this.state.predictions[0]?.probability||0)*100;case'confidenceFor':return(this.state.predictions.find(p=>p.className===String(args[0]))?.probability||0)*100;case'isReady':return !!this.model;case'isAccepted':return this.state.decision.accepted;case'setMinimumConfidence':await this.setPredictionPolicy(policyFromPercent(this.state.predictionPolicy,'minimumConfidence',args[0]));return true;case'setMinimumMargin':await this.setPredictionPolicy(policyFromPercent(this.state.predictionPolicy,'minimumMargin',args[0]));return true;default:throw new Error('Unknown text-learning command.');}}
}
export const textModel=new TextModelService();

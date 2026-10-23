import {checkEvaluationSeparation,createEvaluationReport} from './evaluation.js';

async function infer(model,kind,data){
  if(kind==='sound'){
    const [{spectrogram,normalized},tf]=await Promise.all([import('./audio/waveform.js'),import('@tensorflow/tfjs')]);
    const shape=model.modelInputShape(),frames=shape[1],bins=shape[2],features=await spectrogram(data,{frames,bins});
    const tensor=tf.tensor4d(normalized(features),[1,frames,bins,1]);
    try{const result=await model.recognize(tensor);return {predictions:model.wordLabels().map((className,i)=>({className,probability:result.scores[i]}))};}finally{tensor.dispose();}
  }
  const {loadImage,squareImage}=await import('./model-service.js'),image=await loadImage(data);
  if(kind==='image')return {predictions:await model.predict(squareImage(image))};
  if(kind==='pose'){
    const {poseImage}=await import('./pose/model-service.js'),result=await model.estimatePose(poseImage(image),false),poseConfidence=result.pose?.score||0;
    return {poseConfidence,predictions:poseConfidence<.15?[]:await model.predict(result.posenetOutput)};
  }
  throw new Error('Unsupported evaluation model type.');
}

/** Hold the same ownership lock as training/import so a batch cannot mix model versions. */
export async function runEvaluation({service,kind,samples,trainingClasses,policy,signal,onProgress}){
  signal?.throwIfAborted();if(!service.model)throw new Error('Train or import a model before evaluating.');
  if(!samples.length||samples.length>300)throw new Error('Use 1–300 separate evaluation examples.');
  const token=service.beginOperation('Checking evaluation examples…'),model=service.model;
  try{
    if(service.predicting)await service.predicting.catch(()=>{});
    signal?.throwIfAborted();if(service.model!==model)throw new Error('The model changed. Run evaluation again.');
    const {leaks,duplicates}=await checkEvaluationSeparation(trainingClasses,samples,{signal});
    if(leaks.length)throw new Error(`${leaks.length} evaluation example(s) exactly match training data. Remove them and upload genuinely new examples.`);
    if(duplicates.length)throw new Error(`${duplicates.length} evaluation example(s) are duplicates. Remove repeated examples before evaluating.`);
    const labels=kind==='sound'?model.wordLabels():model.getClassLabels();
    if(samples.some(s=>!labels.includes(s.actual)))throw new Error('Some evaluation labels no longer match this model. Remove those examples.');
    const rows=[];
    for(const sample of samples){
      signal?.throwIfAborted();if(service.model!==model)throw new Error('The model changed. Run evaluation again.');
      let result,error;
      const pending=infer(model,kind,sample.data);service.predicting=pending;
      try{result=await pending;}catch(e){error=e.message||String(e);}finally{if(service.predicting===pending)service.predicting=null;}
      signal?.throwIfAborted();rows.push({id:sample.id,name:sample.name,actual:sample.actual,...result,...(error?{error}:{})});
      service.update({message:`Evaluating ${rows.length} of ${samples.length}`,progress:rows.length/samples.length});
      onProgress?.(rows.length,samples.length);await new Promise(resolve=>setTimeout(resolve,0));
    }
    signal?.throwIfAborted();if(service.model!==model)throw new Error('The model changed. Run evaluation again.');
    const report=createEvaluationReport({kind,labels,rows,policy});
    service.update({message:`Evaluation complete: ${report.summary.evaluated} examples, ${report.summary.failed} failed.`});
    return {report,rows,model};
  }catch(error){service.update({message:error.name==='AbortError'?'Evaluation cancelled.':error.message});throw error;}
  finally{service.endOperation(token);}
}

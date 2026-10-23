import JSZip from 'jszip';
import {makeJuniorProject,parseJuniorProject} from './junior/model.js';
import {getBoard} from './hardware/boards.js';
import {validateDataset} from './ml/validation.js';
import {validateSoundDataset,defaultSoundClasses} from './ml/audio/model-service.js';
import {validatePoseDataset,defaultPoseClasses} from './ml/pose/model-service.js';
import {modelFromZip} from './ml/archive.js';
import {validateTextDataset,validateTextArtifact,defaultTextClasses} from './ml/text/model-service.js';
import {validateEvaluationDataset} from './ml/evaluation.js';
import {defaultPythonProject,validatePythonProject} from './python/project.js';
import {validateNumberDataset,validateNumberArtifact} from './ml/numbers/model.js';
import {defaultNumberDataset} from './ml/numbers/fixtures.js';
import {defaultObjectDataset,validateObjectDataset,validateObjectMetadata} from './ml/objects/model.js';
export function emptyDataset(){return {kind:'duetblox-image-dataset',version:1,classes:[{id:crypto.randomUUID(),name:'Class 1',samples:[]},{id:crypto.randomUUID(),name:'Class 2',samples:[]}]};}
const MAX_SCRATCH_BYTES=100*1024*1024;
export async function validateScratchArchive(data,{base64=false,maxUncompressedBytes=MAX_SCRATCH_BYTES,maxProjectBytes=10*1024*1024}={}){
 const zip=await JSZip.loadAsync(data,{base64});const entries=Object.values(zip.files).filter(file=>!file.dir);
 if(entries.length>5000)throw new Error('The Scratch project contains too many files.');
 let total=0;for(const entry of entries){const size=entry._data?.uncompressedSize;if(!Number.isSafeInteger(size)||size<0||(total+=size)>maxUncompressedBytes)throw new Error('The expanded Scratch project exceeds its size limit.');}
 const jsonFile=zip.file('project.json');if(!jsonFile)throw new Error('Scratch project.json is missing.');if(jsonFile._data.uncompressedSize>maxProjectBytes)throw new Error('Scratch project.json exceeds its size limit.');
 const project=JSON.parse(await jsonFile.async('string'));if(!Array.isArray(project?.targets)||project.targets.filter(t=>t?.isStage===true).length!==1||project.targets.some(t=>!t||typeof t!=='object'))throw new Error('The Scratch project is invalid.');
 return project;
}
// Preserve the actual VM project until both replacement and durable storage succeed.
export async function replaceScratchProject(send,sb3,persist=async()=>{}){
 const previous=await send('saveProject');try{if(sb3)await send('loadProject',{project:sb3,encoding:'base64'});else await send('resetProject');await persist();}catch(error){try{await send('loadProject',{project:previous.base64,encoding:'base64'});}catch(rollback){throw new Error(`${error.message} The previous Scratch program could not be restored: ${rollback.message}`,{cause:error});}throw error;}
}
export async function parseWorkspace(data){
 const zip=await JSZip.loadAsync(data);let expanded=0;const modelSizes=new Map();for(const entry of Object.values(zip.files)){if(entry.dir)continue;const size=entry._data?.uncompressedSize;if(!Number.isSafeInteger(size)||size<0||(expanded+=size)>200*1024*1024)throw new Error('The expanded DUETBlox workspace exceeds 200 MB.');const modelEntry=entry.name.match(/^ml\/(?:(sound|pose|objects)\/)?(?:model\.json|weights\.bin|metadata\.json)$/);if(modelEntry){const kind=modelEntry[1]||'image',modelSize=(modelSizes.get(kind)||0)+size;modelSizes.set(kind,modelSize);if(modelSize>100*1024*1024)throw new Error('A workspace model exceeds 100 MB.');}}const manifestFile=zip.file('duetblox.json');if(!manifestFile)throw new Error('Choose a DUETBlox .duet project or a Scratch .sb3 file.');if(manifestFile._data.uncompressedSize>30*1024*1024)throw new Error('The workspace manifest exceeds 30 MB.');
 const manifest=JSON.parse(await manifestFile.async('string'));if(manifest.kind!=='duetblox-project'||![1,2,3,4].includes(manifest.version))throw new Error('This project version is not supported.');
 const junior=manifest.junior?parseJuniorProject(manifest.junior):makeJuniorProject();const board=getBoard(manifest.board)?manifest.board:'arduino-uno';
 const datasetFile=zip.file('ml/dataset.json');const dataset=datasetFile?JSON.parse(await datasetFile.async('string')):emptyDataset();validateDataset(dataset);
 const modalities={};for(const [kind,defaults,validate] of [['sound',defaultSoundClasses,validateSoundDataset],['pose',defaultPoseClasses,validatePoseDataset]]){const entry=zip.file(`ml/${kind}/dataset.json`);const dataset=entry?JSON.parse(await entry.async('string')):{kind:`duetblox-${kind}-dataset`,version:1,classes:defaults()};validate(dataset);modalities[kind]={dataset,model:await modelFromZip(zip,`ml/${kind}/`,kind)};}
 const textDatasetFile=zip.file('ml/text/dataset.json');const textDataset=textDatasetFile?JSON.parse(await textDatasetFile.async('string')):{kind:'duetblox-text-dataset',version:1,classes:defaultTextClasses()};validateTextDataset(textDataset);
 const textModelFile=zip.file('ml/text/model.json');if(textModelFile?._data.uncompressedSize>10*1024*1024)throw new Error('The text model exceeds 10 MB.');const textModel=textModelFile?JSON.parse(await textModelFile.async('string')):null;if(textModel)validateTextArtifact(textModel);modalities.text={dataset:textDataset,model:textModel};
 const numbersDatasetFile=zip.file('ml/numbers/dataset.json'),numbersModelFile=zip.file('ml/numbers/model.json');
 if(numbersDatasetFile?._data.uncompressedSize>2*1024*1024||numbersModelFile?._data.uncompressedSize>100000)throw new Error('The numbers dataset or model exceeds its size limit.');
 const numbersDataset=numbersDatasetFile?JSON.parse(await numbersDatasetFile.async('string')):defaultNumberDataset();validateNumberDataset(numbersDataset);const numbersModel=numbersModelFile?JSON.parse(await numbersModelFile.async('string')):null;if(numbersModel)validateNumberArtifact(numbersModel);modalities.numbers={dataset:numbersDataset,model:numbersModel};
 const objectDatasetFile=zip.file('ml/objects/dataset.json');if(objectDatasetFile?._data.uncompressedSize>22*1024*1024)throw new Error('The object dataset exceeds its size limit.');const objectDataset=objectDatasetFile?JSON.parse(await objectDatasetFile.async('string')):defaultObjectDataset();validateObjectDataset(objectDataset);const objectModel=await modelFromZip(zip,'ml/objects/','objects');if(objectModel)validateObjectMetadata(objectModel.metadata);modalities.objects={dataset:objectDataset,model:objectModel};
 const python=manifest.python?validatePythonProject(manifest.python):defaultPythonProject();
 const evaluations={};for(const kind of ['image','sound','pose']){const prefix=kind==='image'?'ml/':`ml/${kind}/`;const entry=zip.file(`${prefix}evaluation.json`);const evaluation=entry?JSON.parse(await entry.async('string')):null;if(evaluation)validateEvaluationDataset(evaluation,kind);evaluations[kind]=evaluation;if(kind!=='image')modalities[kind].evaluation=evaluation;}
 const model=await modelFromZip(zip,'ml/');const projectFile=zip.file('project.sb3');let sb3=null;
 if(projectFile){if(projectFile._data?.uncompressedSize>MAX_SCRATCH_BYTES)throw new Error('The Scratch archive exceeds 100 MB.');const projectBytes=await projectFile.async('uint8array');await validateScratchArchive(projectBytes);sb3=await projectFile.async('base64');}
 return {name:String(manifest.name||'Untitled project').slice(0,100),junior,board,python,dataset,model,sb3,evaluation:evaluations.image,...modalities};
}

import React from 'react';
import Studio from '../audio/MultimodalStudio.jsx';
import {poseModel,defaultPoseClasses,validatePoseDataset,poseFileData} from './model-service.js';
const readSamples=async file=>[await poseFileData(file)];
export default function PoseStudio(props){return <Studio {...props} kind="pose" service={poseModel} makeClasses={defaultPoseClasses} validateDataset={validatePoseDataset} readSamples={readSamples}/>;}

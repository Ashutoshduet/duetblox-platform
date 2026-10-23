import React from 'react';
import Studio from './MultimodalStudio.jsx';
import {soundModel,defaultSoundClasses,validateSoundDataset} from './model-service.js';
import {audioFileSamples,makeSoundFixture} from './waveform.js';
export default function SoundStudio(props){return <Studio {...props} kind="sound" service={soundModel} makeClasses={defaultSoundClasses} validateDataset={validateSoundDataset} readSamples={audioFileSamples} example={makeSoundFixture}/>;}

import test from 'node:test';
import assert from 'node:assert/strict';
import {ImageModelService} from './model-service.js';
import {PoseModelService} from './pose/model-service.js';
import {SoundModelService} from './audio/model-service.js';
import {ObjectModelService} from './objects/model-service.js';

for(const Service of [ImageModelService,PoseModelService,SoundModelService,ObjectModelService]){
  test(`${Service.name}: import owns nested metadata before yielding and rejected input preserves the live model`,async()=>{
    const service=new Service(),old={name:'old'};
    service.model=old;
    let release;
    const waiting=new Promise(resolve=>{release=resolve;});
    service.prepareArtifact=async artifact=>{await waiting;return {metadata:artifact.metadata};};
    service.replaceModel=async candidate=>{service.model=candidate;};
    const artifact={metadata:{labels:['A','B'],modelSettings:{input:{width:224}},duetbloxObjects:{classes:[{id:'a',name:'A'}],trainingImageHashes:['a'.repeat(64)]},duetbloxDecision:{minimumConfidence:.8}}};
    const expected=structuredClone(artifact.metadata);
    const pending=service.importArtifact(artifact,false);
    artifact.metadata.labels.reverse();
    artifact.metadata.modelSettings.input.width=1;
    artifact.metadata.duetbloxObjects.classes[0].name='Changed';
    artifact.metadata.duetbloxObjects.trainingImageHashes.length=0;
    artifact.metadata.duetbloxDecision.minimumConfidence=0;
    release();await pending;
    assert.deepEqual(service.model.metadata,expected);
    assert.equal(service.snapshot().busy,false);
    const accepted=service.model;
    service.prepareArtifact=async()=>{throw new Error('Invalid metadata');};
    await assert.rejects(service.importArtifact(artifact,false),/Invalid metadata/);
    assert.equal(service.model,accepted);
    assert.equal(service.snapshot().busy,false);
  });
}

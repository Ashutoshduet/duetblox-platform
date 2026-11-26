import {makeJuniorProject, makeJuniorBlock, parseJuniorProject} from '../junior/model.js';
import {exampleTextDataset} from '../ml/text/fixtures.js';

export function juniorStarter(character='fox') {
  if(!['fox','zuni'].includes(character))throw new Error('Choose Fox or Zuni for this starter story.');
  const project = makeJuniorProject();
  const zuni=character==='zuni';
  project.title = zuni?'Hello from Zuni':'Hello from Fox';
  const sprite=project.scenes[0].sprites[0];
  if(zuni){sprite.kind='zuni';sprite.name='Zuni';}
  project.scenes[0].sprites[0].scripts[0].blocks = [
    {...makeJuniorBlock('right'), value: 2},
    {...makeJuniorBlock('say'), text: zuni?'Hello! I’m Zuni.':'Hello! नमस्ते!', value: 2},
    ...(zuni?[{...makeJuniorBlock('costume'),choice:'builtin:jump'}]:[]),
    {...makeJuniorBlock('hop'), value: 1},
    ...(zuni?[{...makeJuniorBlock('costume'),choice:'builtin:cheer'}]:[])
  ];
  return parseJuniorProject(project);
}

export function starterFile(kind) {
  if (kind === 'junior') return {name: 'DUETBlox-Hello-Fox.junior.json', data: juniorStarter()};
  if (kind === 'text') return {name: 'DUETBlox-Greetings-text-dataset.json', data: exampleTextDataset()};
  throw new Error('This lesson does not have a starter file.');
}

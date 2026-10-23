import {makeJuniorProject, makeJuniorBlock, parseJuniorProject} from '../junior/model.js';
import {exampleTextDataset} from '../ml/text/fixtures.js';

export function juniorStarter() {
  const project = makeJuniorProject();
  project.title = 'Hello from Fox';
  project.scenes[0].sprites[0].scripts[0].blocks = [
    {...makeJuniorBlock('right'), value: 2},
    {...makeJuniorBlock('say'), text: 'Hello! नमस्ते!', value: 2},
    {...makeJuniorBlock('hop'), value: 1}
  ];
  return parseJuniorProject(project);
}

export function starterFile(kind) {
  if (kind === 'junior') return {name: 'DUETBlox-Hello-Fox.junior.json', data: juniorStarter()};
  if (kind === 'text') return {name: 'DUETBlox-Greetings-text-dataset.json', data: exampleTextDataset()};
  throw new Error('This lesson does not have a starter file.');
}

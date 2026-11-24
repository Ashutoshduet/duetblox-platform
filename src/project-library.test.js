import test from 'node:test';
import assert from 'node:assert/strict';
import {saveLibraryProject, setProjectDeleted} from './project-library.js';
import {pageFromHash} from './workspace-navigation.js';

test('saving updates a stable identity without evicting any of 20 projects', () => {
  const projects = Array.from({length:20}, (_, index) => ({id:String(index), name:`Project ${index}`, blob:`data ${index}`}));
  const next = saveLibraryProject(projects, {id:'7', name:'Renamed story', blob:'changed'});
  assert.equal(next.length, 20);
  assert.equal(next[0].name, 'Renamed story');
  for (const project of projects.filter(item => item.id !== '7')) assert.deepEqual(next.find(item => item.id === project.id), project);
  assert.equal(saveLibraryProject(next, {id:'copy', name:'Renamed story'}).length, 21);
});

test('trash is reversible and never destroys the stored archive', () => {
  const original = [{id:'one', name:'My story', blob:{data:'preserved'}}];
  const trashed = setProjectDeleted(original, 'one', true, 123);
  assert.equal(trashed[0].deletedAt, 123);
  assert.deepEqual(setProjectDeleted(trashed, 'one', false), original);
  assert.equal(original[0].deletedAt, undefined);
});

test('workspace routes accept only known local destinations', () => {
  assert.equal(pageFromHash('#/junior'), 'junior');
  assert.equal(pageFromHash('#/blocks'), 'blocks');
  for (const hash of ['#/unknown', '#/../junior', '#https://example.com', '#/junior?x=y', '']) assert.equal(pageFromHash(hash), null);
});

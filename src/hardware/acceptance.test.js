import test from 'node:test';
import assert from 'node:assert/strict';
import {boardAcceptanceSteps,createBoardAcceptanceReport} from './acceptance.js';
import {boardRegistry} from './boards.js';

test('every implemented profile gets exact-board live and standalone observation steps without changing validation',()=>{
  for(const board of boardRegistry.filter(item=>item.live)) for(const mode of ['live','standalone']) {
    const steps=boardAcceptanceSteps(board.id,mode);
    assert.match(steps[0].instruction,new RegExp(board.voltage+' V'));
    assert.equal(steps.some(item=>item.id==='input'),board.analogPins.length>0);
    assert.equal(steps.some(item=>item.id==='unplug'),mode==='standalone');
    assert.equal(steps.some(item=>item.id==='stop'),mode==='live');
    const report=createBoardAcceptanceReport({boardId:board.id,mode,observations:Object.fromEntries(steps.map(item=>[item.id,'observed-pass']))});
    assert.equal(report.summary.observed,steps.length);assert.equal(report.summary.issues,0);
    assert.equal(report.independentlyVerified,false);assert.equal(report.softwarePhysicalVerified,false);assert.equal(board.physicalVerified,false);
  }
});

test('new and partial observation reports keep untested checks explicit and omit unrecognized properties',()=>{
  const blank=createBoardAcceptanceReport({boardId:'arduino-uno',mode:'live'});
  assert.equal(blank.summary.observed,0);assert.ok(blank.checks.every(item=>item.result==='not-tested'));
  const partial=createBoardAcceptanceReport({boardId:'esp32',mode:'standalone',observations:{upload:'observed-issue',identity:'observed-pass',physicalVerified:true},notes:'Wrong serial port selected.'});
  assert.equal(partial.summary.observed,2);assert.equal(partial.summary.issues,1);assert.equal(partial.independentlyVerified,false);
  assert.equal(partial.physicalVerified,undefined);assert.equal(partial.notes,'Wrong serial port selected.');
});

test('planned boards, fabricated result enums, invalid modes and unbounded notes cannot enter reports',()=>{
  for(const input of [
    {boardId:'quarky',mode:'live'},
    {boardId:'arduino-uno',mode:'simulation'},
    {boardId:'arduino-uno',mode:'live',observations:{identity:true}},
    {boardId:'arduino-uno',mode:'live',observations:[]},
    {boardId:'arduino-uno',mode:'live',notes:'x'.repeat(4001)},
    {boardId:'arduino-uno',mode:'live',createdAt:'bad date'}
  ]) assert.throws(()=>createBoardAcceptanceReport(input));
});

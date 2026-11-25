import test from 'node:test';
import assert from 'node:assert/strict';
import {SPICE_EXAMPLES,defaultSpiceProject,validateSpiceProject,validateNetlist,spiceNumber,normalizeSpiceResult,traceValues,resultCsv} from './model.js';

test('all teaching circuits pass the bounded SPICE grammar',()=>{
  for(const example of SPICE_EXAMPLES){const parsed=validateNetlist(example.netlist);assert.ok(parsed.components>1,example.id);assert.match(parsed.netlist,/^DUETBlox analog circuit/);}
});
test('SPICE engineering suffixes distinguish milli from mega',()=>{
  assert.equal(spiceNumber('1M'),.001);assert.equal(spiceNumber('1meg'),1e6);assert.equal(spiceNumber('2.2u'),.0000022);assert.equal(spiceNumber('1e-6'),.000001);
  for(const value of ['Infinity','NaN','1;quit','{1+2}','1e999'])assert.throws(()=>spiceNumber(value));
});
test('file/control commands and injected expressions never reach the engine',()=>{
  for(const line of ['.control','.include /etc/passwd','.lib model.spice','.shell ls','.save all','.options numdgt=99','+ shell','R1 a 0 {2+2}','V1 a 0 1; quit','R1 a 0 $value','R1 a 0 "1k"']){
    assert.throws(()=>validateNetlist(`Test\n${line}\n.op\n.end`),line);
  }
  assert.throws(()=>validateNetlist('.include bad\nR1 a 0 1k\n.op\n.end'));
});
test('bounded analyses reject excessive work, backwards sweeps and missing models',()=>{
  for(const analysis of ['.tran 1p 10','.dc V1 0 5 0','.dc V1 0 5 -1','.ac dec 10000 1 1g','.ac lin 2 5 1','.tran 1m 20','.tran 1m 1 2'])assert.throws(()=>validateNetlist(`Test\nV1 in 0 1\nR1 in 0 1k\n${analysis}\n.end`));
  assert.throws(()=>validateNetlist('Test\nD1 a 0 missing\n.op\n.end'),/model/);
  assert.throws(()=>validateNetlist('Test\nV1 a 0 1\n.op\n.dc V1 0 1 .1\n.end'),/one analysis/);
  assert.throws(()=>validateNetlist('Test\nV1 a 0 1\n.dc V2 0 1 .1\n.end'),/does not exist/);
  assert.throws(()=>validateNetlist('Test\nR1 a b 1k\n.op\n.end'),/ground/);
  assert.throws(()=>validateNetlist('Test\nR1 a 0 1k\nr1 a 0 2k\n.op\n.end'),/unique/);
});
test('archive validation preserves editable incomplete code but strips unexpected properties',()=>{
  const project=validateSpiceProject({...defaultSpiceProject(),netlist:'unfinished circuit',result:{secret:true}});
  assert.equal(project.netlist,'unfinished circuit');assert.equal(project.result,undefined);assert.throws(()=>validateSpiceProject({...project,version:99}));
});
test('complex results preserve imaginary values, derived traces and full CSV precision',()=>{
  const result=normalizeSpiceResult({dataType:'complex',numPoints:2,data:[{name:'frequency',type:'frequency',values:[{real:10,img:0},{real:100,img:0}]},{name:'v(out)',type:'voltage',values:[{real:3,img:4},{real:0,img:-2}]}]}, {kind:'ac'});
  assert.deepEqual(traceValues(result.signals[0],'magnitude'),[5,2]);assert.equal(traceValues(result.signals[0],'phase')[1],-90);assert.match(resultCsv(result),/v\(out\) imaginary/);assert.match(resultCsv(result),/100,0,-2/);
  assert.throws(()=>normalizeSpiceResult({dataType:'real',numPoints:1,data:[{name:'out',values:[NaN]}]},{kind:'op'}),/non-finite/);
});

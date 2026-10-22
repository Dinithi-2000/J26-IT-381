// Local validation only: no HTTP requests, credentials or MongoDB connection.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readingInput} from '../../../server/src/module02/validation.js';

const directory=mkdtempSync(join(tmpdir(),'cinnasense-weight-test-'));
let arithmetic;
try {
  const executable=join(directory,'weight-test.exe');
  const compile=spawnSync('g++',['-std=c++11','-Wall','-Wextra','-Werror',
    fileURLToPath(new URL('./weight_capture_test.cpp',import.meta.url)),'-o',executable],{encoding:'utf8'});
  assert.equal(compile.status,0,compile.stderr || 'C++ compiler unavailable');
  const run=spawnSync(executable,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  arithmetic=JSON.parse(run.stdout);
} finally {
  assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
  assert(basename(directory).startsWith('cinnasense-weight-test-'));
  rmSync(directory,{recursive:true,force:true});
}
const payload=()=>({sampleId:'TEST-WEIGHT-ONLY',deviceId:'ESP32S3-WEIGHT-01',measurementId:'TEST-FIXTURE-ONLY',
  dataOrigin:'REAL_SENSOR',recordedAt:'2026-01-02T00:00:00Z',sensorStatus:{weight:'online',color:'offline'},
  rawWeightSamples:arithmetic.raw,temperatureC:null,relativeHumidityPercent:null,
  calibration:{protocol:'HX711-112g-reference-check-fixed-factor-v1',version:'1',
    calibratedAt:'2026-01-01T00:01:00Z',tareAt:'2026-01-01T00:00:00Z',tareRaw:100000,
    countsPerGram:arithmetic.factor,referenceMassGrams:112.0,stabilityLimitGrams:0.5}});

test('compiled firmware arithmetic agrees with the real Node validator for ten signed raw counts',()=>{
  const row=readingInput(payload());
  assert.equal(row.weightGrams,arithmetic.weight);
  assert.equal(row.calibration.spreadGrams,arithmetic.spread);
  assert.equal(row.rawWeightSamples.length,10);
  for(const key of ['red','green','blue','temperatureC','relativeHumidityPercent','gasResistanceOhms'])assert.equal(row[key],null);
  assert.equal(row.environment.temperature.source,'unavailable');
});
test('missing calibration time, future capture and fabricated/clamped reported grams are rejected',()=>{
  let body=payload();delete body.calibration.calibratedAt;assert.throws(()=>readingInput(body));
  body=payload();body.recordedAt='2099-01-01T00:00:00Z';assert.throws(()=>readingInput(body));
  body=payload();body.weightGrams=0;assert.throws(()=>readingInput(body));
  body=payload();body.rawWeightSamples=[1,2,3,4];assert.throws(()=>readingInput(body));
});

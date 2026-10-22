import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readingInput} from '../src/module02/validation.js';
import {Sample, SensorReading} from '../src/module02/models.js';
import {createModule02Router} from '../src/module02/routes.js';
import {storedReadingInput} from '../src/module02-risk/routes.js';
import {createRiskRouter} from '../src/module02-risk/routes.js';
import {SyntheticRiskPrediction} from '../src/module02-risk/model.js';
import {calibrateHx711} from '../tools/module02-sensor-import.mjs';

// Fabricated automated-test fixtures ONLY. Never submitted to production Atlas.
function fixture() {
  return {sampleId: 'TEST-CIN001', deviceId: 'TEST-SENSOR', measurementId: 'TEST-MEASUREMENT',
    recordedAt: new Date(Date.now() - 1000).toISOString(), dataOrigin: 'REAL_SENSOR',
    sensorStatus: {weight: 'online', color: 'online'}, rawWeightSamples: [10999, 11000, 11001, 11000, 11000],
    calibration: {protocol: 'HX711-known-mass-v1', version: 'TEST-ONLY', tareAt: '2026-01-01T00:00:00Z',
      calibratedAt: '2026-01-01T00:01:00Z', tareRaw: 1000, countsPerGram: 100, referenceMassGrams: 100, stabilityLimitGrams: 0.5},
    rgbRaw: {red: 500, green: 300, blue: 200, clear: 1000},
    colorSettings: {gain: 4, integrationTimeMs: 50.4, lighting: 'TEST fixture', distanceMm: 20},
    temperatureC: null, relativeHumidityPercent: null};
}

test('real test capture derives calibrated grams and keeps raw/count and display color separate', async () => {
  const row = readingInput(fixture());
  assert.equal(row.weightGrams, 100); assert.equal(row.red, 128); assert.equal(row.green, 77); assert.equal(row.blue, 51);
  assert.equal(row.rgbRaw.red, 500); assert.equal(row.rgbRaw.clear, 1000); assert.equal(row.calibration.spreadGrams, .02);
  for (const key of ['temperatureC', 'relativeHumidityPercent', 'gasResistanceOhms']) assert.equal(row[key], null);
  assert.equal(row.environment.temperature.source, 'unavailable');
  await new SensorReading(row).validate();
});

test('known-mass calibration and tare use actual supplied raw windows, including signed factors', () => {
  const input = {tareSamples: [1000,1000,1000,1000,1000], referenceSamples: [11000,11000,11000,11000,11000],
    referenceMassGrams: 100, tareAt: '2026-01-01T00:00:00Z', calibratedAt: '2026-01-01T00:01:00Z', stabilityLimitGrams: .5, version: 'TEST'};
  assert.equal(calibrateHx711(input).countsPerGram, 100);
  assert.equal(calibrateHx711({...input, referenceSamples: [-9000,-9000,-9000,-9000,-9000]}).countsPerGram, -100);
  assert.throws(() => calibrateHx711({...input, referenceSamples: input.tareSamples}));
  assert.throws(() => calibrateHx711({...input, referenceSamples: [11000,11000,11000,11000,21000]}));
  assert.throws(() => calibrateHx711({...input, referenceSamples: [8388607,8388607,8388607,8388607,8388607]}));
});

test('serial-log CLI defaults to local validation and performs no submission without --submit', () => {
  const tool = fileURLToPath(new URL('../tools/module02-sensor-import.mjs', import.meta.url));
  const outcome = spawnSync(process.execPath, [tool], {input: JSON.stringify(fixture())+'\n', encoding:'utf8', timeout:10000});
  assert.equal(outcome.status,0,outcome.stderr);
  assert(outcome.stdout.includes('DRY RUN: no database writes.'));
  const invalid = spawnSync(process.execPath, [tool], {input: JSON.stringify({...fixture(), temperatureC:99}), encoding:'utf8', timeout:10000});
  assert.equal(invalid.status,1); assert(!invalid.stdout.includes('Actual capture accepted'));
});

test('unstable, invalid, dark/saturated, malformed and fabricated derived sensor values are rejected', () => {
  for (const change of [{rawWeightSamples: [11000,11000,11000,11000,13000]}, {rawWeightSamples: [11000]},
    {weightGrams: 0}, {calibration: {...fixture().calibration, countsPerGram: 0}},
    {rgbRaw: {...fixture().rgbRaw, clear: 0}}, {rgbRaw: {...fixture().rgbRaw, red: 65535}},
    {colorSettings: {...fixture().colorSettings, gain: 8}}, {recordedAt: new Date(Date.now()+10000).toISOString()},
    {extra: true}, {temperatureC: '28'}, {sensorStatus: {weight: 'unknown', color: 'online'}}]) assert.throws(() => readingInput({...fixture(), ...change}));
});

test('offline sensors store null instead of zero and cannot claim raw measurements', async () => {
  const body = fixture(); Object.assign(body, {sensorStatus: {weight: 'offline', color: 'offline'}});
  for (const key of ['rawWeightSamples', 'calibration', 'rgbRaw', 'colorSettings']) delete body[key];
  const row = readingInput(body); assert.equal(row.weightGrams, null); assert.equal(row.red, null);
  await new SensorReading(row).validate();
  assert.throws(() => readingInput({...body, weightGrams: 0}));
});

test('manual or device-sensor environmental values with provenance enable risk inputs', () => {
  const missing = readingInput(fixture());
  assert.throws(() => storedReadingInput({storageStartDate: new Date('2026-01-01')}, missing), e => e.code === 'ENVIRONMENT_REQUIRED');
  const measuredAt = new Date(Date.now()-2000).toISOString();
  const manual = {...fixture(), temperatureC: 28, relativeHumidityPercent: 65,
    environment: {temperature: {source: 'manual', measuredAt, instrument: 'TEST thermometer'}, humidity: {source: 'manual', measuredAt, instrument: 'TEST hygrometer'}}};
  const row = readingInput(manual);
  assert.equal(row.environment.temperature.source, 'manual');
  assert.equal(storedReadingInput({storageStartDate: new Date('2026-01-01')}, row).temperature_c, 28);
  assert.throws(() => readingInput({...manual, environment: {...manual.environment, temperature: {...manual.environment.temperature, source: 'simulated'}}}));
  const sensed = readingInput({...manual, environment: {temperature: {...manual.environment.temperature, source: 'sensor', instrument: 'DHT11'}, humidity: {...manual.environment.humidity, source: 'sensor', instrument: 'DHT11'}}});
  assert.equal(sensed.environment.humidity.source, 'sensor'); assert.equal(sensed.environment.temperature.instrument, 'DHT11');
  assert.throws(() => readingInput({...fixture(), temperatureC: 28}));
  assert.throws(() => readingInput({...manual, environment: {...manual.environment, temperature: {...manual.environment.temperature, measuredAt: '2026-01-01'}}}));
});

test('legacy complete telemetry validation is preserved; nullable environmental values require explicit real-sensor contract', async () => {
  const old = {sampleId: 'TEST-CIN001', deviceId: 'TEST-SENSOR', measurementId: 'TEST-M1', recordedAt: new Date().toISOString(),
    weightGrams: 100, red: 128, green: 77, blue: 51, temperatureC: 28, relativeHumidityPercent: 65, gasResistanceOhms: 100000};
  assert.equal(readingInput(old).temperatureC, 28); await new SensorReading(old).validate();
  assert.throws(() => readingInput({...old, temperatureC: null}));
  await assert.rejects(new SensorReading({...old, temperatureC: null}).validate());
});

test('authenticated existing HTTP endpoint rejects unauthorized, malformed and duplicate real-sensor test submissions', async () => {
  const prior = process.env.MODULE02_DEVICE_KEYS;
  process.env.MODULE02_DEVICE_KEYS = JSON.stringify({'TEST-SENSOR': 'test-device-secret-01234567890123456789012345'});
  const rows = [], Sensor = {async create(values) {if (rows.length) throw Object.assign(new Error('duplicate'), {code: 11000}); rows.push(values); return values;}};
  const app = express(); app.use(express.json()); app.use('/api', createModule02Router({SensorReading: Sensor,
    Sample: {findOne: async () => ({storageStartDate: new Date('2026-01-01')})}, databaseReady: () => true}));
  const server = createServer(app); await new Promise(r => server.listen(0,'127.0.0.1',r));
  const url = `http://127.0.0.1:${server.address().port}/api/module-02/readings`;
  const submit = (body, auth = true) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json',
    'X-Device-Id': 'TEST-SENSOR', ...(auth ? {'X-Device-Key': 'test-device-secret-01234567890123456789012345'} : {})}, body: JSON.stringify(body)});
  try {
    assert.equal((await submit(fixture(), false)).status, 401);
    assert.equal((await submit({...fixture(), deviceId: 'OTHER'})).status, 403);
    assert.equal((await submit({...fixture(), rgbRaw: {}})).status, 400);
    assert.equal((await submit(fixture())).status, 201);
    assert.equal((await submit(fixture())).status, 409); assert.equal(rows.length, 1);
  } finally {server.closeAllConnections(); await new Promise(r=>server.close(r)); if(prior===undefined) delete process.env.MODULE02_DEVICE_KEYS; else process.env.MODULE02_DEVICE_KEYS=prior;}
});

const uri = process.env.MODULE02_TEST_MONGODB_URI;
test('isolated MongoDB preserves nulls, raw counts, calibration, manual provenance and unique measurement IDs', {skip: !uri}, async () => {
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'mongodb:'); assert(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname));
  assert(/^\/[a-zA-Z0-9_]*module02_test$/.test(parsed.pathname)); assert(!parsed.search);
  const sampleId = `TEST-SENSOR-${randomUUID()}`;
  await mongoose.connect(uri, {serverSelectionTimeoutMS: 3000});
  try {
    await Promise.all([Sample.init(), SensorReading.init()]);
    await Sample.create({sampleId, batchId: 'TEST-ONLY', grade: 'TEST fixture', storage: 'Isolated test', storageStartDate: new Date('2026-01-01'), initialWeightGrams: 100});
    const input = readingInput({...fixture(), sampleId, measurementId: sampleId});
    const row = await SensorReading.create(input), found = await SensorReading.findById(row._id).lean();
    assert.equal(found.temperatureC, null); assert.equal(found.relativeHumidityPercent, null); assert.equal(found.gasResistanceOhms, null);
    assert.equal(found.rgbRaw.clear, 1000); assert.equal(found.weightGrams, 100); assert.equal(found.calibration.countsPerGram, 100);
    assert.equal(found.dataOrigin, 'REAL_SENSOR'); assert.equal(found.environment.humidity.source, 'unavailable');
    await assert.rejects(SensorReading.create(input), e=>e.code===11000);
    assert.equal(await SensorReading.countDocuments({sampleId}), 1);
  } finally {await Promise.all([Sample,SensorReading].map(Model=>Model.deleteMany({sampleId}))); await mongoose.disconnect();}
});

test('isolated real-ML HTTP workflow blocks missing environment and persists manual-input provenance with retry-safe risk history', {skip: !uri || process.env.MODULE02_E2E !== '1'}, async () => {
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'mongodb:'); assert(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname));
  assert(/^\/[a-zA-Z0-9_]*module02_test$/.test(parsed.pathname)); assert(!parsed.search);
  const sampleId = `TEST-E2E-${randomUUID()}`, token = 'test-only-operator-012345678901234567890123456789';
  const priorOperator = process.env.MODULE02_OPERATOR_TOKEN, priorDevices = process.env.MODULE02_DEVICE_KEYS;
  process.env.MODULE02_OPERATOR_TOKEN = token;
  process.env.MODULE02_DEVICE_KEYS = JSON.stringify({'TEST-SENSOR': 'test-device-secret-01234567890123456789012345'});
  let server;
  await mongoose.connect(uri, {serverSelectionTimeoutMS: 3000});
  try {
    await Promise.all([Sample,SensorReading,SyntheticRiskPrediction].map(Model=>Model.init()));
    const app = express(); app.use(express.json());
    app.use('/api', createModule02Router({databaseReady: ()=>true}));
    app.use('/api/module-02', createRiskRouter({databaseReady: ()=>true}));
    server = createServer(app); await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (path, body, device=false) => {
      const response = await fetch(base+path, {method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json',
        ...(device ? {'X-Device-Id':'TEST-SENSOR','X-Device-Key':'test-device-secret-01234567890123456789012345'} : {Authorization:`Bearer ${token}`})},
        ...(body ? {body:JSON.stringify(body)} : {})});
      return {status:response.status, body:await response.json()};
    };
    assert.equal((await call('/samples', {sampleId,batchId:'TEST-ONLY',grade:'Test fixture',storage:'Isolated local test',storageStartDate:'2026-01-01',initialWeightGrams:100})).status,201);
    const partial = await call('/module-02/readings',{...fixture(),sampleId,measurementId:'TEST-PARTIAL'},true);
    assert.equal(partial.status,201); assert.equal(partial.body.temperatureC,null);
    const blocked = await call('/module-02/risk-predictions',{sampleId,readingId:partial.body._id});
    assert.equal(blocked.status,400); assert.equal(blocked.body.error.code,'ENVIRONMENT_REQUIRED');
    const measuredAt = new Date(Date.now()-2000).toISOString();
    const complete = await call('/module-02/readings',{...fixture(),sampleId,measurementId:'TEST-MANUAL',temperatureC:28,relativeHumidityPercent:65,
      environment:{temperature:{source:'manual',measuredAt,instrument:'TEST thermometer'},humidity:{source:'manual',measuredAt,instrument:'TEST hygrometer'}}},true);
    assert.equal(complete.status,201);
    const request = {sampleId,readingId:complete.body._id};
    const prediction = await call('/module-02/risk-predictions',request);
    assert.equal(prediction.status,201); assert(['Low','Medium','High'].includes(prediction.body.predictedRisk));
    assert.equal(prediction.body.dataOrigin,'SYNTHETIC_DEMO'); assert.equal(prediction.body.predictionHorizonDays,null);
    assert.equal(prediction.body.inputSources.temperature_c,'manual');
    assert.equal(prediction.body.inputSources.weight_g,'HX711_calibrated_raw_counts');
    assert.equal((await call('/module-02/risk-predictions',request)).status,200);
    assert.equal(await SyntheticRiskPrediction.countDocuments({sampleId}),1);
    const history = await call(`/module-02/samples/${sampleId}/risk-predictions`);
    assert.equal(history.status,200); assert.equal(history.body.pagination.total,1);
    assert.equal(history.body.data[0].inputSources.humidity_percent,'manual');
  } finally {
    if (server) {server.closeAllConnections(); await new Promise(r=>server.close(r));}
    await Promise.all([SyntheticRiskPrediction,SensorReading,Sample].map(Model=>Model.deleteMany({sampleId}))); await mongoose.disconnect();
    if(priorOperator===undefined) delete process.env.MODULE02_OPERATOR_TOKEN; else process.env.MODULE02_OPERATOR_TOKEN=priorOperator;
    if(priorDevices===undefined) delete process.env.MODULE02_DEVICE_KEYS; else process.env.MODULE02_DEVICE_KEYS=priorDevices;
  }
});

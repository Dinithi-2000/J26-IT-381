import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import mongoose from 'mongoose';
import {createApp} from '../src/server.js';
import {Sample, SensorReading, DegradationPrediction} from '../src/module02/models.js';
import {SyntheticRiskPrediction} from '../src/module02-risk/model.js';
import {ImageConditionAnalysis} from '../src/module02-image/model.js';
import {createQualityService} from '../../client/src/services/qualityService.js';

const uri = process.env.MODULE02_TEST_MONGODB_URI;
const enabled = process.env.MODULE02_E2E === '1' && !!uri;

test('frontend API client -> authenticated Node -> real Model 02 -> isolated MongoDB', {skip: !enabled}, async () => {
  // Refuse production, Atlas/SRV, remote hosts, alternate seed hosts and normal DBs.
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'mongodb:');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname));
  assert(/^\/[a-zA-Z0-9_]*module02_test$/.test(parsed.pathname));
  assert(!parsed.search, 'Do not redirect the isolated database with URI options');
  assert((process.env.MODULE02_RISK_SERVICE_TOKEN || '').length >= 32, 'Configure the server risk token before the opt-in live ML test.');
  const envBefore = {...process.env};
  const operator = randomBytes(32).toString('hex');
  const deviceKey = randomBytes(32).toString('hex');
  process.env.MONGODB_URI = uri;
  process.env.MODULE02_OPERATOR_TOKEN = operator;
  process.env.MODULE02_DEVICE_KEYS = JSON.stringify({'E2E-TEST-DEVICE': deviceKey});
  const sampleId = `E2E-TEST-${randomUUID()}`;
  const imageDirectory = await mkdtemp(join(tmpdir(), 'cinnasense-module02-e2e-'));
  process.env.MODULE02_IMAGE_UPLOAD_DIR = imageDirectory;
  let server;
  await mongoose.connect(uri, {serverSelectionTimeoutMS: 5000});
  try {
    await Promise.all([Sample, SensorReading, DegradationPrediction, SyntheticRiskPrediction].map(Model => Model.init()));
    server = createServer(createApp());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const statuses = [];
    const frontend = createQualityService({baseUrl, fetcher: async (url, options) => {
      if (url.includes('risk-predictions')) assert.equal(options.headers.Authorization, `Bearer ${operator}`);
      const response = await fetch(url, options);
      statuses.push({path: new URL(url).pathname, method: options.method, status: response.status});
      return response;
    }});
    const now = Date.now();
    // Explicitly fabricated TEST fixtures. They can only be written to the guarded local test DB.
    const sample = await frontend.createSample({id: sampleId, batchId: 'E2E-ISOLATED-TEST',
      grade: 'Test fixture only', storage: 'Isolated automated test; no physical cinnamon sample',
      storageStartDate: new Date(now - 5 * 86400_000).toISOString(), initialWeight: 100}, operator);
    assert.equal(await Sample.countDocuments({sampleId}), 1);
    const payload = {sampleId, deviceId: 'E2E-TEST-DEVICE', measurementId: randomUUID(),
      recordedAt: new Date(now - 1000).toISOString(), weightGrams: 98.2,
      temperatureC: 30.5, relativeHumidityPercent: 76, red: 145, green: 90, blue: 50, gasResistanceOhms: 120000};
    const ingestion = await fetch(`${baseUrl}/module-02/readings`, {method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Device-Id': payload.deviceId, 'X-Device-Key': deviceKey}, body: JSON.stringify(payload)});
    assert.equal(ingestion.status, 201);
    const reading = await ingestion.json();
    assert.equal(await SensorReading.countDocuments({sampleId}), 1);
    const samples = await frontend.getSamples();
    assert(samples.some(item => item.id === sampleId));
    const detail = await frontend.getSampleData(sample);
    assert.equal(detail.records[0]._id, reading._id);
    const latest = await frontend.getLatestReading(sampleId);
    assert.equal(latest.data._id, reading._id);
    const prediction = await frontend.createRiskPrediction(sampleId, reading._id, operator);
    assert(['Low', 'Medium', 'High'].includes(prediction.predictedRisk));
    assert.equal(prediction.riskCategory, {Low: 'low', Medium: 'moderate', High: 'high'}[prediction.predictedRisk]);
    assert.equal(prediction.dataOrigin, 'SYNTHETIC_DEMO');
    assert.equal(prediction.validatedForRealWorldUse, false);
    assert.equal(prediction.predictionHorizonDays, null);
    assert.equal(prediction.predictionHorizonVerified, false);
    assert.equal(prediction.sensorReadingId, reading._id);
    assert.equal(prediction.inputSnapshot.storage_day, 4); // reading is one second before five full days
    const saved = await SyntheticRiskPrediction.findOne({sampleId});
    assert.equal(saved._id.toString(), prediction._id);
    assert.deepEqual(saved.inputSnapshot.toObject(), prediction.inputSnapshot);
    const retries = await Promise.all(Array.from({length: 5}, () => frontend.createRiskPrediction(sampleId, reading._id, operator)));
    assert(retries.every(item => item._id === prediction._id));
    assert(retries.every(item => item.createdAt === prediction.createdAt && item.updatedAt === prediction.updatedAt));
    assert.equal(await SyntheticRiskPrediction.countDocuments({sampleId}), 1);
    // Real trained image inference and persisted image history, isolated from Atlas.
    const photograph = await readFile(process.env.MODULE02_E2E_IMAGE_PATH || 'C:/Users/USER/Downloads/OneDrive_1_10-20-2026/Good_quality/CIN001_01.jpg');
    const upload = await fetch(`${baseUrl}/module-02/image-classification/images?sampleId=${sampleId}`, {
      method:'POST', headers:{Authorization:`Bearer ${operator}`, 'Content-Type':'image/jpeg'}, body:photograph,
    });
    assert.equal(upload.status,201);
    const classification = await upload.json();
    assert.equal(classification.analysisStatus,'completed');
    assert.equal(classification.predictedCondition,'good_quality');
    assert(Math.abs(classification.modelScore - 0.8355658054351807) < 0.000001);
    assert.equal(await ImageConditionAnalysis.countDocuments({sampleId}),1);
    const imageHistory = await (await fetch(`${baseUrl}/module-02/image-classification/history?sampleId=${sampleId}`)).json();
    assert.equal(imageHistory.data[0]._id,classification._id);
    const storedPhoto = await fetch(`http://127.0.0.1:${server.address().port}${classification.imageUrl}`);
    assert.equal(storedPhoto.status,200);
    assert(Buffer.from(await storedPhoto.arrayBuffer()).equals(photograph));
    const history = await frontend.getRiskPredictions(sampleId, operator);
    assert.equal(history.pagination.total, 1);
    assert.equal(history.data[0]._id, prediction._id);
    const withoutAuth = await fetch(`${baseUrl}/module-02/samples/${sampleId}/risk-predictions`);
    assert.equal(withoutAuth.status, 401);
    const legacy = await fetch(`${baseUrl}/module-02/predict`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${operator}`},
      body: JSON.stringify({sampleId, horizonDays: 7})});
    assert.equal(legacy.status, 503);
    assert.equal((await legacy.json()).error.code, 'MODEL_UNAVAILABLE');
    assert.equal(await DegradationPrediction.countDocuments({sampleId}), 0);
    for (const path of ['/model-info', '/module-02/image-classification/status']) {
      const response = await fetch(baseUrl + path); assert.equal(response.status, 200);
      assert(['ok', 'ready'].includes((await response.json()).status));
    }
    const riskPosts = statuses.filter(item => item.path.endsWith('/risk-predictions') && item.method === 'POST');
    assert.equal(riskPosts[0].status, 201);
    assert(riskPosts.slice(1).every(item => item.status === 200));
    console.log(JSON.stringify({isolated_e2e: 'passed', sample_creation: true, reading_persistence: true,
      real_model02_prediction: prediction.predictedRisk, prediction_persistence: true,
      frontend_client_reads_and_auth: true, history_records: 1, retries: 5, unique_records: 1,
      model01_and_price_proxies: 'healthy', real_model01_inference_and_image_history:true, production_writes: false}));
  } finally {
    if (server) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
    await Promise.all([ImageConditionAnalysis, SyntheticRiskPrediction, SensorReading, Sample].map(Model => Model.deleteMany({sampleId})));
    await mongoose.disconnect();
    await rm(imageDirectory,{recursive:true,force:true});
    for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key];
    Object.assign(process.env, envBefore);
  }
});

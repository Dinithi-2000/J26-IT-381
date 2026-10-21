import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQualityService} from '../src/services/qualityService.js';
import {createRiskWorkspace, readingCondition, validateStoredRisk} from '../src/services/riskPredictionState.js';

const sample = {id: 'CIN001', storageStartTimestamp: '2026-01-01T00:00:00Z'};
const readingId = '000000000000000000000001';
const row = category => ({_id: '000000000000000000000099', sampleId: sample.id, sensorReadingId: readingId,
  predictedRisk: category, riskCategory: {Low: 'low', Medium: 'moderate', High: 'high'}[category],
  dataOrigin: 'SYNTHETIC_DEMO', validationStatus: 'not_scientifically_validated', validatedForRealWorldUse: false,
  predictionHorizonDays: null, predictionHorizonVerified: false, modelVersion: 'random-forest-demo-6ff77e1d306f',
  warning: 'Synthetic demonstration, not scientifically validated.', predictedAt: new Date().toISOString(),
  inputSnapshot: {storage_day: 5, temperature_c: 30, humidity_percent: 75, weight_g: 98, color_r: 145, color_g: 90, color_b: 50}});
const reading = () => ({_id: readingId, sampleId: sample.id, recordedAt: new Date().toISOString(), temperatureC: 30,
  relativeHumidityPercent: 75, weightGrams: 98, red: 145, green: 90, blue: 50});
const tick = () => new Promise(resolve => setImmediate(resolve));
const history = data => ({data, pagination: {page: 1, limit: 12, pages: data.length ? 1 : 0, total: data.length}});
function fixture(changes = {}) {
  const calls = [], stored = [];
  const service = {getLatestReading: async id => {calls.push(['reading', id]); return {data: reading(), deviceStatus: {offlineAfterSeconds: 300}};},
    getRiskPredictions: async (id, token, page) => {calls.push(['history', id, token, page]); return history(stored);},
    createRiskPrediction: async (id, selectedReading, token) => {calls.push(['predict', id, selectedReading, token]); if (!stored.length) stored.push(row('Medium')); return stored[0];}, ...changes};
  const workspace = createRiskWorkspace(service);
  return {workspace, calls, stored};
}

test('API client uses Node bearer authentication and only sample/reading identifiers', async () => {
  const calls = [];
  const service = createQualityService({fetcher: async (url, options) => {
    calls.push({url, options}); return Response.json(options.method === 'POST' ? row('Medium') : history([]));
  }});
  await service.createRiskPrediction(sample.id, readingId, 'operator-only');
  await service.getRiskPredictions(sample.id, 'operator-only', 2);
  assert.equal(calls[0].url, '/api/module-02/risk-predictions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer operator-only');
  assert.deepEqual(JSON.parse(calls[0].options.body), {sampleId: sample.id, readingId});
  assert.equal(calls[1].url, '/api/module-02/samples/CIN001/risk-predictions?page=2&limit=12');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer operator-only');
  assert(calls.every(call => !Object.hasOwn(call.options.headers, 'X-Risk-Service-Token')));
});

test('API authentication and database errors keep their backend codes', async () => {
  for (const [status, code] of [[401, 'UNAUTHORIZED'], [503, 'DATABASE_UNAVAILABLE']]) {
    const service = createQualityService({fetcher: async () => Response.json({error: {code, message: 'Request could not be completed.'}}, {status})});
    await assert.rejects(service.getRiskPredictions(sample.id, 'wrong'), error => error.code === code);
  }
});

test('page load, token changes and history refresh never trigger a prediction', async () => {
  const {workspace, calls} = fixture(); workspace.selectSample(sample); await tick();
  workspace.setToken('private-operator-token'); await workspace.loadHistory();
  assert.equal(calls.filter(call => call[0] === 'predict').length, 0);
  assert.equal(workspace.getSnapshot().historyStatus, 'ready');
  assert(!JSON.stringify(workspace.getSnapshot()).includes('private-operator-token'));
  workspace.dispose();
});

test('Low, Medium, High and legacy category mappings are accepted; false provenance is rejected', () => {
  for (const category of ['Low', 'Medium', 'High']) assert.equal(validateStoredRisk(row(category), sample.id).predictedRisk, category);
  for (const change of [{riskCategory: 'medium'}, {dataOrigin: 'REAL'}, {predictedRisk: 'moderate'},
    {validatedForRealWorldUse: true}, {predictionHorizonDays: 7}, {predictionHorizonVerified: true}]) {
    assert.throws(() => validateStoredRisk({...row('Medium'), ...change}, sample.id));
  }
});

test('explicit prediction uses an existing reading and deduplicates retry/history responses', async () => {
  const {workspace, calls} = fixture({getRiskPredictions: async () => history([row('Medium'), row('Medium')])});
  workspace.selectSample(sample); workspace.setToken('operator'); await tick();
  await workspace.predict(); await workspace.predict();
  assert.equal(workspace.getSnapshot().history.length, 1);
  assert.equal(workspace.getSnapshot().result.sensorReadingId, readingId);
  assert.equal(calls.filter(call => call[0] === 'predict').length, 2);
  assert.deepEqual(calls.find(call => call[0] === 'predict'), ['predict', sample.id, readingId, 'operator']);
  workspace.dispose();
});

test('missing readings and demo mode cannot request predictions', async () => {
  const {workspace, calls} = fixture({getLatestReading: async () => ({data: null})});
  workspace.selectSample(sample); workspace.setToken('operator'); await tick(); await workspace.predict();
  assert.match(workspace.getSnapshot().error, /stored sensor reading/);
  workspace.selectSample(sample, true); await workspace.predict();
  assert.equal(workspace.getSnapshot().reading, null);
  assert.equal(calls.filter(call => call[0] === 'predict').length, 0); workspace.dispose();
});

test('authentication, database, stale and ML failures remain visible with no fabricated result', async () => {
  for (const code of ['UNAUTHORIZED', 'DATABASE_UNAVAILABLE', 'STALE_READING', 'RISK_SERVICE_UNAVAILABLE', 'RISK_SERVICE_TIMEOUT', 'RISK_SERVICE_UNCONFIGURED']) {
    const {workspace} = fixture({createRiskPrediction: async () => {throw Object.assign(new Error('request failed'), {code});}});
    workspace.selectSample(sample); workspace.setToken('operator'); await tick(); await workspace.predict();
    assert.equal(workspace.getSnapshot().predictionStatus, 'error');
    assert(workspace.getSnapshot().error.length > 20); assert.equal(workspace.getSnapshot().result, null); workspace.dispose();
  }
});

test('history is authenticated, paginated and failures do not erase a confirmed POST result', async () => {
  const {workspace} = fixture({getRiskPredictions: async () => {throw Object.assign(new Error('database down'), {code: 'DATABASE_UNAVAILABLE'});}});
  workspace.selectSample(sample); workspace.setToken('operator'); await tick(); await workspace.predict();
  assert.equal(workspace.getSnapshot().result.predictedRisk, 'Medium');
  assert.equal(workspace.getSnapshot().historyStatus, 'error');
  assert.match(workspace.getSnapshot().historyError, /database is unavailable/); workspace.dispose();
});

test('in-flight prediction exposes loading, suppresses double clicks and ignores previous-sample responses', async () => {
  let resolve, requestCount = 0;
  const {workspace} = fixture({createRiskPrediction: () => {requestCount++; return new Promise(done => {resolve = done;});}});
  workspace.selectSample(sample); workspace.setToken('operator'); await tick();
  const request = workspace.predict(); assert.equal(workspace.getSnapshot().predictionStatus, 'loading');
  await workspace.predict(); // ignored while busy
  workspace.selectSample({id: 'OTHER'}); resolve(row('Medium')); await request; await tick();
  assert.equal(workspace.getSnapshot().sampleId, 'OTHER'); assert.equal(workspace.getSnapshot().result, null);
  assert.equal(requestCount, 1);
  workspace.dispose();
});

test('future, stale and invalid reading states are distinct without inventing sensor values', () => {
  const now = Date.now();
  assert.equal(readingCondition(null).invalid, true);
  assert.equal(readingCondition({...reading(), recordedAt: new Date(now + 1000).toISOString()}, null, now).invalid, true);
  assert.equal(readingCondition({...reading(), recordedAt: new Date(now - 301000).toISOString()}, null, now).stale, true);
  assert.equal(readingCondition({...reading(), weightGrams: 0}).invalid, true);
  assert.equal(readingCondition({...reading(), temperatureC: '30'}).invalid, true);
});

test('switching samples or revoking credentials cancels late authenticated history', async () => {
  let resolve;
  const {workspace} = fixture({getRiskPredictions: () => new Promise(done => {resolve = done;})});
  workspace.selectSample(sample); await tick(); workspace.setToken('operator');
  const pending = workspace.loadHistory(); workspace.setToken(''); resolve(history([row('High')])); await pending;
  assert.equal(workspace.getSnapshot().history.length, 0); assert.equal(workspace.getSnapshot().hasToken, false); workspace.dispose();
});


test('nullable temperature and humidity cannot trigger a Model 02 prediction request', async () => {
  const {workspace, calls} = fixture({getLatestReading: async () => ({data: {...reading(), temperatureC: null, relativeHumidityPercent: null}, deviceStatus: {}})});
  workspace.selectSample(sample); await tick(); workspace.setToken('test-operator'); await workspace.predict();
  assert.equal(calls.filter(call => call[0] === 'predict').length, 0);
  assert.equal(workspace.getSnapshot().error, 'Temperature and humidity inputs required for risk prediction.');
  workspace.dispose();
});


test('stored illustrative history permits a presentation request without representing it as recent physical telemetry', () => {
  const capture = {...reading(), recordedAt: '2026-10-01T00:00:00Z', dataOrigin: 'DEMO_DATA'};
  const status = readingCondition(capture, {}, Date.parse('2026-10-23T00:00:00Z'));
  assert.equal(status.invalid, false); assert(status.label.includes('Illustrative stored reading'));
  assert(!status.label.includes('Recent'));
  assert.equal(readingCondition({...capture, temperatureC:null}, {}).invalid, true);
  assert.equal(readingCondition({...capture, dataOrigin:'REAL_SENSOR'}, {}, Date.parse('2026-10-23T00:00:00Z')).stale, true);
});

test('dashboard excludes illustrative records and keeps genuine records in backend order', async () => {
  const rows = [{sampleId:'CIN-PP1-003',dataOrigin:'DEMO_DATA'}, {sampleId:'CIN-PP1-001',dataOrigin:'DEMO_DATA'},
    {sampleId:'CIN003',dataOrigin:'REAL_SENSOR'}, {sampleId:'CIN001'}, {sampleId:'CIN-DEMO-001'}];
  const service = createQualityService({fetcher:async()=>Response.json({data:rows,pagination:{pages:1}})});
  assert.deepEqual((await service.getSamples()).map(row=>row.id), ['CIN003','CIN001']);
  assert.equal(rows.length,5, 'Filtering does not mutate stored data');
});

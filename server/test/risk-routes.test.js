import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import mongoose from 'mongoose';
import {createApp} from '../src/server.js';
import {SyntheticRiskPrediction} from '../src/module02-risk/model.js';
import {storedReadingInput} from '../src/module02-risk/routes.js';
import {CATEGORY_MAP, DEMO_TITLE, DEMO_WARNING, HORIZON_NOTE, RiskServiceError} from '../src/module02-risk/client.js';

const operator = 'risk-route-operator-test-01234567890123456789';
const readingId = '000000000000000000000001';
const sampleId = 'CIN001';
const fixedNow = Date.now();
const sample = () => ({sampleId, storageStartDate: new Date(fixedNow - 5.5 * 86400_000), archivedAt: null});
const reading = () => ({_id: readingId, sampleId, recordedAt: new Date(fixedNow - 10_000),
  temperatureC: 30, relativeHumidityPercent: 75, weightGrams: 98, red: 145, green: 90, blue: 50});
const output = category => ({model: 'CinnaSense Model 02', title: DEMO_TITLE,
  model_version: 'random-forest-demo-6ff77e1d306f', predicted_risk: category,
  prediction_horizon_days: null, prediction_horizon_verified: false, horizon_note: HORIZON_NOTE,
  data_origin: 'SYNTHETIC_DEMO', validated_for_real_world_use: false, warning: DEMO_WARNING,
  predicted_at: new Date(fixedNow).toISOString()});

// Repository double: exercises atomic-upsert calls and injected failures without Atlas.
function repository() {
  const rows = [];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return (!value.$gte || row[key] >= value.$gte) && (!value.$lte || row[key] <= value.$lte);
    }
    return String(row[key]) === String(value);
  });
  return {rows, findOne: async key => rows.find(row => matches(row, key)) || null,
    async findOneAndUpdate(key, update, options) {
      assert.equal(options.upsert, true); assert.equal(options.runValidators, true);
      assert.deepEqual(Object.keys(update), ['$setOnInsert']);
      let row = rows.find(row => matches(row, key));
      const updatedExisting = !!row;
      if (!row) {
        const doc = new SyntheticRiskPrediction(update.$setOnInsert);
        await doc.validate();
        // Recheck after async validation to simulate the database's atomic winner.
        row = rows.find(row => matches(row, key));
        if (row) return {value: row, lastErrorObject: {updatedExisting: true}};
        row = {...doc.toObject(), _id: String(rows.length + 100).padStart(24, '0')}; rows.push(row);
      }
      return {value: row, lastErrorObject: {updatedExisting}};
    },
    find(filter) {
      let skip = 0, limit = Infinity;
      return {sort() {return this;}, skip(value) {skip = value; return this;}, limit(value) {limit = value; return this;},
        then(resolve, reject) {return Promise.resolve(rows.filter(row => matches(row, filter)).sort((a, b) => b.predictedAt - a.predictedAt).slice(skip, skip + limit)).then(resolve, reject);}};
    },
    countDocuments: async filter => rows.filter(row => matches(row, filter)).length,
  };
}

async function fixture(t, changes = {}) {
  const env = {...process.env};
  process.env.MODULE02_OPERATOR_TOKEN = operator;
  process.env.MODULE02_RISK_MAX_READING_AGE_SECONDS = '300';
  const state = {sample: sample(), reading: reading(), clock: fixedNow, calls: [], category: 'Medium', ready: true};
  const store = repository();
  const Sample = {findOne: async key => state.sample?.sampleId === key.sampleId ? state.sample : null};
  const SensorReading = {findOne: async key => String(state.reading?._id) === key._id && state.reading.sampleId === key.sampleId ? state.reading : null};
  const predict = async input => {state.calls.push(input); return output(state.category);};
  const app = createApp({module02Risk: {Sample, SensorReading, RiskPrediction: store,
    databaseReady: () => state.ready, predict, now: () => state.clock, ...changes}});
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/module-02`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  });
  const call = async (path = '/risk-predictions', {method = 'POST', body = {sampleId, readingId}, auth = true} = {}) => {
    const response = await fetch(base + path, {method, headers: {...(auth ? {Authorization: `Bearer ${operator}`} : {}),
      'Content-Type': 'application/json'}, body: method === 'GET' ? undefined : JSON.stringify(body)});
    return {status: response.status, body: await response.json()};
  };
  return {state, store, call};
}

test('valid stored readings persist exact inputs and all three explicitly mapped categories', async t => {
  const {state, store, call} = await fixture(t);
  for (const [category, mapped] of Object.entries(CATEGORY_MAP)) {
    state.category = category;
    state.reading._id = String(store.rows.length + 1).padStart(24, '0');
    const result = await call('/risk-predictions', {body: {sampleId, readingId: state.reading._id}});
    assert.equal(result.status, 201); assert.equal(result.body.predictedRisk, category); assert.equal(result.body.riskCategory, mapped);
    assert.deepEqual(result.body.inputSnapshot, {storage_day: 5, temperature_c: 30, humidity_percent: 75, weight_g: 98, color_r: 145, color_g: 90, color_b: 50});
    assert.equal(result.body.sensorReadingId, state.reading._id);
    assert.equal(result.body.predictionHorizonDays, null); assert.equal(result.body.predictionHorizonVerified, false);
    assert.equal(result.body.dataOrigin, 'SYNTHETIC_DEMO'); assert.equal(result.body.validationStatus, 'not_scientifically_validated');
    assert.equal(result.body.warning, DEMO_WARNING); assert.equal(result.body.createdAt, new Date(fixedNow).toISOString());
    assert(!JSON.stringify(result.body).includes(operator));
  }
  assert.equal(store.rows.length, 3);
});

test('same request retries and concurrent submissions persist one immutable result', async t => {
  const {state, store, call} = await fixture(t);
  const responses = await Promise.all(Array.from({length: 8}, () => call()));
  assert(responses.every(row => [200, 201].includes(row.status)));
  assert.equal(store.rows.length, 1);
  const first = responses[0].body;
  const calls = state.calls.length;
  state.clock += 86400_000; // Retry after the reading ages out returns the saved record.
  const retry = await call();
  assert.equal(retry.status, 200); assert.deepEqual(retry.body, first); assert.equal(state.calls.length, calls);
});

test('duplicate-key race returns the winning persisted record', async t => {
  const {store, call} = await fixture(t);
  const saved = store.findOneAndUpdate;
  store.findOneAndUpdate = async (...args) => {await saved(...args); throw Object.assign(new Error('duplicate'), {code: 11000});};
  assert.equal((await call()).status, 200); assert.equal(store.rows.length, 1);
});

test('unknown sample, absent/cross-sample/invalid reading and browser sensor fields are rejected', async t => {
  const {state, call} = await fixture(t);
  for (const body of [{sampleId: 'UNKNOWN', readingId}, {sampleId, readingId: 'bad'}, {sampleId},
    {sampleId, readingId, temperature_c: 28}, {sampleId, readingId, predicted_risk: 'Low'}]) {
    assert([400, 404].includes((await call('/risk-predictions', {body})).status));
  }
  state.reading.sampleId = 'OTHER';
  assert.equal((await call()).body.error.code, 'READING_NOT_FOUND');
  state.reading = null;
  assert.equal((await call()).status, 404);
  assert.equal(state.calls.length, 0);
});

test('stale/future/invalid readings, missing storage start and sensor bounds fail before inference', async t => {
  const {state, call} = await fixture(t);
  const cases = [
    ['reading', {recordedAt: new Date(fixedNow - 301_000)}, 'STALE_READING'],
    ['reading', {recordedAt: new Date(fixedNow + 1)}, 'FUTURE_READING'],
    ['reading', {recordedAt: null}, 'INVALID_READING'],
    ['reading', {recordedAt: '2026-02-30T00:00:00Z'}, 'VALIDATION_ERROR'],
    ['sample', {storageStartDate: null}, 'INVALID_READING'],
    ['sample', {storageStartDate: new Date(fixedNow + 1)}, 'FUTURE_READING'],
    ['sample', {storageStartDate: new Date(fixedNow - 5000)}, 'INVALID_READING'],
    ['reading', {weightGrams: 0}, 'INVALID_READING'],
    ['reading', {temperatureC: '30'}, 'VALIDATION_ERROR'],
    ['reading', {relativeHumidityPercent: 101}, 'VALIDATION_ERROR'],
    ['reading', {red: 256}, 'VALIDATION_ERROR'],
    ['reading', {blue: undefined}, 'VALIDATION_ERROR'],
    ['reading', {weightGrams: NaN}, 'VALIDATION_ERROR'],
  ];
  for (const [target, change, code] of cases) {
    state.sample = sample(); state.reading = reading(); Object.assign(state[target], change);
    const result = await call(); assert.equal(result.body.error.code, code, JSON.stringify(change));
  }
  assert.equal(state.calls.length, 0);
});

test('storage age uses completed UTC 24-hour periods and respects freshness boundaries', () => {
  const start = '2026-10-20T23:30:00+05:30';
  const now = Date.parse('2026-10-21T17:59:59Z');
  process.env.MODULE02_RISK_MAX_READING_AGE_SECONDS = '300';
  assert.equal(storedReadingInput({storageStartDate: start}, {...reading(), recordedAt: new Date(now)}, now).storage_day, 0);
  assert.equal(storedReadingInput({storageStartDate: start}, {...reading(), recordedAt: new Date(now + 1000)}, now + 1000).storage_day, 1);
  assert.doesNotThrow(() => storedReadingInput(sample(), {...reading(), recordedAt: new Date(fixedNow - 300_000)}, fixedNow));
});

test('both routes require operator authentication; archives and DB outages fail safely', async t => {
  const {state, call} = await fixture(t);
  assert.equal((await call('/risk-predictions', {auth: false})).status, 401);
  assert.equal((await call(`/samples/${sampleId}/risk-predictions`, {method: 'GET', auth: false})).status, 401);
  process.env.MODULE02_OPERATOR_TOKEN = '';
  assert.equal((await call()).body.error.code, 'AUTH_UNCONFIGURED'); process.env.MODULE02_OPERATOR_TOKEN = operator;
  state.ready = false; assert.equal((await call()).status, 503); state.ready = true;
  state.sample.archivedAt = new Date(); assert.equal((await call()).status, 409);
  assert.equal((await call(`/samples/${sampleId}/risk-predictions`, {method: 'GET'})).status, 200);
});

test('paginated sample history, date filters, empty results and invalid paging', async t => {
  const {call} = await fixture(t);
  assert.equal((await call(`/samples/${sampleId}/risk-predictions`, {method: 'GET'})).body.pagination.total, 0);
  await call();
  const history = await call(`/samples/${sampleId}/risk-predictions?limit=1`, {method: 'GET'});
  assert.equal(history.body.pagination.total, 1); assert.equal(history.body.data.length, 1);
  assert.equal((await call(`/samples/${sampleId}/risk-predictions?from=2099-01-01`, {method: 'GET'})).body.data.length, 0);
  assert.equal((await call(`/samples/${sampleId}/risk-predictions?limit=201`, {method: 'GET'})).status, 400);
  assert.equal((await call('/samples/UNKNOWN/risk-predictions', {method: 'GET'})).status, 404);
});

test('ML timeout, unavailable and invalid responses never persist a record', async t => {
  const errors = [new RiskServiceError('RISK_SERVICE_TIMEOUT', 'Risk service request timed out.', 504),
    new RiskServiceError('RISK_SERVICE_UNAVAILABLE', 'Risk service cannot be reached.')];
  let mode = 0;
  const {store, call} = await fixture(t, {predict: async () => {
    if (mode < 2) throw errors[mode];
    return {...output('Low'), data_origin: 'REAL'};
  }});
  for (mode = 0; mode < 3; mode++) {
    assert.equal((await call()).status, [504, 503, 502][mode]); assert.equal(store.rows.length, 0);
  }
});

test('database insert failure is sanitized and can be retried without duplicates', async t => {
  const {store, call} = await fixture(t);
  const saved = store.findOneAndUpdate;
  store.findOneAndUpdate = async () => {throw Object.assign(new Error('secret Atlas URI'), {name: 'MongoServerError'});};
  const failed = await call(); assert.equal(failed.status, 503); assert(!JSON.stringify(failed).includes('secret'));
  assert.equal(store.rows.length, 0); store.findOneAndUpdate = saved;
  assert.equal((await call()).status, 201); assert.equal((await call()).status, 200); assert.equal(store.rows.length, 1);
});

test('new MongoDB schema has the separate collection and a compound unique retry key', async () => {
  assert.equal(SyntheticRiskPrediction.collection.name, 'module02_synthetic_risk_predictions');
  assert(SyntheticRiskPrediction.schema.indexes().some(([keys, options]) => keys.sampleId === 1 && keys.sensorReadingId === 1 && options.unique));
  const row = new SyntheticRiskPrediction({sampleId, sensorReadingId: readingId, inputSnapshot: storedReadingInput(sample(), reading(), fixedNow),
    predictedRisk: 'Low', riskCategory: 'low', modelVersion: 'test', predictedAt: new Date(), title: DEMO_TITLE,
    dataOrigin: 'SYNTHETIC_DEMO', validationStatus: 'not_scientifically_validated', validatedForRealWorldUse: false,
    warning: DEMO_WARNING, predictionHorizonDays: 7, predictionHorizonVerified: false, horizonNote: HORIZON_NOTE});
  await assert.rejects(row.validate()); row.predictionHorizonDays = null; await row.validate();
  row.validatedForRealWorldUse = true; await assert.rejects(row.validate());
  assert(mongoose.isValidObjectId(readingId));
});

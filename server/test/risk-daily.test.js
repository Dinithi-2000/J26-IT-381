import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDailyRiskPredictor, sriLankaDay} from '../src/module02-risk/daily.js';

const now = Date.parse('2026-10-22T06:00:00Z');
const sample = {sampleId: 'CIN-REAL-001', storageStartDate: new Date('2026-10-20T00:00:00Z'), dataOrigin: 'REAL_SENSOR'};
const reading = (id, change = {}) => ({_id: id, sampleId: sample.sampleId, dataOrigin: 'REAL_SENSOR',
  recordedAt: new Date(now - 60_000), temperatureC: 29, relativeHumidityPercent: 70, weightGrams: 120,
  red: 150, green: 105, blue: 66, environment: {temperature: {source: 'DHT11'}, humidity: {source: 'DHT11'}}, ...change});
const modelOutput = () => ({model: 'CinnaSense Model 02', title: 'Storage Deterioration Risk (Synthetic Demo)',
  model_version: 'random-forest-demo-0123456789ab', predicted_risk: 'Medium', prediction_horizon_days: null, prediction_horizon_verified: false,
  horizon_note: 'No prediction horizon metadata is present. This output is not a verified seven-day forecast.',
  data_origin: 'SYNTHETIC_DEMO', validated_for_real_world_use: false,
  warning: 'Demonstration risk prediction based on synthetic training data. Not validated for real-world cinnamon safety or quality assessment.',
  predicted_at: new Date(now).toISOString().replace('.000Z', 'Z')});

function fakes() {
  const saved = [], readings = [];
  const RiskPrediction = {
    findOne: async key => saved.find(row => row.sensorReadingId === key.sensorReadingId) || null,
    exists: async filter => saved.some(row => row.sampleId === filter.sampleId && filter.sensorReadingId.$in.includes(row.sensorReadingId)),
    findOneAndUpdate: async (key, update) => { const value = {...update.$setOnInsert}; saved.push(value); return {value, lastErrorObject: {updatedExisting: false}}; },
  };
  const SensorReading = {find: filter => ({distinct: async () => readings.filter(row => row.recordedAt >= filter.recordedAt.$gte && row.recordedAt < filter.recordedAt.$lt).map(row => row._id)})};
  return {saved, readings, RiskPrediction, SensorReading};
}

test('Sri Lanka day boundaries are midnight local time', () => {
  const [from, to] = sriLankaDay(Date.parse('2026-10-22T20:00:00Z')); // 01:30 on 23 Oct in Sri Lanka
  assert.equal(from.toISOString(), '2026-10-22T18:30:00.000Z'); assert.equal(to.toISOString(), '2026-10-23T18:30:00.000Z');
});

test('one automatic prediction per sample per day, only for complete real readings', async () => {
  const db = fakes(), calls = [];
  const quiet = {log() {}, warn() {}};
  const onReading = createDailyRiskPredictor({...db, now: () => now, log: quiet, predict: async input => { calls.push(input); return modelOutput(); }});
  const first = reading('r1'); db.readings.push(first);
  assert.equal((await onReading(sample, first)).predictedRisk, 'Medium');
  const second = reading('r2'); db.readings.push(second);
  assert.equal(await onReading(sample, second), null); // already predicted today
  assert.equal(await onReading(sample, reading('r3', {temperatureC: null})), null); // missing input
  assert.equal(await onReading(sample, reading('r4', {dataOrigin: 'DEMO_DATA'})), null); // not a real reading
  assert.equal(calls.length, 1); assert.equal(db.saved.length, 1); assert.equal(calls[0].temperature_c, 29);
});

test('model failures are logged and never thrown back to the reading upload', async () => {
  const db = fakes(), warnings = [];
  const onReading = createDailyRiskPredictor({...db, now: () => now, log: {log() {}, warn: message => warnings.push(message)},
    predict: async () => { throw Object.assign(new Error('down'), {code: 'RISK_SERVICE_UNAVAILABLE'}); }});
  const first = reading('r1'); db.readings.push(first);
  assert.equal(await onReading(sample, first), null);
  assert.match(warnings[0], /RISK_SERVICE_UNAVAILABLE/); assert.equal(db.saved.length, 0);
});

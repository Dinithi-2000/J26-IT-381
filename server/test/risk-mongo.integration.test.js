import {test} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {SyntheticRiskPrediction} from '../src/module02-risk/model.js';
import {DEMO_TITLE, DEMO_WARNING, HORIZON_NOTE} from '../src/module02-risk/client.js';

const uri = process.env.MODULE02_TEST_MONGODB_URI;
test('isolated MongoDB atomically persists one synthetic record under concurrent retries', {skip: !uri}, async () => {
  // Same safeguards as existing integration tests: never Atlas, never a normal DB.
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'mongodb:');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
  assert(/^\/[a-zA-Z0-9_]*module02_test$/.test(parsed.pathname));
  await mongoose.connect(uri, {serverSelectionTimeoutMS: 3000});
  const sampleId = `RISK-TEST-${new mongoose.Types.ObjectId()}`;
  const sensorReadingId = new mongoose.Types.ObjectId();
  const key = {sampleId, sensorReadingId};
  const savedAt = new Date();
  const values = {...key, inputSnapshot: {storage_day: 5, temperature_c: 30, humidity_percent: 75, weight_g: 98, color_r: 145, color_g: 90, color_b: 50},
    predictedRisk: 'Medium', riskCategory: 'moderate', modelVersion: 'random-forest-demo-6ff77e1d306f', predictedAt: savedAt,
    title: DEMO_TITLE, dataOrigin: 'SYNTHETIC_DEMO', validationStatus: 'not_scientifically_validated', validatedForRealWorldUse: false,
    warning: DEMO_WARNING, predictionHorizonDays: null, predictionHorizonVerified: false, horizonNote: HORIZON_NOTE,
    createdAt: savedAt, updatedAt: savedAt};
  try {
    await SyntheticRiskPrediction.init();
    const results = await Promise.allSettled(Array.from({length: 8}, () => SyntheticRiskPrediction.findOneAndUpdate(key,
      {$setOnInsert: values}, {upsert: true, new: true, runValidators: true, includeResultMetadata: true, timestamps: false})));
    assert(results.some(result => result.status === 'fulfilled'));
    for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 11000);
    assert.equal(await SyntheticRiskPrediction.countDocuments(key), 1);
    const stored = await SyntheticRiskPrediction.findOne(key);
    assert.equal(stored.riskCategory, 'moderate'); assert.equal(stored.predictionHorizonDays, null);
    assert.deepEqual(stored.inputSnapshot.toObject(), values.inputSnapshot);
    assert.equal(stored.createdAt.getTime(), savedAt.getTime());
    await assert.rejects(SyntheticRiskPrediction.create(values), error => error.code === 11000);
  } finally {
    await SyntheticRiskPrediction.deleteMany({sampleId});
    await mongoose.disconnect();
  }
});

import {Router} from 'express';
import {Sample as DefaultSample, SensorReading as DefaultReading} from '../module02/models.js';
import {operatorAuth} from '../module02/auth.js';
import {fail, id, number, object, pagination, dateFilter, date as parseDate} from '../module02/validation.js';
import {isDatabaseConnected} from '../config/db.js';
import {CATEGORY_MAP, requestRiskPrediction, validateRiskResponse, RiskServiceError} from './client.js';
import {SyntheticRiskPrediction} from './model.js';

function timestamp(value, name) {
  if (!(value instanceof Date) && typeof value !== 'string') fail(400, 'INVALID_READING', `${name} must be a valid timestamp.`);
  const parsed = value instanceof Date ? value : parseDate(value, name);
  if (!Number.isFinite(parsed.getTime())) fail(400, 'INVALID_READING', `${name} must be a valid timestamp.`);
  return parsed.getTime();
}

export function storedReadingInput(sample, reading, now = Date.now()) {
  if (reading.temperatureC == null || reading.relativeHumidityPercent == null) fail(400, 'ENVIRONMENT_REQUIRED', 'Temperature and humidity inputs required for risk prediction.');
  const start = timestamp(sample.storageStartDate, 'storageStartDate');
  const recorded = timestamp(reading.recordedAt, 'recordedAt');
  if (start > now || recorded > now) fail(400, 'FUTURE_READING', 'Storage start and reading timestamps cannot be in the future.');
  if (recorded < start) fail(400, 'INVALID_READING', 'Reading predates sample storage.');
  const maxAge = Number(process.env.MODULE02_RISK_MAX_READING_AGE_SECONDS || 300);
  if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > 86400) fail(503, 'RISK_SERVICE_UNCONFIGURED', 'Configure a reading age limit between 1 and 86400 seconds.');
  if (now - recorded > maxAge * 1000) fail(409, 'STALE_READING', 'Selected reading is too old for a new risk prediction.');
  const input = {
    storage_day: Math.floor((recorded - start) / 86_400_000),
    temperature_c: reading.temperatureC, humidity_percent: reading.relativeHumidityPercent,
    weight_g: reading.weightGrams, color_r: reading.red, color_g: reading.green, color_b: reading.blue,
  };
  for (const [key, min, max] of [['storage_day', 0, 3650], ['temperature_c', -40, 85],
    ['humidity_percent', 0, 100], ['weight_g', 0, 10000], ['color_r', 0, 255], ['color_g', 0, 255], ['color_b', 0, 255]]) {
    number(input[key], key, min, max);
  }
  if (input.weight_g <= 0) fail(400, 'INVALID_READING', 'Model 02 requires a positive weight in grams.');
  return input;
}

export function createRiskRouter({Sample = DefaultSample, SensorReading = DefaultReading,
  RiskPrediction = SyntheticRiskPrediction, databaseReady = isDatabaseConnected,
  predict = requestRiskPrediction, now = Date.now} = {}) {
  const router = Router();
  const ready = (_req, _res, next) => {
    if (!databaseReady()) fail(503, 'DATABASE_UNAVAILABLE', 'Module 02 database is unavailable.');
    next();
  };
  const sampleFor = async sampleId => {
    const sample = await Sample.findOne({sampleId: id(sampleId)});
    if (!sample) fail(404, 'SAMPLE_NOT_FOUND', 'Sample does not exist.');
    return sample;
  };

  router.post('/risk-predictions', operatorAuth, ready, async (req, res) => {
    object(req.body, ['sampleId', 'readingId']);
    if (typeof req.body.readingId !== 'string' || !/^[a-f0-9]{24}$/i.test(req.body.readingId)) fail(400, 'VALIDATION_ERROR', 'readingId must be an existing sensor reading ObjectId.');
    const sample = await sampleFor(req.body.sampleId);
    if (sample.archivedAt) fail(409, 'SAMPLE_ARCHIVED', 'Archived samples cannot receive new risk predictions.');
    const reading = await SensorReading.findOne({_id: req.body.readingId, sampleId: sample.sampleId});
    if (!reading || reading.sampleId !== sample.sampleId) fail(404, 'READING_NOT_FOUND', 'Selected reading does not exist for this sample.');
    const key = {sampleId: sample.sampleId, sensorReadingId: reading._id};
    const existing = await RiskPrediction.findOne(key);
    if (existing) return res.json(existing);
    const inputSnapshot = storedReadingInput(sample, reading, now());
    const output = validateRiskResponse(await predict(inputSnapshot), now());
    const savedAt = new Date(now());
    const values = {...key, inputSnapshot, predictedRisk: output.predicted_risk,
      riskCategory: CATEGORY_MAP[output.predicted_risk], modelVersion: output.model_version,
      predictedAt: new Date(output.predicted_at), title: output.title, dataOrigin: output.data_origin,
      validationStatus: 'not_scientifically_validated', validatedForRealWorldUse: false,
      warning: output.warning, predictionHorizonDays: null, predictionHorizonVerified: false,
      horizonNote: output.horizon_note, createdAt: savedAt, updatedAt: savedAt};
    if (reading.dataOrigin === 'REAL_SENSOR') values.inputSources = {
      storage_day: 'derived_completed_utc_days', temperature_c: reading.environment?.temperature?.source || 'unrecorded',
      humidity_percent: reading.environment?.humidity?.source || 'unrecorded', weight_g: 'HX711_calibrated_raw_counts',
      color_r: 'TCS34725_display_normalization', color_g: 'TCS34725_display_normalization', color_b: 'TCS34725_display_normalization',
    };
    // Atomic $setOnInsert + unique index protects persistence across processes.
    // Concurrent requests may infer twice, but only the winning result is stored.
    try {
      const result = await RiskPrediction.findOneAndUpdate(key, {$setOnInsert: values},
        {upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true, timestamps: false});
      // Set server timestamps only on insertion, never rewrite a retry's record.
      return res.status(result.lastErrorObject?.updatedExisting ? 200 : 201).json(result.value);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await RiskPrediction.findOne(key);
      if (!winner) fail(503, 'RISK_PERSISTENCE_FAILED', 'Risk prediction could not be saved. Retry the same request.');
      return res.json(winner);
    }
  });

  router.get('/samples/:sampleId/risk-predictions', operatorAuth, ready, async (req, res) => {
    const sample = await sampleFor(req.params.sampleId);
    const {page, limit} = pagination(req.query);
    const filter = {sampleId: sample.sampleId, ...dateFilter(req.query, 'predictedAt')};
    const [data, total] = await Promise.all([
      RiskPrediction.find(filter).sort({predictedAt: -1, _id: -1}).skip((page - 1) * limit).limit(limit),
      RiskPrediction.countDocuments(filter),
    ]);
    res.json({data, pagination: {page, limit, total, pages: Math.ceil(total / limit)}});
  });

  router.use((error, _req, res, _next) => {
    if (error instanceof RiskServiceError) return res.status(error.status).json({error: {code: error.code, message: error.message}});
    if (error.name?.startsWith('Mongo') || error.name === 'MongooseError') return res.status(503).json({error: {code: 'DATABASE_UNAVAILABLE', message: 'Risk prediction database operation failed.'}});
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({error: {code: 'VALIDATION_ERROR', message: 'Invalid risk prediction record.'}});
    const status = error.status || 500;
    res.status(status).json({error: {code: status === 500 ? 'INTERNAL_SERVER_ERROR' : error.code || 'VALIDATION_ERROR',
      message: status === 500 ? 'An unexpected risk prediction error occurred.' : error.message}});
  });
  return router;
}

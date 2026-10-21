import mongoose from 'mongoose';
const { Schema } = mongoose;
const options = { timestamps: true, bufferCommands: false };
const sampleSchema = new Schema({
  sampleId: { type: String, required: true, unique: true },
  batchId: { type: String, required: true, index: true },
  grade: { type: String, required: true }, storage: { type: String, required: true },
  storageStartDate: { type: Date, required: true }, initialWeightGrams: { type: Number, required: true, min: 0.01, max: 10000 },
  archivedAt: { type: Date, default: null },
}, options);
const readingSchema = new Schema({
  sampleId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true }, measurementId: { type: String, required: true, index: true },
  weightGrams: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR' || this.sensorStatus?.weight === 'online';}, min: 0, max: 10000 },
  red: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR' || this.sensorStatus?.color === 'online';}, min: 0, max: 255 }, green: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR' || this.sensorStatus?.color === 'online';}, min: 0, max: 255 }, blue: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR' || this.sensorStatus?.color === 'online';}, min: 0, max: 255 },
  temperatureC: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR';}, min: -40, max: 85 }, relativeHumidityPercent: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR';}, min: 0, max: 100 },
  gasResistanceOhms: { type: Number, required: function() {return this.dataOrigin !== 'REAL_SENSOR';}, min: 0 }, recordedAt: { type: Date, required: true, index: true },
  dataOrigin: {type: String, enum: ['REAL_SENSOR']},
  sensorStatus: {weight: {type: String, enum: ['online', 'offline']}, color: {type: String, enum: ['online', 'offline']}},
  rawWeightSamples: {type: [Number], default: undefined},
  rgbRaw: {red: Number, green: Number, blue: Number, clear: Number},
  colorSettings: {gain: Number, integrationTimeMs: Number, lighting: String, distanceMm: Number, normalization: String},
  environment: {temperature: {source: {type: String, enum: ['manual', 'unavailable']}, measuredAt: Date, instrument: String},
    humidity: {source: {type: String, enum: ['manual', 'unavailable']}, measuredAt: Date, instrument: String}},
  calibration: { protocol: String, version: String, calibratedAt: Date, tareAt: Date, tareRaw: Number,
    countsPerGram: Number, referenceMassGrams: Number, stabilityLimitGrams: Number, spreadGrams: Number },
}, options);
readingSchema.index({ deviceId: 1, measurementId: 1 }, { unique: true });
readingSchema.index({ sampleId: 1, recordedAt: -1, _id: -1 });
const imageSchema = new Schema({
  sampleId: { type: String, required: true, index: true }, deviceId: { type: String, required: true, index: true },
  recordedAt: { type: Date, required: true, index: true }, filename: { type: String, required: true, unique: true },
  contentType: { type: String, required: true }, sizeBytes: { type: Number, required: true },
  role: { type: String, enum: ['Baseline', 'Current'], default: 'Current' },
}, options);
imageSchema.index({ sampleId: 1, recordedAt: -1, _id: -1 });
const predictionSchema = new Schema({
  sampleId: { type: String, required: true, index: true }, modelVersion: { type: String, required: true },
  predictedAt: { type: Date, required: true, index: true }, horizonDays: { type: Number, required: true, min: 1, max: 365 },
  riskCategory: { type: String, required: true, enum: ['low', 'moderate', 'high'] },
  readingIds: [{ type: Schema.Types.ObjectId, ref: 'Module02SensorReading' }],
  imageIds: [{ type: Schema.Types.ObjectId, ref: 'Module02SampleImage' }],
}, options);
predictionSchema.index({ sampleId: 1, predictedAt: -1, _id: -1 });
export const Sample = mongoose.model('Module02Sample', sampleSchema, 'module02_samples');
export const SensorReading = mongoose.model('Module02SensorReading', readingSchema, 'module02_sensor_readings');
export const SampleImage = mongoose.model('Module02SampleImage', imageSchema, 'module02_sample_images');
export const DegradationPrediction = mongoose.model('Module02DegradationPrediction', predictionSchema, 'module02_degradation_predictions');

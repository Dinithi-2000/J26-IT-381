import mongoose from 'mongoose';
import {CATEGORY_MAP, DEMO_TITLE, DEMO_WARNING, HORIZON_NOTE} from './client.js';

const {Schema} = mongoose;
const inputSchema = new Schema({
  storage_day: {type: Number, required: true, min: 0, max: 3650, validate: Number.isInteger},
  temperature_c: {type: Number, required: true, min: -40, max: 85},
  humidity_percent: {type: Number, required: true, min: 0, max: 100},
  weight_g: {type: Number, required: true, min: Number.MIN_VALUE, max: 10000},
  color_r: {type: Number, required: true, min: 0, max: 255},
  color_g: {type: Number, required: true, min: 0, max: 255},
  color_b: {type: Number, required: true, min: 0, max: 255},
}, {_id: false, strict: 'throw'});

const schema = new Schema({
  sampleId: {type: String, required: true},
  sensorReadingId: {type: Schema.Types.ObjectId, ref: 'Module02SensorReading', required: true},
  inputSnapshot: {type: inputSchema, required: true},
  predictedRisk: {type: String, enum: Object.keys(CATEGORY_MAP), required: true},
  riskCategory: {type: String, enum: Object.values(CATEGORY_MAP), required: true},
  modelVersion: {type: String, required: true},
  predictedAt: {type: Date, required: true},
  title: {type: String, enum: [DEMO_TITLE], required: true},
  dataOrigin: {type: String, enum: ['SYNTHETIC_DEMO'], required: true},
  validationStatus: {type: String, enum: ['not_scientifically_validated'], required: true},
  validatedForRealWorldUse: {type: Boolean, validate: value => value === false, required: true},
  warning: {type: String, enum: [DEMO_WARNING], required: true},
  predictionHorizonDays: {type: Number, default: null, validate: value => value === null},
  predictionHorizonVerified: {type: Boolean, validate: value => value === false, required: true},
  horizonNote: {type: String, enum: [HORIZON_NOTE], required: true},
}, {timestamps: true, bufferCommands: false, strict: 'throw'});

// One immutable stored result per sample/reading, even across concurrent requests.
// Future model re-evaluation must introduce an explicit versioned contract.
schema.index({sampleId: 1, sensorReadingId: 1}, {unique: true});
schema.index({sampleId: 1, predictedAt: -1, _id: -1});
export const SyntheticRiskPrediction = mongoose.model('Module02SyntheticRiskPrediction', schema, 'module02_synthetic_risk_predictions');

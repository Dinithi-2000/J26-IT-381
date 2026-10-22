import {SensorReading as DefaultReading} from '../module02/models.js';
import {requestRiskPrediction} from './client.js';
import {SyntheticRiskPrediction} from './model.js';
import {saveRiskPrediction} from './routes.js';

const DAY_MS = 86_400_000;
const SRI_LANKA_OFFSET_MS = 5.5 * 3_600_000;

// Start and end of the Sri Lanka calendar day containing `time`.
export function sriLankaDay(time) {
  const start = Math.floor((time + SRI_LANKA_OFFSET_MS) / DAY_MS) * DAY_MS - SRI_LANKA_OFFSET_MS;
  return [new Date(start), new Date(start + DAY_MS)];
}

// Called after each accepted device reading. Makes at most one automatic Model 02 prediction
// per sample per Sri Lanka day, from the first real reading that has every model input.
// Failures are logged and never affect the reading upload.
export function createDailyRiskPredictor({SensorReading = DefaultReading, RiskPrediction = SyntheticRiskPrediction,
  predict = requestRiskPrediction, now = Date.now, log = console} = {}) {
  const running = new Set();
  return async function onReading(sample, reading) {
    if (reading.dataOrigin !== 'REAL_SENSOR' || reading.temperatureC == null || reading.relativeHumidityPercent == null
      || ![reading.red, reading.green, reading.blue, reading.weightGrams].every(Number.isFinite)) return null;
    const [from, to] = sriLankaDay(new Date(reading.recordedAt).getTime());
    const key = `${sample.sampleId}:${from.toISOString()}`;
    if (running.has(key)) return null;
    running.add(key);
    try {
      const todaysReadings = await SensorReading.find({sampleId: sample.sampleId, recordedAt: {$gte: from, $lt: to}}).distinct('_id');
      if (await RiskPrediction.exists({sampleId: sample.sampleId, sensorReadingId: {$in: todaysReadings}})) return null;
      const {value} = await saveRiskPrediction({sample, reading, RiskPrediction, predict, now});
      log.log(`[Model 02] Daily risk for ${sample.sampleId}: ${value.predictedRisk}`);
      return value;
    } catch (error) {
      log.warn(`[Model 02] Daily risk prediction skipped for ${sample.sampleId}: ${error.code || error.message}`);
      return null;
    } finally {
      running.delete(key);
    }
  };
}

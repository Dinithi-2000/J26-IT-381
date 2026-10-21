import {date, fail, id, number, object, text} from './validation.js';

const requireValue = (condition, message) => {if (!condition) fail(400, 'INVALID_SENSOR_READING', message);};
const integer = (value, name, min, max) => {
  number(value, name, min, max);
  requireValue(Number.isInteger(value), `${name} must be an integer.`);
  return value;
};
const before = (value, name, capturedAt) => {
  const timestamp = date(value, name);
  requireValue(value.includes('T'), `${name} needs a timestamp and timezone.`);
  requireValue(timestamp <= capturedAt, `${name} cannot be after capture time.`);
  return timestamp;
};

// Separate opt-in contract: legacy complete telemetry retains its existing validation.
export function realSensorInput(body) {
  object(body, ['sampleId', 'deviceId', 'measurementId', 'recordedAt', 'dataOrigin',
    'sensorStatus', 'weightGrams', 'rawWeightSamples', 'calibration', 'rgbRaw', 'colorSettings',
    'temperatureC', 'relativeHumidityPercent', 'environment']);
  requireValue(body.dataOrigin === 'REAL_SENSOR', 'Use the REAL_SENSOR contract.');
  const recordedAt = date(body.recordedAt, 'recordedAt');
  requireValue(body.recordedAt.includes('T'), 'Capture time needs a timestamp and timezone.');
  requireValue(recordedAt <= new Date(), 'Capture time cannot be in the future.');
  object(body.sensorStatus, ['weight', 'color']);
  for (const key of ['weight', 'color']) requireValue(['online', 'offline'].includes(body.sensorStatus[key]), `Declare ${key} sensor online or offline.`);
  const result = {sampleId: id(body.sampleId), deviceId: id(body.deviceId, 'deviceId'),
    measurementId: id(body.measurementId, 'measurementId'), recordedAt, dataOrigin: 'REAL_SENSOR',
    sensorStatus: {...body.sensorStatus}, weightGrams: null, red: null, green: null, blue: null,
    gasResistanceOhms: null, temperatureC: null, relativeHumidityPercent: null, environment: {}};
  if (body.sensorStatus.weight === 'online') {
    object(body.calibration, ['protocol', 'version', 'calibratedAt', 'tareAt', 'tareRaw', 'countsPerGram', 'referenceMassGrams', 'stabilityLimitGrams']);
    const c = body.calibration;
    number(c.countsPerGram, 'countsPerGram', -1e9, 1e9);
    requireValue(Math.abs(c.countsPerGram) >= 0.001, 'Calibrate with a nonzero signed counts-per-gram factor.');
    integer(c.tareRaw, 'tareRaw', -8388608, 8388607);
    number(c.referenceMassGrams, 'referenceMassGrams', 0.01, 10000);
    number(c.stabilityLimitGrams, 'stabilityLimitGrams', 0.01, 2);
    requireValue(Array.isArray(body.rawWeightSamples) && body.rawWeightSamples.length >= 5 && body.rawWeightSamples.length <= 64, 'Supply 5–64 consecutive raw HX711 samples.');
    const raw = body.rawWeightSamples.map(value => integer(value, 'raw HX711 count', -8388607, 8388606));
    const spread = (Math.max(...raw) - Math.min(...raw)) / Math.abs(c.countsPerGram);
    requireValue(spread <= c.stabilityLimitGrams, 'Unstable load-cell reading; wait and capture again.');
    const weight = (raw.reduce((a, b) => a + b, 0) / raw.length - c.tareRaw) / c.countsPerGram;
    number(weight, 'calculated weightGrams', 0, 10000);
    if (body.weightGrams !== undefined) {
      number(body.weightGrams, 'weightGrams', 0, 10000);
      requireValue(Math.abs(body.weightGrams - weight) <= 0.05, 'Weight does not match calibration and raw counts.');
    }
    result.weightGrams = weight;
    result.rawWeightSamples = raw;
    result.calibration = {...c, protocol: text(c.protocol, 'protocol'), version: text(c.version, 'version'),
      calibratedAt: before(c.calibratedAt, 'calibratedAt', recordedAt), tareAt: before(c.tareAt, 'tareAt', recordedAt),
      spreadGrams: spread};
  } else {
    requireValue(body.weightGrams == null && body.rawWeightSamples == null && body.calibration == null, 'Offline load cell cannot supply measurements or calibration.');
  }
  if (body.sensorStatus.color === 'online') {
    object(body.rgbRaw, ['red', 'green', 'blue', 'clear']);
    object(body.colorSettings, ['gain', 'integrationTimeMs', 'lighting', 'distanceMm']);
    const raw = Object.fromEntries(['red', 'green', 'blue', 'clear'].map(key => [key, integer(body.rgbRaw[key], `raw ${key}`, 0, 65535)]));
    requireValue(raw.clear > 0 && Math.max(...Object.values(raw)) < 65535, 'Dark or saturated color capture; adjust lighting/integration and recapture.');
    requireValue([1, 4, 16, 60].includes(body.colorSettings.gain), 'Unsupported TCS34725 gain.');
    number(body.colorSettings.integrationTimeMs, 'integrationTimeMs', 2.4, 614.4);
    const saturation = Math.min(65535, Math.round(body.colorSettings.integrationTimeMs / 2.4) * 1024);
    requireValue(Math.max(...Object.values(raw)) < saturation, 'Color counts are saturated for the integration time.');
    number(body.colorSettings.distanceMm, 'distanceMm', 1, 1000);
    result.rgbRaw = raw;
    result.colorSettings = {...body.colorSettings, lighting: text(body.colorSettings.lighting, 'lighting'),
      normalization: 'clear-ratio-clamped-255-v1'};
    for (const channel of ['red', 'green', 'blue']) result[channel] = Math.round(Math.min(255, raw[channel] / raw.clear * 255));
  } else requireValue(body.rgbRaw == null && body.colorSettings == null, 'Offline RGB sensor cannot supply color readings.');
  if (body.environment !== undefined) object(body.environment, ['temperature', 'humidity']);
  for (const [key, sourceKey, min, max] of [['temperatureC', 'temperature', -40, 85], ['relativeHumidityPercent', 'humidity', 0, 100]]) {
    const metadata = body.environment?.[sourceKey];
    if (body[key] == null) {
      requireValue(metadata == null, 'Missing environmental values cannot have measurement metadata.');
      result.environment[sourceKey] = {source: 'unavailable'};
    } else {
      number(body[key], key, min, max);
      object(metadata, ['source', 'measuredAt', 'instrument']);
      requireValue(metadata.source === 'manual', 'Only actual manually measured environmental values are supported in this two-sensor setup.');
      const measuredAt = before(metadata.measuredAt, `${sourceKey}.measuredAt`, recordedAt);
      requireValue(recordedAt - measuredAt <= 3600000, 'Manual environmental measurement is older than one hour at capture time.');
      result[key] = body[key];
      result.environment[sourceKey] = {source: 'manual', measuredAt, instrument: text(metadata.instrument, 'instrument')};
    }
  }
  return result;
}

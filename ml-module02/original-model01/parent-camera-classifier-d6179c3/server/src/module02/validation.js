export function fail(status, code, message) { throw Object.assign(new Error(message), { status, code }); }
export function text(value, name, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x1f<>]/.test(value)) fail(400, 'VALIDATION_ERROR', `${name} must be nonempty text, at most ${max} characters.`);
  return value.trim();
}
export function id(value, name = 'sampleId') {
  const result = text(value, name, 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(result)) fail(400, 'VALIDATION_ERROR', `${name} must contain 2-64 letters, digits, underscores or hyphens.`);
  return result;
}
export function number(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(400, 'VALIDATION_ERROR', `${name} must be a number between ${min} and ${max}.`);
  return value;
}
export function date(value, name) {
  const iso = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2}))?$/;
  if (typeof value !== 'string' || !iso.test(value) || !Number.isFinite(Date.parse(value))) fail(400, 'VALIDATION_ERROR', `${name} must be an ISO date or timestamp with a timezone.`);
  const calendar = new Date(`${value.slice(0,10)}T00:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== value.slice(0,10)) fail(400, 'VALIDATION_ERROR', `${name} is not a valid calendar date.`);
  return new Date(value);
}
export function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail(400, 'VALIDATION_ERROR', 'Invalid object or unsupported fields.');
}
export function sampleInput(body, partial = false) {
  const fields = ['sampleId','batchId','grade','storage','storageStartDate','initialWeightGrams'];
  object(body, partial ? fields.slice(1) : fields);
  if (!Object.keys(body).length) fail(400, 'VALIDATION_ERROR', 'Provide at least one field.');
  const result = {};
  for (const key of fields) {
    if (partial && !(key in body)) continue;
    result[key] = key === 'sampleId' ? id(body[key]) : key === 'storageStartDate' ? date(body[key], key) : key === 'initialWeightGrams' ? number(body[key], key, 0.01, 10000) : text(body[key], key);
  }
  return result;
}
export function readingInput(body) {
  const fields = ['sampleId','deviceId','measurementId','weightGrams','red','green','blue','temperatureC','relativeHumidityPercent','gasResistanceOhms','recordedAt','calibration'];
  object(body, fields);
  const result = { sampleId: id(body.sampleId), deviceId: id(body.deviceId,'deviceId'), measurementId: id(body.measurementId,'measurementId'), recordedAt: date(body.recordedAt,'recordedAt') };
  if (result.recordedAt > new Date(Date.now() + 300000)) fail(400,'VALIDATION_ERROR','recordedAt cannot be more than five minutes in the future.');
  for (const [key,min,max] of [['weightGrams',0,10000],['red',0,255],['green',0,255],['blue',0,255],['temperatureC',-40,85],['relativeHumidityPercent',0,100],['gasResistanceOhms',0,1e12]]) result[key] = number(body[key],key,min,max);
  if (body.calibration !== undefined) {
    object(body.calibration,['protocol','version','calibratedAt']); result.calibration = {};
    for (const [key,value] of Object.entries(body.calibration)) result.calibration[key] = key === 'calibratedAt' ? date(value,key) : text(value,key);
  }
  return result;
}
export function pagination(query) {
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) fail(400,'VALIDATION_ERROR','Invalid page or limit.');
    return Number(value);
  };
  return { page: integer(query.page,1,100000), limit: integer(query.limit,50,200) };
}
export function dateFilter(query, field = 'recordedAt') {
  const range = {};
  if (query.from !== undefined) range.$gte = date(query.from,'from');
  if (query.to !== undefined) range.$lte = date(query.to,'to');
  if (range.$gte && range.$lte && range.$gte > range.$lte) fail(400,'VALIDATION_ERROR','from must precede to.');
  return Object.keys(range).length ? { [field]: range } : {};
}

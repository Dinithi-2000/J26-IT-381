export const RISK_DISCLAIMER = 'Storage Deterioration Risk (Synthetic Demo). Predictions are based on synthetic training data and are not validated for real-world cinnamon safety or quality assessment.';
export const RISK_LABELS = Object.freeze({Low: 'Low Risk', Medium: 'Medium Risk', High: 'High Risk'});
const mapped = {Low: 'low', Medium: 'moderate', High: 'high'};
const emptyPage = () => ({page: 1, pages: 0, total: 0, limit: 12});
const empty = () => ({sampleId: null, demo: false, hasToken: false, reading: null, deviceStatus: null,
  readingStatus: 'idle', historyStatus: 'locked', predictionStatus: 'idle',
  history: [], pagination: emptyPage(), result: null, error: '', historyError: '', readingError: '', notice: ''});

export function validateStoredRisk(row, sampleId) {
  if (!row || row.sampleId !== sampleId || typeof row._id !== 'string' || !/^[a-f0-9]{24}$/i.test(row._id)
      || typeof row.sensorReadingId !== 'string' || !/^[a-f0-9]{24}$/i.test(row.sensorReadingId)
      || typeof row.predictedRisk !== 'string' || !Object.hasOwn(RISK_LABELS, row.predictedRisk)
      || row.riskCategory !== mapped[row.predictedRisk] || row.dataOrigin !== 'SYNTHETIC_DEMO'
      || row.validatedForRealWorldUse !== false || row.validationStatus !== 'not_scientifically_validated'
      || row.predictionHorizonDays !== null || row.predictionHorizonVerified !== false
      || typeof row.modelVersion !== 'string' || !row.modelVersion || !Number.isFinite(Date.parse(row.predictedAt))
      || typeof row.warning !== 'string' || !row.warning || !row.inputSnapshot) {
    throw new Error('The backend returned an invalid synthetic risk record. No risk result was accepted.');
  }
  return row;
}

export function riskErrorMessage(error) {
  return ({UNAUTHORIZED: 'Operator authentication failed. Check your operator token and try again.',
    AUTH_UNCONFIGURED: 'Operator authentication is not configured on the backend.',
    STALE_READING: 'This reading is too old for a new prediction. Refresh stored readings after the next sensor measurement.',
    FUTURE_READING: 'The reading or storage start is in the future. Correct the recorded timestamps before predicting.',
    READING_NOT_FOUND: 'The selected stored reading is unavailable for this sample. Refresh the reading.',
    SAMPLE_NOT_FOUND: 'This sample is no longer available. Refresh the sample list.',
    SAMPLE_ARCHIVED: 'This sample is archived. Its prediction history remains available.',
    DATABASE_UNAVAILABLE: 'The research database is unavailable. No new result can be confirmed. Retry the same reading after it reconnects.',
    RISK_SERVICE_UNCONFIGURED: 'Model 02 is not configured on the Node backend. Ask the operator to configure its server-only service settings.',
    RISK_SERVICE_UNAVAILABLE: 'Model 02 cannot be reached. Check the risk service and backend configuration, then retry the same reading.',
    RISK_SERVICE_TIMEOUT: 'Model 02 timed out. You can safely retry the same reading; the backend prevents duplicate stored results.',
    RISK_PERSISTENCE_FAILED: 'The result could not be confirmed in the database. Safely retry the same reading.',
    INVALID_RISK_RESPONSE: 'Model 02 returned an invalid response. No new prediction was accepted.',
    DISCONNECTED: 'The Node backend cannot be reached. Check the connection and retry the same reading.'})[error?.code]
    || error?.message || 'Unable to complete the risk request. Try again.';
}

export function readingCondition(reading, deviceStatus, now = Date.now()) {
  if (!reading) return {label: 'No stored sensor reading', invalid: true};
  const timestamp = typeof reading.recordedAt === 'string' ? Date.parse(reading.recordedAt) : NaN;
  if (!/^[a-f0-9]{24}$/i.test(reading._id || '') || !Number.isFinite(timestamp)) return {label: 'Invalid stored reading reference or timestamp', invalid: true};
  if (timestamp > now) return {label: 'Future reading timestamp — prediction unavailable', invalid: true};
  if (reading.temperatureC == null || reading.relativeHumidityPercent == null) return {label: 'Temperature and humidity inputs required for risk prediction.', invalid: true};
  const fields = [['temperatureC', -40, 85], ['relativeHumidityPercent', 0, 100], ['weightGrams', Number.MIN_VALUE, 10000], ['red', 0, 255], ['green', 0, 255], ['blue', 0, 255]];
  if (fields.some(([name, min, max]) => typeof reading[name] !== 'number' || !Number.isFinite(reading[name]) || reading[name] < min || reading[name] > max)) {
    return {label: 'Stored sensor values are incomplete or outside Model 02 input limits', invalid: true};
  }
  const ageLimit = deviceStatus?.offlineAfterSeconds || 300;
  if (reading.dataOrigin === 'DEMO_DATA') return {label: 'Illustrative stored reading - historical simulation using saved demonstration data, not live sensor measurements.', invalid: false};
  return now - timestamp > ageLimit * 1000
    ? {label: 'Stale telemetry — new predictions may be rejected; saved results can be retrieved', stale: true, invalid: false}
    : {label: 'Recent stored telemetry — not a live sensor stream', invalid: false};
}

// A small external store makes request cancellation, sample switches and retries
// testable without changing the shared quality or Model 01 providers.
export function createRiskWorkspace(service) {
  let state = empty(), token = '', sample = null, generation = 0;
  const listeners = new Set(), requests = {};
  const update = change => {state = {...state, ...change}; listeners.forEach(listener => listener());};
  const cancel = () => {generation++; Object.values(requests).forEach(controller => controller.abort());};
  const start = type => {requests[type]?.abort(); return requests[type] = new AbortController();};
  const current = (controller, version) => !controller.signal.aborted && version === generation;

  async function loadReading() {
    if (!sample || state.demo) return;
    const controller = start('reading'), version = generation, sampleId = sample.id;
    update({readingStatus: 'loading', readingError: ''});
    try {
      const body = await service.getLatestReading(sampleId, {signal: controller.signal});
      if (!current(controller, version)) return;
      if (body.data && body.data.sampleId !== sampleId) throw new Error('The backend returned a reading for a different sample.');
      update({reading: body.data || null, deviceStatus: body.deviceStatus, readingStatus: 'ready'});
    } catch (error) {
      if (current(controller, version)) update({reading: null, readingStatus: 'error', readingError: riskErrorMessage(error)});
    }
  }

  async function loadHistory(page = 1) {
    if (!sample || state.demo || !token || state.predictionStatus === 'loading') return;
    const controller = start('history'), version = generation, sampleId = sample.id;
    update({historyStatus: 'loading', historyError: ''});
    try {
      const body = await service.getRiskPredictions(sampleId, token, page, {signal: controller.signal});
      if (!current(controller, version)) return;
      if (!Array.isArray(body.data) || !Number.isInteger(body.pagination?.page) || !Number.isInteger(body.pagination?.total) || !Number.isInteger(body.pagination?.pages)) throw new Error('The backend returned unreadable risk history.');
      const rows = body.data.map(row => validateStoredRisk(row, sampleId));
      update({history: [...new Map(rows.map(row => [row._id, row])).values()], pagination: body.pagination, historyStatus: 'ready'});
    } catch (error) {
      if (current(controller, version)) update({historyStatus: 'error', historyError: riskErrorMessage(error)});
    }
  }

  async function predict() {
    if (state.predictionStatus === 'loading') return;
    if (!sample || state.demo || !token || !state.reading || state.readingStatus !== 'ready') {
      update({error: 'Select a registered sample, load its stored sensor reading, and enter your operator token.'}); return;
    }
    const condition = readingCondition(state.reading, state.deviceStatus);
    if (condition.invalid) {update({error: condition.label}); return;}
    const controller = start('prediction'), version = generation, sampleId = sample.id, readingId = state.reading._id;
    // A history request started before this POST must not overwrite its result.
    requests.history?.abort();
    update({predictionStatus: 'loading', historyStatus: state.historyStatus === 'loading' ? 'idle' : state.historyStatus, error: '', notice: ''});
    try {
      const body = await service.createRiskPrediction(sampleId, readingId, token, {signal: controller.signal});
      if (!current(controller, version)) return;
      const result = validateStoredRisk(body, sampleId);
      if (result.sensorReadingId !== readingId) throw new Error('The backend returned a risk result for a different reading.');
      update({result, predictionStatus: 'ready', notice: 'Stored result received. Retrying this sample and reading returns the same saved result.'});
      await loadHistory(1);
    } catch (error) {
      if (current(controller, version)) update({predictionStatus: 'error', error: riskErrorMessage(error)});
    }
  }

  return {
    subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    getSnapshot: () => state,
    selectSample(next, demo = false) {
      cancel(); sample = next;
      update({...empty(), sampleId: next?.id || null, demo, hasToken: !!token});
      if (next && !demo) {void loadReading(); if (token) void loadHistory();}
    },
    setToken(value) {
      if (value === token) return;
      requests.history?.abort(); requests.prediction?.abort(); token = value;
      update({hasToken: !!token, historyStatus: 'locked', history: [], pagination: emptyPage(), result: null,
        predictionStatus: 'idle', error: '', historyError: '', notice: ''});
    },
    loadReading, loadHistory, predict,
    dispose: cancel,
  };
}

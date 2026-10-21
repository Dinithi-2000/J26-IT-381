export const MODULE02_WEIGHT_DEVICE = 'ESP32S3-WEIGHT-01';
export const TELEMETRY_POLL_MS = 5000;
const DEFAULT_FRESHNESS_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 4500;
const empty = (sampleId = null, now = Date.now()) => ({sampleId, phase: sampleId ? 'checking' : 'idle',
  reading: null, observations: [], deviceStatus: null, error: '', now});

export function hardwareStatus(state, sampleId = state.sampleId, now = state.now ?? Date.now()) {
  const configured = Number(state.deviceStatus?.offlineAfterSeconds);
  const freshnessSeconds = Number.isFinite(configured) && configured > 0 && configured <= 86400
    ? configured : DEFAULT_FRESHNESS_SECONDS;
  const reading = state.sampleId === sampleId ? state.reading : null;
  const matching = reading?.sampleId === sampleId && reading?.dataOrigin === 'REAL_SENSOR'
    && reading?.deviceId === MODULE02_WEIGHT_DEVICE;
  const recorded = Date.parse(reading?.recordedAt), received = Date.parse(reading?.createdAt);
  const validTime = matching && Number.isFinite(recorded) && Number.isFinite(received)
    && recorded <= now && received <= now;
  const fresh = validTime && now - recorded <= freshnessSeconds * 1000 && now - received <= freshnessSeconds * 1000;
  const checking = !!sampleId && (state.sampleId !== sampleId || state.phase === 'checking');
  const connected = !checking && state.phase === 'ready' && fresh;
  const stale = !checking && state.phase === 'ready' && validTime && !fresh;
  const weightAvailable = validTime && reading.sensorStatus?.weight === 'online'
    && Number.isFinite(reading.weightGrams) && reading.weightGrams >= 0 && reading.weightGrams <= 10000;
  const colorAvailable = matching && reading.sensorStatus?.color === 'online'
    && ['red','green','blue'].every(key => Number.isFinite(reading[key]) && reading[key] >= 0 && reading[key] <= 255)
    && ['red','green','blue','clear'].every(key => Number.isFinite(reading.rgbRaw?.[key])) && reading.rgbRaw.clear > 0;
  const esp32 = checking ? 'Checking' : connected ? 'Connected' : stale ? 'Stale' : 'Disconnected';
  return {esp32, hx711: checking ? 'Checking' : connected && weightAvailable ? 'Online' : stale && weightAvailable ? 'Stale' : 'Offline',
    rgb: connected && colorAvailable ? 'Online' : stale && colorAvailable ? 'Stale' : 'Offline',
    connected, freshnessSeconds, weight: weightAvailable ? reading.weightGrams : null,
    measuredAt: matching && Number.isFinite(recorded) ? reading.recordedAt : null,
    receivedAt: matching && Number.isFinite(received) ? reading.createdAt : null,
    message: checking ? 'Checking selected record telemetry…' : state.phase === 'error' ? 'API unavailable — connection cannot be verified.'
      : !sampleId ? 'No record selected. No telemetry.' : stale ? 'Readings stopped arriving within the freshness window.'
        : connected ? 'Recent genuine device telemetry received.' : 'No recent genuine telemetry from the configured device.',
    illustrative: reading?.dataOrigin === 'DEMO_DATA', error: state.error};
}

// One owner in QualityProvider. Consumers never create their own polling timers.
export function createTelemetryMonitor(service, {now = Date.now, timers = globalThis} = {}) {
  let state = empty(null, now()), version = 0, interval, controller, timeout, busy = false;
  const listeners = new Set();
  const publish = changes => {state = {...state, ...changes, now: now()}; listeners.forEach(listener => listener());};
  const stop = () => {
    version++;
    if (interval !== undefined) timers.clearInterval(interval);
    if (timeout !== undefined) timers.clearTimeout(timeout);
    controller?.abort(); interval = timeout = controller = undefined; busy = false;
  };
  async function poll() {
    if (!state.sampleId) return;
    if (busy) {publish({}); return;}
    busy = true;
    const selected = state.sampleId, requestVersion = version, request = new AbortController();
    controller = request;
    const expired = new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(new Error('Telemetry request timed out.')), {once: true}));
    timeout = timers.setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    publish({});
    try {
      const body = await Promise.race([service.getLatestReading(selected, {signal: request.signal, cache: 'no-store'}), expired]);
      if (requestVersion !== version || request.signal.aborted) return;
      if (!body || !Object.hasOwn(body, 'data') || (body.data !== null && (!body.data || body.data.sampleId !== selected
          || typeof body.data._id !== 'string' || !/^[a-f0-9]{24}$/i.test(body.data._id)))) throw new Error('The API returned invalid telemetry for this record.');
      const observations = new Map(state.observations.map(row => [row._id, row]));
      if (body.data) observations.set(body.data._id, body.data);
      publish({phase: 'ready', reading: body.data, deviceStatus: body.deviceStatus, error: '',
        observations: [...observations.values()].sort((a,b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)
          || a._id.localeCompare(b._id)).slice(-200)});
    } catch (error) {
      if (requestVersion === version) publish({phase: 'error', error: error.message || 'Telemetry could not be checked.'});
    } finally {
      if (requestVersion === version) {timers.clearTimeout(timeout); timeout = controller = undefined; busy = false;}
    }
  }
  return {
    subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    getSnapshot: () => state,
    selectSample(sampleId) {
      if (state.sampleId === sampleId && interval !== undefined) return;
      stop(); state = empty(sampleId || null, now()); publish({});
      if (sampleId) {void poll(); interval = timers.setInterval(poll, TELEMETRY_POLL_MS);}
    },
    dispose() {stop(); state = empty(null, now());},
  };
}

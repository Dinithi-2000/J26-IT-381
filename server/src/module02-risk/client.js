export const DEMO_TITLE = 'Storage Deterioration Risk (Synthetic Demo)';
export const DEMO_WARNING = 'Demonstration risk prediction based on synthetic training data. Not validated for real-world cinnamon safety or quality assessment.';
export const HORIZON_NOTE = 'No prediction horizon metadata is present. This output is not a verified seven-day forecast.';
export const CATEGORY_MAP = Object.freeze({Low: 'low', Medium: 'moderate', High: 'high'});

export class RiskServiceError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function validateRiskResponse(body, now = Date.now()) {
  const fields = ['model', 'title', 'model_version', 'predicted_risk', 'prediction_horizon_days',
    'prediction_horizon_verified', 'horizon_note', 'data_origin', 'validated_for_real_world_use', 'warning', 'predicted_at'];
  const timestamp = typeof body?.predicted_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(body.predicted_at)
    ? Date.parse(body.predicted_at) : NaN;
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== fields.length || !fields.every(key => Object.hasOwn(body, key))
      || body.model !== 'CinnaSense Model 02' || body.title !== DEMO_TITLE
      || typeof body.model_version !== 'string' || !/^random-forest-demo-[a-f0-9]{12}$/.test(body.model_version)
      || typeof body.predicted_risk !== 'string' || !Object.hasOwn(CATEGORY_MAP, body.predicted_risk)
      || body.data_origin !== 'SYNTHETIC_DEMO' || body.validated_for_real_world_use !== false
      || body.prediction_horizon_days !== null || body.prediction_horizon_verified !== false
      || body.warning !== DEMO_WARNING || body.horizon_note !== HORIZON_NOTE
      || !Number.isFinite(timestamp) || timestamp > now + 300_000
      || new Date(timestamp).toISOString().slice(0, 10) !== body.predicted_at.slice(0, 10)) {
    throw new RiskServiceError('INVALID_RISK_RESPONSE', 'Risk service returned an invalid synthetic demonstration response.', 502);
  }
  return {...body};
}

export async function requestRiskPrediction(input, {fetcher = globalThis.fetch} = {}) {
  const token = process.env.MODULE02_RISK_SERVICE_TOKEN || '';
  let url;
  const timeout = Number(process.env.MODULE02_RISK_TIMEOUT_MS || 10_000);
  try {
    url = new URL(process.env.MODULE02_RISK_SERVICE_URL || 'http://127.0.0.1:8000');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
        || !Number.isInteger(timeout) || timeout < 100 || timeout > 30_000 || token.length < 32) throw new Error();
  } catch {
    throw new RiskServiceError('RISK_SERVICE_UNCONFIGURED', 'Configure the server-only risk service URL, token and bounded timeout.');
  }
  const signal = AbortSignal.timeout(timeout);
  try {
    const response = await fetcher(`${url.href.replace(/\/$/, '')}/predict-risk`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Risk-Service-Token': token},
      body: JSON.stringify(input), signal, redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new RiskServiceError('RISK_SERVICE_UNAVAILABLE', 'Risk service could not complete the request.');
    }
    if (response.headers.get('content-type')?.split(';')[0] !== 'application/json' || !response.body) {
      await response.body?.cancel();
      throw new RiskServiceError('INVALID_RISK_RESPONSE', 'Risk service did not return JSON.', 502);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16_384) {
          await reader.cancel();
          throw new RiskServiceError('INVALID_RISK_RESPONSE', 'Risk service response exceeded the allowed size.', 502);
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new RiskServiceError('INVALID_RISK_RESPONSE', 'Risk service returned unreadable JSON.', 502); }
    return validateRiskResponse(body);
  } catch (error) {
    if (signal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new RiskServiceError('RISK_SERVICE_TIMEOUT', 'Risk service request timed out.', 504);
    }
    if (error instanceof RiskServiceError) throw error;
    throw new RiskServiceError('RISK_SERVICE_UNAVAILABLE', 'Risk service cannot be reached.');
  }
}

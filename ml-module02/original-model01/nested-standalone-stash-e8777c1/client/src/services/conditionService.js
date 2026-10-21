// Model 01 image-condition service (quality-service, FastAPI). Proxied by Vite at /condition-api.
const BASE = import.meta.env.VITE_CONDITION_API || '/condition-api';

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Image service returned HTTP ${response.status}.`);
  }
  return response.json();
}

export const conditionService = {
  imageSrc: url => `${BASE}${url}`,
  health: () => request('/health'),
  metrics: () => request('/model/metrics'),
  list: (sampleId, limit = 20) => request(`/analyses?limit=${limit}${sampleId ? `&sample_id=${encodeURIComponent(sampleId)}` : ''}`),
  capture: sampleId => request(`/esp32/capture?sample_id=${encodeURIComponent(sampleId || 'UNASSIGNED')}`, { method: 'POST' }),
  classify(file, sampleId) {
    const form = new FormData();
    form.append('file', file);
    return request(`/classify?sample_id=${encodeURIComponent(sampleId || 'UNASSIGNED')}`, { method: 'POST', body: form });
  },
};

import { useEffect, useState } from 'react';

// Module 02 / Model 01 image classification through the Express API (/api/quality).
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class ImageAnalysisError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ImageAnalysisError';
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ImageAnalysisError('The API server is not reachable. Start it with npm run dev.', 'API_UNAVAILABLE');
  }
  let body = null;
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok) {
    if (!body?.error && response.status >= 500) {
      throw new ImageAnalysisError('The API server is not reachable. Start it with npm run dev.', 'API_UNAVAILABLE', response.status);
    }
    throw new ImageAnalysisError(body?.error?.message || `Request failed (HTTP ${response.status}).`,
      body?.error?.code || 'REQUEST_FAILED', response.status);
  }
  return body;
}

export function checkImageFile(file) {
  if (!file) return 'Choose a photo first.';
  const name = file.name?.toLowerCase() || '';
  if (/\.(heic|heif)$/.test(name)) return 'HEIC photos are not supported. Export the photo as JPEG and try again.';
  const typeOk = ACCEPTED_TYPES.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/.test(name));
  if (!typeOk) return 'Use a JPEG, PNG or WebP photo.';
  if (file.size > MAX_IMAGE_BYTES) return 'The photo is larger than 15 MB.';
  return null;
}

export const imageAnalysisService = {
  getModelInfo: (options) => request('/api/quality/model-info', options),
  // sampleId must be a registered Module 02 sample; token is the operator token (never stored).
  classify(file, sampleId, token, options = {}) {
    const form = new FormData();
    form.append('sampleId', sampleId);
    form.append('image', file);
    return request('/api/quality/classify', { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` }, ...options });
  },
  listAnalyses({ sampleId, limit = 20 } = {}, options) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (sampleId) query.set('sampleId', sampleId);
    return request(`/api/quality/analyses?${query}`, options);
  },
};

export function useQualityModel(service = imageAnalysisService) {
  const [state, setState] = useState({ status: 'loading', info: null, error: '', code: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, status: 'loading' }));
    service.getModelInfo({ signal: controller.signal })
      .then(info => setState({ status: 'ready', info, error: '', code: '' }))
      .catch(error => {
        if (!controller.signal.aborted) setState({ status: 'unavailable', info: null, error: error.message, code: error.code });
      });
    return () => controller.abort();
  }, [revision, service]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}

export const percent = (value, digits = 1) => value == null ? '—' : `${(value * 100).toFixed(digits)}%`;

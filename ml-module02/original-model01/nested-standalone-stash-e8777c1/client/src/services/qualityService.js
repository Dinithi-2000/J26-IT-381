// Frontend integration boundary only. No request is made without configuration.
// Proposed paths must be agreed with the team before Phase 2 implementation.
export class QualityServiceError extends Error {
  constructor(message, code) { super(message); this.name = 'QualityServiceError'; this.code = code; }
}

export function createQualityService({ baseUrl = '', fetcher = globalThis.fetch } = {}) {
  async function get(path, { signal } = {}) {
    if (!baseUrl) throw new QualityServiceError('The quality data service is not configured.', 'DISCONNECTED');
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, { signal });
    if (!response.ok) throw new QualityServiceError(`Quality service returned HTTP ${response.status}.`, 'REQUEST_FAILED');
    return response.json();
  }
  return {
    async getSamples(options) {
      const body = await get('/samples', options);
      if (!Array.isArray(body)) throw new QualityServiceError('Expected a sample list.', 'INVALID_RESPONSE');
      return body;
    },
    getMeasurements: (id, options) => get(`/samples/${encodeURIComponent(id)}/measurements`, options),
    getImages: (id, options) => get(`/samples/${encodeURIComponent(id)}/images`, options),
    getDeviceStatus: options => get('/devices/status', options),
  };
}

export const qualityService = createQualityService();

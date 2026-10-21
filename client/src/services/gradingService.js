// Frontend integration boundary for Module 03: QuillGrade Mobile Edge AI Cinnamon Grading.
// No network requests succeed without a configured backend endpoint or mobile sync adapter.
export class GradingServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GradingServiceError';
    this.code = code;
  }
}

export function createGradingService({ baseUrl = '', fetcher = globalThis.fetch } = {}) {
  async function request(path, { signal } = {}) {
    if (!baseUrl) {
      throw new GradingServiceError('The mobile grading data service is not configured.', 'DISCONNECTED');
    }
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, { signal });
    if (!response.ok) {
      throw new GradingServiceError(`Grading service returned HTTP ${response.status}.`, 'REQUEST_FAILED');
    }
    return response.json();
  }

  return {
    async getGradingRecords(options = {}) {
      const body = await request('/grading', options);
      if (!Array.isArray(body)) {
        throw new GradingServiceError('Expected a grading records list.', 'INVALID_RESPONSE');
      }
      return body;
    },
    getRecordById: (id, options) => request(`/grading/${encodeURIComponent(id)}`, options),
    getSyncStatus: options => request('/grading/sync-status', options),
  };
}

export const gradingService = createGradingService();

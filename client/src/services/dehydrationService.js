const API_BASE = 'http://localhost:5000/api/dehydration';


// ======================================================
// GET LATEST LIVE TELEMETRY
// ======================================================

export async function getLiveTelemetry(options = {}) {
  const response = await fetch(
    `${API_BASE}/live`,
    {
      signal: options.signal
    }
  );

  if (!response.ok) {
    throw new Error('Live dehydration telemetry unavailable');
  }

  const result = await response.json();

  return result.data;
}


// ======================================================
// GET TELEMETRY HISTORY FOR ONE BATCH
// ======================================================

export async function getBatchTelemetry(batchId, options = {}) {
  const response = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(batchId)}`,
    {
      signal: options.signal
    }
  );

  if (!response.ok) {
    throw new Error('Batch telemetry unavailable');
  }

  const result = await response.json();

  return result.data;
}


// ======================================================
// WORKSPACE SERVICE
//
// This keeps the existing DehydrationProvider architecture
// working while using the new real telemetry API.
// ======================================================

async function getWorkspace(options = {}) {

  const telemetry = await getLiveTelemetry(options);

  let records = [];

  if (telemetry?.batchId) {
    try {
      records = await getBatchTelemetry(
        telemetry.batchId,
        options
      );
    } catch (error) {

      // Do not break the entire dashboard if history
      // cannot be loaded.
      if (error.name === 'AbortError') {
        throw error;
      }

      console.warn(
        'Unable to load dehydration history:',
        error
      );
    }
  }


  return {
    telemetry,
    records,

    // We have not created the sessions/events APIs yet.
    sessions: [],
    events: [],

    // Will become true later when we integrate
    // the RDT service through the backend.
    predictionConnected:
      telemetry?.mlStatus === 'ONLINE'
  };
}


// ======================================================
// EXISTING PROVIDER-COMPATIBLE SERVICE OBJECT
// ======================================================

export const dehydrationService = {
  getWorkspace,
  getLiveTelemetry,
  getBatchTelemetry
};
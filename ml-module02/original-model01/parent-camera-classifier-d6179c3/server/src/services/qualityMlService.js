// Calls the Module 02 image model in the FastAPI ML service.
// The URL is read per call so a value loaded from server/.env is always used.
function mlServiceUrl() {
  return process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
}

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function serviceError(response, body, fallbackCode, fallbackMessage) {
  const detail = typeof body.detail === "string" ? body.detail : null;
  const error = new Error(detail || body.message || fallbackMessage);
  error.code = response.headers.get("x-error-code") || fallbackCode;
  error.status = response.status;
  return error;
}

export async function getQualityModelInfo() {
  let response;
  try {
    response = await fetch(`${mlServiceUrl()}/quality/health`, {
      signal: AbortSignal.timeout(3_000)
    });
  } catch (error) {
    error.code = "ML_SERVICE_UNAVAILABLE";
    error.status = 503;
    error.message = "The ML service is not reachable. Start it with npm run dev:ml.";
    throw error;
  }
  const body = await readBody(response);
  if (!response.ok) {
    throw serviceError(response, body, "QUALITY_MODEL_UNAVAILABLE", "The quality model is unavailable");
  }
  return body;
}

export async function classifyQualityImage({ buffer, mimeType, fileName, sampleId }) {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type: mimeType }), fileName);
  if (sampleId) form.append("sample_id", sampleId);

  let response;
  try {
    response = await fetch(`${mlServiceUrl()}/quality/classify`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    error.code = "ML_SERVICE_UNAVAILABLE";
    error.status = 503;
    error.message = "The ML service is not reachable. Start it with npm run dev:ml.";
    throw error;
  }
  const body = await readBody(response);
  if (!response.ok) {
    throw serviceError(response, body, "CLASSIFICATION_FAILED", "Image classification failed");
  }
  return body;
}

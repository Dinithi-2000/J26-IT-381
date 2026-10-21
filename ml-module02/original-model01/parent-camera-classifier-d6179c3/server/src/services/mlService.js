const mlServiceUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

export async function getModelInfo() {
  let response;
  try {
    response = await fetch(`${mlServiceUrl}/health`, {
      signal: AbortSignal.timeout(3_000)
    });
  } catch (error) {
    error.code = "ML_SERVICE_UNAVAILABLE";
    throw error;
  }
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.message || "ML service is unavailable");
    error.code = response.headers.get("x-error-code") || "ML_SERVICE_UNAVAILABLE";
    throw error;
  }
  return body;
}

export async function requestPrediction(input) {
  let response;
  try {
    response = await fetch(`${mlServiceUrl}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    error.code = "ML_SERVICE_UNAVAILABLE";
    throw error;
  }

  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.detail || "Prediction failed");
    error.code = response.headers.get("x-error-code") || "PREDICTION_FAILED";
    throw error;
  }
  return body;
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);
  const status = error.code === "ML_SERVICE_UNAVAILABLE" ||
    error.code === "MODEL_UNAVAILABLE" ||
    error.code === "DATABASE_UNAVAILABLE" ? 503 : 500;
  response.status(status).json({
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: status === 503
        ? error.message
        : "An unexpected server error occurred."
    }
  });
}

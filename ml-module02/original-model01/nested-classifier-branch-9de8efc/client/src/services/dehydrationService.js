/**
 * Read-only integration boundary. No endpoint or hardware connection is configured.
 * A future adapter implements getWorkspace({ signal }) and returns:
 * { telemetry: { batchId, initialMoisture, targetMoisture, initialWeight,
 *   currentWeight, targetWeight, estimatedMoisture, temperature, humidity,
 *   elapsedTime, remainingDryingTime, heaterState, fanState, systemState,
 *   controlMode, temperatureProtection, maxTemperature, updatedAt, estimatedCompletion },
 *   records: [], events: [], sessions: [], predictionConnected: boolean }
 * Durations use seconds, weights grams, moisture %, and timestamps ISO 8601.
 * null means unconfigured. Controls remain demo-only until a separate hardware
 * command contract is implemented. No synthetic fallback is permitted.
 */
export const dehydrationService = { async getWorkspace() { return null; } };

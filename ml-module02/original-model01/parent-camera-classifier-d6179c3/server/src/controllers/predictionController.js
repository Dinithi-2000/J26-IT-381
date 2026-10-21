import { Prediction } from "../models/Prediction.js";
import { isDatabaseConnected } from "../config/db.js";
import { requestPrediction } from "../services/mlService.js";

function validateInput(body) {
  const { date, district, grade } = body;
  if (!date || !district || !grade) return "date, district, and grade are required";
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) {
    return "date must be a valid ISO date";
  }
  return null;
}

export async function createPrediction(request, response, next) {
  const validationError = validateInput(request.body);
  if (validationError) {
    return response.status(400).json({
      error: { code: "VALIDATION_ERROR", message: validationError }
    });
  }

  if (!isDatabaseConnected()) {
    return response.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "MongoDB is unavailable. Start MongoDB or configure server/.env with a MongoDB Atlas URI."
      }
    });
  }

  try {
    const result = await requestPrediction(request.body);
    const prediction = await Prediction.create({
      date: new Date(`${request.body.date}T00:00:00.000Z`),
      district: request.body.district,
      grade: request.body.grade,
      predictedPrice: result.prediction,
      currency: result.currency,
      unit: result.unit,
      modelVersion: result.modelVersion
    });
    return response.status(201).json(prediction);
  } catch (error) {
    return next(error);
  }
}

export async function listPredictions(_request, response, next) {
  if (!isDatabaseConnected()) {
    return response.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "MongoDB is unavailable. Start MongoDB or configure server/.env with a MongoDB Atlas URI."
      }
    });
  }

  try {
    return response.json(await Prediction.find().sort({ createdAt: -1 }).limit(100));
  } catch (error) {
    return next(error);
  }
}

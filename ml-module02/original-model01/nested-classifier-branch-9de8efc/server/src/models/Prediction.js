import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    district: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true },
    predictedPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "LKR" },
    unit: { type: String, required: true, default: "per_kg" },
    modelVersion: { type: String, required: true }
  },
  { timestamps: true }
);

predictionSchema.index({ createdAt: -1 });
predictionSchema.index({ date: 1, district: 1, grade: 1 });

export const Prediction = mongoose.model("Prediction", predictionSchema);

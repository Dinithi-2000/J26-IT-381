import mongoose from "mongoose";

// Module 02 / Model 01: one classified cinnamon image and the model's output.
const topPredictionSchema = new mongoose.Schema(
  {
    condition: { type: String, required: true },
    label: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 }
  },
  { _id: false }
);

const imageAnalysisSchema = new mongoose.Schema(
  {
    sampleId: { type: String, trim: true, required: true },
    source: { type: String, enum: ["upload", "esp32-cam"], required: true },
    deviceId: { type: String, default: null },
    predictedCondition: { type: String, required: true },
    predictedLabel: { type: String, required: true },
    modelScore: { type: Number, required: true, min: 0, max: 1 },
    topPredictions: { type: [topPredictionSchema], default: [] },
    suspectedMold: { type: Boolean, default: false },
    note: { type: String },
    analysisStatus: { type: String, required: true, default: "Completed" },
    analysedAt: { type: Date, required: true },
    modelVersion: { type: String, required: true },
    image: {
      fileName: { type: String, required: true },
      originalName: { type: String },
      mimeType: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      width: { type: Number },
      height: { type: Number },
      sha256: { type: String, required: true }
    }
  },
  { timestamps: true }
);

imageAnalysisSchema.index({ sampleId: 1, analysedAt: -1 });
imageAnalysisSchema.index({ analysedAt: -1 });

export const ImageAnalysis = mongoose.model("ImageAnalysis", imageAnalysisSchema);

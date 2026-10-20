import mongoose from "mongoose";

const dehydrationTelemetrySchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      index: true
    },

    initialMoisture: {
      type: Number,
      required: true
    },

    targetMoisture: {
      type: Number,
      required: true
    },

    initialWeight: {
      type: Number,
      default: null
    },

    currentWeight: {
      type: Number,
      default: null
    },

    targetWeight: {
      type: Number,
      default: null
    },

    estimatedMoisture: {
      type: Number,
      default: null
    },

    temperature: {
      type: Number,
      default: null
    },

    humidity: {
      type: Number,
      default: null
    },

    // seconds
    elapsedTime: {
      type: Number,
      default: 0
    },

    // seconds
    remainingDryingTime: {
      type: Number,
      default: null
    },

    heaterState: {
      type: String,
      enum: ["ON", "OFF"],
      default: "OFF"
    },

    fanState: {
      type: String,
      enum: ["ON", "OFF"],
      default: "OFF"
    },

    systemState: {
      type: String,
      default: "SETUP"
    },

    mlStatus: {
      type: String,
      enum: ["ONLINE", "OFFLINE", "PENDING"],
      default: "PENDING"
    }
  },
  {
    timestamps: true
  }
);

const DehydrationTelemetry =
  mongoose.models.DehydrationTelemetry ||
  mongoose.model(
    "DehydrationTelemetry",
    dehydrationTelemetrySchema
  );

export default DehydrationTelemetry;
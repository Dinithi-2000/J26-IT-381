import mongoose from "mongoose";

export const FOUR_CLASS_GRADES = Object.freeze(["ALBA", "C4", "C5", "Special"]);
export const SEVEN_CLASS_GRADES = Object.freeze(["ALBA", "C4", "C5", "EXTRA", "H1", "H2", "M4"]);
export const ALL_SUPPORTED_GRADES = Object.freeze([
  "ALBA",
  "C4",
  "C5",
  "Special",
  "EXTRA",
  "H1",
  "H2",
  "M4"
]);

export const MODEL_IMAGE_ONLY_4CLASS = "4-Class Image-Only";
export const MODEL_HYBRID_7CLASS = "7-Class Hybrid";

const gradingSampleSchema = new mongoose.Schema(
  {
    // 1. Immutable mobile sample UUID (idempotency key & unique constraint)
    mobileSampleUuid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "mobileSampleUuid must be a valid UUID v4 format"
      ]
    },

    // 2. Human-readable sample ID (e.g. SMP-89240, QG-2026-001)
    sampleId: {
      type: String,
      required: true,
      trim: true
    },

    // 3. Authenticated owner ID (inspector identifier)
    ownerId: {
      type: String,
      required: true,
      trim: true
    },

    // 4. Optional organization ID (field plant / facility / coop)
    organizationId: {
      type: String,
      trim: true,
      default: null
    },

    // Optional harvest or processing batch code
    batchId: {
      type: String,
      trim: true,
      default: null
    },

    // 5. Predicted Grade
    predictedGrade: {
      type: String,
      required: true,
      enum: ALL_SUPPORTED_GRADES,
      trim: true
    },

    // Optional ground-truth or auditor reviewed grade
    expertGrade: {
      type: String,
      enum: [...ALL_SUPPORTED_GRADES, null],
      default: null
    },

    // 6. Model version and resolved model type
    modelVersion: {
      type: String,
      required: true,
      trim: true
    },
    modelType: {
      type: String,
      required: true,
      enum: [MODEL_IMAGE_ONLY_4CLASS, MODEL_HYBRID_7CLASS]
    },

    // 7. Confidence score: percentage 0.0 - 100.0 (converted from mobile's 0.0 - 1.0)
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // Raw probability (0.0 - 1.0) preserved directly from mobile SQLite if provided
    rawProbability: {
      type: Number,
      default: null,
      min: 0,
      max: 1
    },

    // 8. Nullable diameter (mm) and measurement source
    diameterMm: {
      type: Number,
      default: null,
      min: 0
    },
    diameterSource: {
      type: String,
      enum: ["AI", "Caliper", "Not Available", null],
      default: null
    },
    measurementMethod: {
      type: String,
      default: null
    },

    // 9. Capture timestamp (from mobile device)
    captureTimestamp: {
      type: Date,
      required: true
    },

    // 10. Server receipt timestamp (generated upon receipt by backend)
    serverReceiptTimestamp: {
      type: Date,
      required: true,
      default: Date.now
    },

    // 11. Optional photo references (never invented or fabricated)
    photoReferences: {
      sidePhotoUrl: { type: String, default: null },
      endPhotoUrl: { type: String, default: null },
      sidePhotoStorageKey: { type: String, default: null },
      endPhotoStorageKey: { type: String, default: null }
    },

    // Capture device or client platform metadata
    device: {
      type: String,
      default: null
    },

    // Human review flag
    needsReview: {
      type: Boolean,
      default: false
    },

    // Optimistic locking revision
    syncRevision: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

// Performance & querying indexes
gradingSampleSchema.index({ ownerId: 1, captureTimestamp: -1 });
gradingSampleSchema.index({ captureTimestamp: -1 });
gradingSampleSchema.index({ predictedGrade: 1 });
gradingSampleSchema.index({ modelVersion: 1 });

export const GradingSample = mongoose.model("GradingSample", gradingSampleSchema);

import {
  FOUR_CLASS_GRADES,
  SEVEN_CLASS_GRADES,
  MODEL_IMAGE_ONLY_4CLASS,
  MODEL_HYBRID_7CLASS
} from "../models/GradingSample.js";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GradingValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GradingValidationError";
    this.code = "VALIDATION_ERROR";
    this.details = details;
  }
}

/**
 * Resolves model metadata and supported grades from a model version string.
 */
export function resolveModelMetadata(modelVersion) {
  if (!modelVersion || typeof modelVersion !== "string") {
    throw new GradingValidationError("modelVersion is required and must be a string", {
      field: "modelVersion"
    });
  }

  const normalized = modelVersion.trim().toLowerCase();

  if (
    normalized === "image_only_4class_v1" ||
    normalized === "image_only_4class" ||
    normalized === "4class"
  ) {
    return {
      modelVersion: "image_only_4class_v1",
      modelType: MODEL_IMAGE_ONLY_4CLASS,
      allowedGrades: FOUR_CLASS_GRADES,
      isDiameterRequired: false
    };
  }

  if (
    normalized === "hybrid_v2" ||
    normalized === "v1.1.0-legacy" ||
    normalized === "hybrid_7class" ||
    normalized === "7class"
  ) {
    return {
      modelVersion: modelVersion.trim(),
      modelType: MODEL_HYBRID_7CLASS,
      allowedGrades: SEVEN_CLASS_GRADES,
      isDiameterRequired: true
    };
  }

  throw new GradingValidationError(
    `Unsupported modelVersion: "${modelVersion}". Supported versions are "image_only_4class_v1" and "hybrid_v2".`,
    { field: "modelVersion", value: modelVersion }
  );
}

/**
 * Normalizes provenance label between mobile SQLite values and dashboard contract.
 */
export function normalizeDiameterSource(source) {
  if (!source) return null;
  const s = String(source).trim().toLowerCase();
  if (s === "ai" || s === "ai_estimated" || s === "experimental_image_regression") {
    return "AI";
  }
  if (s === "caliper" || s === "caliper_measured" || s === "digital_caliper_manual") {
    return "Caliper";
  }
  if (s === "not available" || s === "not_available" || s === "none") {
    return "Not Available";
  }
  return null;
}

/**
 * Normalizes confidence score to 0.0 - 100.0 percentage.
 * Handles both mobile SQLite 0-1 probability and 0-100 percentage.
 */
export function normalizeConfidence(input) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new GradingValidationError("Confidence must be a valid finite number", {
      field: "confidence",
      value: input
    });
  }

  if (input < 0) {
    throw new GradingValidationError("Confidence cannot be negative", {
      field: "confidence",
      value: input
    });
  }

  // Mobile SQLite probability is 0.0 to 1.0 (e.g. 0.974)
  if (input <= 1.0) {
    return {
      confidence: Number((input * 100).toFixed(1)),
      rawProbability: input
    };
  }

  // Already a percentage in 1.0 to 100.0
  if (input <= 100.0) {
    return {
      confidence: Number(input.toFixed(1)),
      rawProbability: Number((input / 100).toFixed(4))
    };
  }

  throw new GradingValidationError("Confidence score cannot exceed 100%", {
    field: "confidence",
    value: input
  });
}

/**
 * Validates and converts incoming grading payload into canonical grading record attributes.
 * Never invents diameter, photos, ownership, or sync timestamps.
 */
export function validateAndMapGradingPayload(payload, authenticatedOwnerId) {
  if (!payload || typeof payload !== "object") {
    throw new GradingValidationError("Payload must be a non-null object");
  }

  // 1. Immutable Mobile Sample UUID
  const rawUuid = payload.mobileSampleUuid || payload.id;
  if (!rawUuid || typeof rawUuid !== "string" || !UUID_V4_REGEX.test(rawUuid.trim())) {
    throw new GradingValidationError(
      "mobileSampleUuid must be a valid RFC 4122 UUID v4",
      { field: "mobileSampleUuid", value: rawUuid }
    );
  }
  const mobileSampleUuid = rawUuid.trim().toLowerCase();

  // 2. Human-readable Sample ID
  const rawSampleId = payload.sampleId;
  if (!rawSampleId || typeof rawSampleId !== "string" || rawSampleId.trim().length === 0) {
    throw new GradingValidationError("sampleId must be a non-empty display string", {
      field: "sampleId",
      value: rawSampleId
    });
  }
  const sampleId = rawSampleId.trim();

  // 3. Authenticated Owner ID
  const ownerId = (authenticatedOwnerId || payload.ownerId || "").trim();
  if (!ownerId) {
    throw new GradingValidationError("ownerId is required and must identify an authenticated creator", {
      field: "ownerId"
    });
  }

  // 4. Model Version and Model Type Resolution
  const modelMeta = resolveModelMetadata(payload.modelVersion);

  // 5. Predicted Grade Validation against Model Vocabulary
  const rawGrade = payload.predictedGrade || payload.grade;
  if (!rawGrade || typeof rawGrade !== "string") {
    throw new GradingValidationError("predictedGrade is required", { field: "predictedGrade" });
  }
  const predictedGrade = rawGrade.trim();
  if (!modelMeta.allowedGrades.includes(predictedGrade)) {
    throw new GradingValidationError(
      `Grade "${predictedGrade}" is invalid for ${modelMeta.modelType}. Allowed: ${modelMeta.allowedGrades.join(", ")}`,
      {
        field: "predictedGrade",
        value: predictedGrade,
        modelType: modelMeta.modelType,
        allowedGrades: modelMeta.allowedGrades
      }
    );
  }

  // Optional Expert Grade Validation
  let expertGrade = null;
  if (payload.expertGrade) {
    const trimmedExpert = String(payload.expertGrade).trim();
    if (!modelMeta.allowedGrades.includes(trimmedExpert)) {
      throw new GradingValidationError(
        `Expert grade "${trimmedExpert}" is invalid for ${modelMeta.modelType}.`,
        { field: "expertGrade", value: trimmedExpert }
      );
    }
    expertGrade = trimmedExpert;
  }

  // 6. Confidence Normalization
  const rawConf = payload.confidence ?? payload.modelProbability;
  if (rawConf === undefined || rawConf === null) {
    throw new GradingValidationError("confidence or modelProbability is required", {
      field: "confidence"
    });
  }
  const { confidence, rawProbability } = normalizeConfidence(rawConf);

  // 7. Diameter & Provenance
  let diameterMm = null;
  let diameterSource = normalizeDiameterSource(payload.diameterSource);

  if (payload.diameterMm !== undefined && payload.diameterMm !== null) {
    const rawDia = Number(payload.diameterMm);
    if (!Number.isFinite(rawDia) || rawDia <= 0) {
      throw new GradingValidationError("diameterMm must be a positive finite number in millimeters", {
        field: "diameterMm",
        value: payload.diameterMm
      });
    }
    diameterMm = Number(rawDia.toFixed(2));
  }

  if (modelMeta.isDiameterRequired) {
    if (diameterMm === null) {
      throw new GradingValidationError(
        `diameterMm is mandatory for ${modelMeta.modelType}. A positive measurement in millimeters is required.`,
        { field: "diameterMm" }
      );
    }
    if (!diameterSource) {
      diameterSource = "Not Available";
    }
  } else {
    // 4-Class Image-Only: diameter is optional
    if (diameterMm === null) {
      diameterSource = null;
    }
  }

  // 8. Capture Timestamp
  const rawCaptureTime = payload.captureTimestamp || payload.timestamp;
  if (!rawCaptureTime) {
    throw new GradingValidationError("captureTimestamp is required", { field: "captureTimestamp" });
  }
  const captureDate = new Date(rawCaptureTime);
  if (Number.isNaN(captureDate.getTime())) {
    throw new GradingValidationError("captureTimestamp must be a valid ISO 8601 date string", {
      field: "captureTimestamp",
      value: rawCaptureTime
    });
  }
  // Disallow timestamps more than 10 minutes in the future (clock skew guard)
  const maxFutureAllowed = Date.now() + 10 * 60 * 1000;
  if (captureDate.getTime() > maxFutureAllowed) {
    throw new GradingValidationError("captureTimestamp cannot be in the future", {
      field: "captureTimestamp",
      value: rawCaptureTime
    });
  }

  // 9. Photo References (never invented or fabricated)
  const photoReferences = {
    sidePhotoUrl: payload.sidePhotoUrl || payload.photoReferences?.sidePhotoUrl || null,
    endPhotoUrl: payload.endPhotoUrl || payload.photoReferences?.endPhotoUrl || null,
    sidePhotoStorageKey: payload.sidePhotoStorageKey || payload.photoReferences?.sidePhotoStorageKey || null,
    endPhotoStorageKey: payload.endPhotoStorageKey || payload.photoReferences?.endPhotoStorageKey || null
  };

  return {
    mobileSampleUuid,
    sampleId,
    ownerId,
    organizationId: payload.organizationId ? String(payload.organizationId).trim() : null,
    batchId: payload.batchId ? String(payload.batchId).trim() : null,
    predictedGrade,
    expertGrade,
    modelVersion: modelMeta.modelVersion,
    modelType: modelMeta.modelType,
    confidence,
    rawProbability,
    diameterMm,
    diameterSource,
    measurementMethod: payload.measurementMethod || null,
    captureTimestamp: captureDate,
    serverReceiptTimestamp: new Date(),
    photoReferences,
    device: payload.device ? String(payload.device).trim() : null,
    needsReview: Boolean(payload.needsReview),
    syncRevision: typeof payload.revision === "number" ? Math.max(1, payload.revision) : 1
  };
}

/**
 * Transforms a canonical database record into the exact contract expected by CinnaSense Dashboard.
 */
export function toDashboardRecord(canonicalRecord) {
  if (!canonicalRecord) return null;

  const rec = canonicalRecord.toObject ? canonicalRecord.toObject() : canonicalRecord;
  const isFourClass = rec.modelType === MODEL_IMAGE_ONLY_4CLASS;

  return {
    id: rec.sampleId,
    mobileSampleUuid: rec.mobileSampleUuid,
    grade: rec.expertGrade || rec.predictedGrade,
    vocabulary: isFourClass ? "new" : "legacy",
    confidence: rec.confidence,
    diameterMm: rec.diameterMm,
    diameterSource: rec.diameterSource,
    modelVersion: rec.modelVersion,
    modelType: rec.modelType,
    timestamp: rec.captureTimestamp instanceof Date
      ? rec.captureTimestamp.toISOString()
      : new Date(rec.captureTimestamp).toISOString(),
    syncStatus: "Synced",
    syncTimestamp: rec.serverReceiptTimestamp instanceof Date
      ? rec.serverReceiptTimestamp.toISOString()
      : rec.serverReceiptTimestamp
      ? new Date(rec.serverReceiptTimestamp).toISOString()
      : null,
    device: rec.device || null,
    batchId: rec.batchId || null,
    sideImageUrl: rec.photoReferences?.sidePhotoUrl || null,
    endImageUrl: rec.photoReferences?.endPhotoUrl || null,
    notes: rec.notes || null
  };
}

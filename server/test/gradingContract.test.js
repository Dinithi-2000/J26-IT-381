import test from "node:test";
import assert from "node:assert/strict";

import {
  FOUR_CLASS_GRADES,
  SEVEN_CLASS_GRADES,
  MODEL_IMAGE_ONLY_4CLASS,
  MODEL_HYBRID_7CLASS
} from "../src/models/GradingSample.js";

import {
  resolveModelMetadata,
  normalizeDiameterSource,
  normalizeConfidence,
  validateAndMapGradingPayload,
  toDashboardRecord,
  GradingValidationError
} from "../src/services/gradingValidationService.js";

import { Prediction } from "../src/models/Prediction.js";

test("Grading Contract: Supported Grade Vocabularies", () => {
  assert.deepEqual(FOUR_CLASS_GRADES, ["ALBA", "C4", "C5", "Special"]);
  assert.deepEqual(SEVEN_CLASS_GRADES, ["ALBA", "C4", "C5", "EXTRA", "H1", "H2", "M4"]);
});

test("Grading Contract: Model Metadata Resolution", () => {
  const meta4 = resolveModelMetadata("image_only_4class_v1");
  assert.equal(meta4.modelType, MODEL_IMAGE_ONLY_4CLASS);
  assert.equal(meta4.isDiameterRequired, false);
  assert.deepEqual(meta4.allowedGrades, FOUR_CLASS_GRADES);

  const meta7 = resolveModelMetadata("hybrid_v2");
  assert.equal(meta7.modelType, MODEL_HYBRID_7CLASS);
  assert.equal(meta7.isDiameterRequired, true);
  assert.deepEqual(meta7.allowedGrades, SEVEN_CLASS_GRADES);

  assert.throws(
    () => resolveModelMetadata("unknown_v99"),
    /Unsupported modelVersion/
  );
});

test("Grading Contract: Confidence Normalization", () => {
  // Mobile SQLite 0.0 - 1.0 probability
  const fromProb = normalizeConfidence(0.974);
  assert.equal(fromProb.confidence, 97.4);
  assert.equal(fromProb.rawProbability, 0.974);

  // Percentage already 0.0 - 100.0
  const fromPct = normalizeConfidence(88.6);
  assert.equal(fromPct.confidence, 88.6);

  // Edge cases
  assert.equal(normalizeConfidence(0).confidence, 0);
  assert.equal(normalizeConfidence(1.0).confidence, 100);
  assert.equal(normalizeConfidence(100.0).confidence, 100);

  // Invalid confidence scores
  assert.throws(() => normalizeConfidence(-0.1), /cannot be negative/);
  assert.throws(() => normalizeConfidence(100.1), /cannot exceed 100%/);
  assert.throws(() => normalizeConfidence(NaN), /must be a valid finite number/);
  assert.throws(() => normalizeConfidence(Infinity), /must be a valid finite number/);
});

test("Grading Contract: Diameter Source Normalization", () => {
  assert.equal(normalizeDiameterSource("ai_estimated"), "AI");
  assert.equal(normalizeDiameterSource("AI"), "AI");
  assert.equal(normalizeDiameterSource("caliper_measured"), "Caliper");
  assert.equal(normalizeDiameterSource("digital_caliper_manual"), "Caliper");
  assert.equal(normalizeDiameterSource("Caliper"), "Caliper");
  assert.equal(normalizeDiameterSource("not available"), "Not Available");
  assert.equal(normalizeDiameterSource(null), null);
  assert.equal(normalizeDiameterSource(undefined), null);
});

test("Grading Contract: Valid 4-Class Image-Only record", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-89240",
    predictedGrade: "Special",
    modelVersion: "image_only_4class_v1",
    modelProbability: 0.948,
    captureTimestamp: "2026-10-21T06:12:00.000Z",
    device: "Samsung Galaxy S22",
    batchId: "BATCH-GALLE-14C"
  };

  const canonical = validateAndMapGradingPayload(payload, "inspector-alice");

  assert.equal(canonical.mobileSampleUuid, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(canonical.sampleId, "SMP-89240");
  assert.equal(canonical.ownerId, "inspector-alice");
  assert.equal(canonical.predictedGrade, "Special");
  assert.equal(canonical.modelType, MODEL_IMAGE_ONLY_4CLASS);
  assert.equal(canonical.confidence, 94.8);
  assert.equal(canonical.rawProbability, 0.948);
  assert.equal(canonical.diameterMm, null);
  assert.equal(canonical.diameterSource, null);
  assert.ok(canonical.serverReceiptTimestamp instanceof Date);

  // Dashboard presentation mapping
  const dashboard = toDashboardRecord(canonical);
  assert.equal(dashboard.id, "SMP-89240");
  assert.equal(dashboard.mobileSampleUuid, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(dashboard.grade, "Special");
  assert.equal(dashboard.vocabulary, "new");
  assert.equal(dashboard.confidence, 94.8);
  assert.equal(dashboard.diameterMm, null);
  assert.equal(dashboard.diameterSource, null);
  assert.equal(dashboard.syncStatus, "Synced");
  assert.ok(dashboard.syncTimestamp);
});

test("Grading Contract: Valid 7-Class Hybrid record", () => {
  const payload = {
    mobileSampleUuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    sampleId: "SMP-88941",
    predictedGrade: "EXTRA",
    modelVersion: "hybrid_v2",
    confidence: 89.0,
    diameterMm: 12.8,
    diameterSource: "caliper_measured",
    captureTimestamp: "2026-10-18T10:20:00.000Z"
  };

  const canonical = validateAndMapGradingPayload(payload, "inspector-bob");

  assert.equal(canonical.predictedGrade, "EXTRA");
  assert.equal(canonical.modelType, MODEL_HYBRID_7CLASS);
  assert.equal(canonical.confidence, 89.0);
  assert.equal(canonical.diameterMm, 12.8);
  assert.equal(canonical.diameterSource, "Caliper");

  const dashboard = toDashboardRecord(canonical);
  assert.equal(dashboard.grade, "EXTRA");
  assert.equal(dashboard.vocabulary, "legacy");
  assert.equal(dashboard.diameterMm, 12.8);
  assert.equal(dashboard.diameterSource, "Caliper");
});

test("Grading Contract: Rejects 7-Class Grade in 4-Class Model", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10001",
    predictedGrade: "EXTRA", // EXTRA is only valid in 7-Class
    modelVersion: "image_only_4class_v1",
    confidence: 90.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    (err) => err instanceof GradingValidationError && err.message.includes("Grade \"EXTRA\" is invalid for 4-Class Image-Only")
  );
});

test("Grading Contract: Rejects 4-Class 'Special' in 7-Class Model", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10002",
    predictedGrade: "Special", // Special is only valid in 4-Class
    modelVersion: "hybrid_v2",
    diameterMm: 10.5,
    confidence: 90.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    (err) => err instanceof GradingValidationError && err.message.includes("Grade \"Special\" is invalid for 7-Class Hybrid")
  );
});

test("Grading Contract: Enforces Diameter Requirement for 7-Class Hybrid", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10003",
    predictedGrade: "H1",
    modelVersion: "hybrid_v2",
    diameterMm: null, // Missing diameter for hybrid!
    confidence: 85.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    /diameterMm is mandatory for 7-Class Hybrid/
  );
});

test("Grading Contract: Rejects Non-Positive Diameter", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10004",
    predictedGrade: "H1",
    modelVersion: "hybrid_v2",
    diameterMm: -5.0,
    confidence: 85.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    /diameterMm must be a positive finite number/
  );
});

test("Grading Contract: Rejects Invalid Mobile Sample UUID", () => {
  const payload = {
    mobileSampleUuid: "not-a-valid-uuid",
    sampleId: "SMP-10005",
    predictedGrade: "ALBA",
    modelVersion: "image_only_4class_v1",
    confidence: 95.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    /mobileSampleUuid must be a valid RFC 4122 UUID v4/
  );
});

test("Grading Contract: Rejects Missing Authenticated Owner", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10006",
    predictedGrade: "ALBA",
    modelVersion: "image_only_4class_v1",
    confidence: 95.0,
    captureTimestamp: new Date().toISOString()
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, ""),
    /ownerId is required/
  );
});

test("Grading Contract: Rejects Future Capture Timestamps", () => {
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours future
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10007",
    predictedGrade: "ALBA",
    modelVersion: "image_only_4class_v1",
    confidence: 95.0,
    captureTimestamp: futureDate
  };

  assert.throws(
    () => validateAndMapGradingPayload(payload, "inspector-1"),
    /captureTimestamp cannot be in the future/
  );
});

test("Grading Contract: Never Invents Photos or Fake URLs", () => {
  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
    sampleId: "SMP-10008",
    predictedGrade: "C4",
    modelVersion: "image_only_4class_v1",
    confidence: 92.0,
    captureTimestamp: new Date().toISOString()
    // No photo URLs provided
  };

  const canonical = validateAndMapGradingPayload(payload, "inspector-1");
  assert.equal(canonical.photoReferences.sidePhotoUrl, null);
  assert.equal(canonical.photoReferences.endPhotoUrl, null);

  const dashboard = toDashboardRecord(canonical);
  assert.equal(dashboard.sideImageUrl, null);
  assert.equal(dashboard.endImageUrl, null);
});

test("Existing Backend Compatibility: Price Prediction Model Unaffected", () => {
  assert.equal(typeof Prediction, "function");
  assert.equal(Prediction.modelName, "Prediction");
  const schemaPaths = Object.keys(Prediction.schema.paths);
  assert.ok(schemaPaths.includes("date"));
  assert.ok(schemaPaths.includes("district"));
  assert.ok(schemaPaths.includes("grade"));
  assert.ok(schemaPaths.includes("predictedPrice"));
  assert.ok(schemaPaths.includes("currency"));
  assert.ok(schemaPaths.includes("unit"));
  assert.ok(schemaPaths.includes("modelVersion"));
});

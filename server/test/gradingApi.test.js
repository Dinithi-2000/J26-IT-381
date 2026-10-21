import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

import { app } from "../src/server.js";
import { createToken, ROLE_INSPECTOR, ROLE_SUPERVISOR, ROLE_ADMIN } from "../src/services/authService.js";
import { GradingSample } from "../src/models/GradingSample.js";

const TEST_SECRET = "grading-api-test-secret-at-least-32-chars-long";
process.env.AUTH_SECRET = TEST_SECRET;
process.env.AUTH_ISSUER = "quillgrade-auth";
process.env.AUTH_AUDIENCE = "cinnasense-api";

// Ephemeral test server
let server;
let baseUrl;

// In-memory test store to isolate database writes
let inMemoryStore = [];

function createMockSampleDoc(data) {
  const doc = {
    ...data,
    _id: data._id || `mock-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    toObject() {
      return { ...this };
    },
    async save() {
      this.updatedAt = new Date();
      const idx = inMemoryStore.findIndex(
        (item) => item.mobileSampleUuid === this.mobileSampleUuid
      );
      if (idx !== -1) {
        inMemoryStore[idx] = this;
      } else {
        inMemoryStore.push(this);
      }
      return this;
    }
  };
  return doc;
}

// Intercept Mongoose GradingSample operations during test runs
const originalFindOne = GradingSample.findOne;
const originalFind = GradingSample.find;
const originalCreate = GradingSample.create;
const originalCountDocuments = GradingSample.countDocuments;

test.before(async () => {
  // Mock database connection as connected for integration testing
  Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

  GradingSample.findOne = function (query) {
    let result = null;
    if (query.mobileSampleUuid) {
      result = inMemoryStore.find((item) => item.mobileSampleUuid === query.mobileSampleUuid) || null;
    } else if (query.$or) {
      result = inMemoryStore.find((item) =>
        query.$or.some((clause) => {
          if (clause.sampleId && item.sampleId === clause.sampleId) return true;
          if (clause.mobileSampleUuid && item.mobileSampleUuid === clause.mobileSampleUuid) return true;
          return false;
        })
      ) || null;
    } else if (query.ownerId) {
      result = inMemoryStore.find((item) => item.ownerId === query.ownerId) || null;
    } else if (query.organizationId) {
      result = inMemoryStore.find((item) => item.organizationId === query.organizationId) || null;
    } else {
      result = inMemoryStore[0] || null;
    }

    const chained = {
      sort() {
        return Promise.resolve(result ? createMockSampleDoc(result) : null);
      },
      then(resolve, reject) {
        return Promise.resolve(result ? createMockSampleDoc(result) : null).then(resolve, reject);
      }
    };
    return chained;
  };

  GradingSample.create = async function (data) {
    const doc = createMockSampleDoc(data);
    inMemoryStore.push(doc);
    return doc;
  };

  GradingSample.find = function (query = {}) {
    let results = inMemoryStore.filter((item) => {
      if (query.ownerId && item.ownerId !== query.ownerId) return false;
      if (query.organizationId && item.organizationId !== query.organizationId) return false;
      if (query.modelType && item.modelType !== query.modelType) return false;
      if (query.predictedGrade && item.predictedGrade !== query.predictedGrade) return false;
      return true;
    });

    const chain = {
      _results: results,
      sort() {
        return this;
      },
      skip(count) {
        this._results = this._results.slice(count);
        return this;
      },
      limit(count) {
        this._results = this._results.slice(0, count);
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(this._results.map(createMockSampleDoc)).then(resolve, reject);
      }
    };
    return chain;
  };

  GradingSample.countDocuments = async function (query = {}) {
    return inMemoryStore.filter((item) => {
      if (query.ownerId && item.ownerId !== query.ownerId) return false;
      if (query.organizationId && item.organizationId !== query.organizationId) return false;
      if (query.modelType && item.modelType !== query.modelType) return false;
      if (query.predictedGrade && item.predictedGrade !== query.predictedGrade) return false;
      return true;
    }).length;
  };

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  // Restore original methods
  GradingSample.findOne = originalFindOne;
  GradingSample.find = originalFind;
  GradingSample.create = originalCreate;
  GradingSample.countDocuments = originalCountDocuments;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test.beforeEach(() => {
  inMemoryStore = [];
});

test("API: Rejects Request Missing Authorization Token", async () => {
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "MISSING_TOKEN");
});

test("API: Rejects Request With Invalid Signature JWT", async () => {
  const badToken = createToken({ sub: "inspector-1" }, "wrong-signing-secret-key-32-chars-long");
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${badToken}`
    },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "INVALID_SIGNATURE");
});

test("API: Rejects Request With Expired JWT", async () => {
  const expiredToken = createToken({ sub: "inspector-1" }, TEST_SECRET, { expiresInSec: -10 });
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${expiredToken}`
    },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "TOKEN_EXPIRED");
});

test("API: Supervisor Cannot Call POST /api/grading/sync", async () => {
  const supervisorToken = createToken(
    { sub: "supervisor-1", role: ROLE_SUPERVISOR, orgId: "matara-plant" },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supervisorToken}`
    },
    body: JSON.stringify({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440000",
      sampleId: "SMP-89240",
      predictedGrade: "Special",
      modelVersion: "image_only_4class_v1",
      confidence: 95.0,
      captureTimestamp: new Date().toISOString()
    })
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "FORBIDDEN_ROLE");
});

test("API: Inspector Cannot Call GET /api/grading", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-1", role: ROLE_INSPECTOR },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/grading`, {
    headers: { Authorization: `Bearer ${inspectorToken}` }
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "FORBIDDEN_ROLE");
});

test("API: Successfully Ingests Valid 4-Class Image-Only Sample", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-alice", role: ROLE_INSPECTOR, orgId: "matara-plant" },
    TEST_SECRET
  );

  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440001",
    sampleId: "SMP-10001",
    predictedGrade: "Special",
    modelVersion: "image_only_4class_v1",
    modelProbability: 0.945, // Mobile SQLite 0-1 probability
    diameterMm: null, // Null diameter for image-only
    diameterSource: null,
    captureTimestamp: "2026-10-21T07:30:00.000Z",
    batchId: "BATCH-MATARA-01",
    revision: 1
  };

  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, "acknowledged");
  assert.equal(data.action, "created");
  assert.equal(data.receipt.mobileSampleUuid, "550e8400-e29b-41d4-a716-446655440001");
  assert.equal(data.receipt.ownerId, "inspector-alice");
  assert.ok(data.receipt.serverReceiptTimestamp);
  assert.equal(data.receipt.revision, 1);

  // Stored in memory with converted percentage confidence (94.5%)
  assert.equal(inMemoryStore.length, 1);
  assert.equal(inMemoryStore[0].confidence, 94.5);
  assert.equal(inMemoryStore[0].diameterMm, null);
});

test("API: Successfully Ingests Valid 7-Class Hybrid Sample", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-bob", role: ROLE_INSPECTOR, orgId: "matara-plant" },
    TEST_SECRET
  );

  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440002",
    sampleId: "SMP-10002",
    predictedGrade: "EXTRA",
    modelVersion: "hybrid_v2",
    confidence: 88.0,
    diameterMm: 14.2,
    diameterSource: "caliper_measured",
    captureTimestamp: "2026-10-21T07:45:00.000Z",
    revision: 1
  };

  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, "acknowledged");
  assert.equal(data.action, "created");
  assert.equal(inMemoryStore[0].diameterMm, 14.2);
  assert.equal(inMemoryStore[0].diameterSource, "Caliper");
});

test("API: Rejects Invalid Model Vocabulary", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-alice", role: ROLE_INSPECTOR },
    TEST_SECRET
  );

  // "Special" is NOT valid in 7-Class Hybrid (only 4-Class)
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440003",
      sampleId: "SMP-10003",
      predictedGrade: "Special",
      modelVersion: "hybrid_v2",
      diameterMm: 10.0,
      confidence: 90.0,
      captureTimestamp: new Date().toISOString()
    })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("API: Rejects 7-Class Hybrid Missing Diameter", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-alice", role: ROLE_INSPECTOR },
    TEST_SECRET
  );

  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440004",
      sampleId: "SMP-10004",
      predictedGrade: "H1",
      modelVersion: "hybrid_v2",
      diameterMm: null, // Invalid: hybrid requires diameter
      confidence: 85.0,
      captureTimestamp: new Date().toISOString()
    })
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("API: Duplicate Retry Idempotency (Same Revision Returns 200 Acknowledged)", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-alice", role: ROLE_INSPECTOR },
    TEST_SECRET
  );

  const payload = {
    mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440005",
    sampleId: "SMP-10005",
    predictedGrade: "C4",
    modelVersion: "image_only_4class_v1",
    confidence: 91.0,
    captureTimestamp: "2026-10-21T08:00:00.000Z",
    revision: 1
  };

  // First POST
  const res1 = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify(payload)
  });
  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  assert.equal(data1.action, "created");

  // Exact duplicate retry (e.g. mobile network timed out during response)
  const res2 = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify(payload)
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.status, "acknowledged");
  assert.equal(data2.action, "idempotent_duplicate");
  assert.equal(data2.receipt.mobileSampleUuid, "550e8400-e29b-41d4-a716-446655440005");
  // Still only 1 record in database
  assert.equal(inMemoryStore.length, 1);
});

test("API: Rejects Cross-Owner Overwrite Attempt", async () => {
  const inspectorAlice = createToken({ sub: "inspector-alice", role: ROLE_INSPECTOR }, TEST_SECRET);
  const inspectorMallory = createToken({ sub: "inspector-mallory", role: ROLE_INSPECTOR }, TEST_SECRET);

  const uuid = "550e8400-e29b-41d4-a716-446655440006";

  // Alice saves first
  await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorAlice}`
    },
    body: JSON.stringify({
      mobileSampleUuid: uuid,
      sampleId: "SMP-ALICE-1",
      predictedGrade: "ALBA",
      modelVersion: "image_only_4class_v1",
      confidence: 96.0,
      captureTimestamp: new Date().toISOString()
    })
  });

  // Mallory tries to overwrite Alice's UUID
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorMallory}`
    },
    body: JSON.stringify({
      mobileSampleUuid: uuid,
      sampleId: "SMP-MALLORY-1",
      predictedGrade: "C4",
      modelVersion: "image_only_4class_v1",
      confidence: 80.0,
      captureTimestamp: new Date().toISOString()
    })
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "CROSS_OWNER_OVERWRITE_DENIED");
});

test("API: Revision Conflict Handling (Older Revision Rejected)", async () => {
  const inspectorToken = createToken({ sub: "inspector-alice", role: ROLE_INSPECTOR }, TEST_SECRET);
  const uuid = "550e8400-e29b-41d4-a716-446655440007";

  // Save revision 2
  await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify({
      mobileSampleUuid: uuid,
      sampleId: "SMP-REV-TEST",
      predictedGrade: "ALBA",
      modelVersion: "image_only_4class_v1",
      confidence: 96.0,
      captureTimestamp: new Date().toISOString(),
      revision: 2
    })
  });

  // Incoming revision 1 is older -> 409 Conflict
  const res = await fetch(`${baseUrl}/api/grading/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inspectorToken}`
    },
    body: JSON.stringify({
      mobileSampleUuid: uuid,
      sampleId: "SMP-REV-TEST",
      predictedGrade: "ALBA",
      modelVersion: "image_only_4class_v1",
      confidence: 96.0,
      captureTimestamp: new Date().toISOString(),
      revision: 1
    })
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "REVISION_CONFLICT");
});

test("API: Supervisor Organization Scoping On GET /api/grading", async () => {
  const supervisorMatara = createToken(
    { sub: "sup-matara", role: ROLE_SUPERVISOR, orgId: "matara-facility" },
    TEST_SECRET
  );

  // Seed two samples from different facilities into memory
  inMemoryStore.push(
    createMockSampleDoc({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440008",
      sampleId: "SMP-MATARA-1",
      ownerId: "inspector-1",
      organizationId: "matara-facility",
      predictedGrade: "ALBA",
      modelVersion: "image_only_4class_v1",
      modelType: "4-Class Image-Only",
      confidence: 98.0,
      captureTimestamp: new Date(),
      serverReceiptTimestamp: new Date()
    })
  );

  inMemoryStore.push(
    createMockSampleDoc({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440009",
      sampleId: "SMP-GALLE-1",
      ownerId: "inspector-2",
      organizationId: "galle-facility",
      predictedGrade: "C4",
      modelVersion: "image_only_4class_v1",
      modelType: "4-Class Image-Only",
      confidence: 89.0,
      captureTimestamp: new Date(),
      serverReceiptTimestamp: new Date()
    })
  );

  const res = await fetch(`${baseUrl}/api/grading`, {
    headers: { Authorization: `Bearer ${supervisorMatara}` }
  });

  assert.equal(res.status, 200);
  const records = await res.json();
  assert.ok(Array.isArray(records));
  assert.equal(records.length, 1);
  assert.equal(records[0].id, "SMP-MATARA-1");
  assert.equal(records[0].grade, "ALBA");
  assert.equal(records[0].vocabulary, "new");
  assert.equal(records[0].syncStatus, "Synced");
});

test("API: GET /api/grading/:id Returns 404 For Cross-Organization Sample", async () => {
  const supervisorMatara = createToken(
    { sub: "sup-matara", role: ROLE_SUPERVISOR, orgId: "matara-facility" },
    TEST_SECRET
  );

  inMemoryStore.push(
    createMockSampleDoc({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440010",
      sampleId: "SMP-GALLE-SECRET",
      ownerId: "inspector-3",
      organizationId: "galle-facility", // Different facility
      predictedGrade: "Special",
      modelVersion: "image_only_4class_v1",
      modelType: "4-Class Image-Only",
      confidence: 95.0,
      captureTimestamp: new Date(),
      serverReceiptTimestamp: new Date()
    })
  );

  // Attempting to fetch a sample belonging to Galle facility
  const res = await fetch(`${baseUrl}/api/grading/SMP-GALLE-SECRET`, {
    headers: { Authorization: `Bearer ${supervisorMatara}` }
  });

  // Returns 404 to prevent ID enumeration across facilities
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, "NOT_FOUND");
});

test("API: GET /api/grading/sync-status Returns Scoped Counts", async () => {
  const inspectorToken = createToken(
    { sub: "inspector-alice", role: ROLE_INSPECTOR },
    TEST_SECRET
  );

  inMemoryStore.push(
    createMockSampleDoc({
      mobileSampleUuid: "550e8400-e29b-41d4-a716-446655440011",
      sampleId: "SMP-ALICE-10",
      ownerId: "inspector-alice",
      predictedGrade: "ALBA",
      modelVersion: "image_only_4class_v1",
      modelType: "4-Class Image-Only",
      confidence: 97.0,
      captureTimestamp: new Date("2026-10-21T09:00:00.000Z"),
      serverReceiptTimestamp: new Date("2026-10-21T09:01:00.000Z")
    })
  );

  const res = await fetch(`${baseUrl}/api/grading/sync-status`, {
    headers: { Authorization: `Bearer ${inspectorToken}` }
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "ready");
  assert.equal(data.callerRole, ROLE_INSPECTOR);
  assert.equal(data.totalRecords, 1);
  assert.equal(data.latestSampleId, "SMP-ALICE-10");
  assert.equal(data.lastSyncTimestamp, "2026-10-21T09:01:00.000Z");
});

test("Existing Prediction API Compatibility: Health and Prediction Endpoints", async () => {
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "ok");

  // Predictions endpoint remains active (validation checks input)
  const predRes = await fetch(`${baseUrl}/api/predictions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}) // Empty body triggers validation error
  });
  assert.equal(predRes.status, 400);
  const predData = await predRes.json();
  assert.equal(predData.error.code, "VALIDATION_ERROR");
});

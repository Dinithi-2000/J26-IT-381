import test from "node:test";
import assert from "node:assert/strict";

import {
  createToken,
  verifyToken,
  extractUserIdentity,
  canAccessRecord,
  canIngestRecord,
  buildRecordScope,
  ROLE_INSPECTOR,
  ROLE_SUPERVISOR,
  ROLE_ADMIN,
  AuthenticationError,
  AuthorizationError
} from "../src/services/authService.js";

import {
  authenticate,
  requireRole,
  requireInspector,
  requireSupervisor,
  enforceIngestionOwnership
} from "../src/middleware/authMiddleware.js";

// Test-only secret key (strictly isolated to unit tests, never stored in production env)
const TEST_SECRET = "test-secret-key-32-chars-long-minimum-length-for-hmac";

function mockRequestResponse(headers = {}, body = {}) {
  const req = {
    headers: { ...headers },
    body: { ...body }
  };

  let statusCode = 200;
  let jsonBody = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonBody = data;
      return res;
    }
  };

  const next = () => {
    nextCalled = true;
  };

  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody, wasNextCalled: () => nextCalled };
}

test("Auth: Creates and Verifies Valid Token with Test Key", () => {
  const token = createToken(
    { sub: "inspector-42", role: ROLE_INSPECTOR, orgId: "matara-plant" },
    TEST_SECRET
  );

  const payload = verifyToken(token, { secret: TEST_SECRET });
  assert.equal(payload.sub, "inspector-42");
  assert.equal(payload.role, ROLE_INSPECTOR);
  assert.equal(payload.orgId, "matara-plant");

  const identity = extractUserIdentity(payload);
  assert.equal(identity.uid, "inspector-42");
  assert.equal(identity.role, ROLE_INSPECTOR);
  assert.equal(identity.organizationId, "matara-plant");
});

test("Auth: Rejects Missing Token", () => {
  assert.throws(
    () => verifyToken("", { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MISSING_TOKEN"
  );
  assert.throws(
    () => verifyToken(null, { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MISSING_TOKEN"
  );
});

test("Auth: Rejects Malformed Token Structure", () => {
  assert.throws(
    () => verifyToken("not.a.valid.jwt.token", { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MALFORMED_TOKEN"
  );
  assert.throws(
    () => verifyToken("only-one-part", { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MALFORMED_TOKEN"
  );
  assert.throws(
    () => verifyToken("header.payload", { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MALFORMED_TOKEN"
  );
});

test("Auth: Rejects Algorithm Bypass (alg: none)", () => {
  const fakeHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const fakePayload = Buffer.from(JSON.stringify({ sub: "hacker", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const fakeTokenWithSig = `${fakeHeader}.${fakePayload}.fakesig`;

  assert.throws(
    () => verifyToken(fakeTokenWithSig, { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "INVALID_ALGORITHM"
  );

  const fakeTokenEmptySig = `${fakeHeader}.${fakePayload}.`;
  assert.throws(
    () => verifyToken(fakeTokenEmptySig, { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "MALFORMED_TOKEN"
  );
});

test("Auth: Rejects Tampered / Invalid Signature", () => {
  const validToken = createToken({ sub: "inspector-42", role: ROLE_INSPECTOR }, TEST_SECRET);
  const parts = validToken.split(".");

  // Tamper with payload (change user id)
  const tamperedPayload = Buffer.from(JSON.stringify({ sub: "inspector-hacker", role: ROLE_ADMIN, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert.throws(
    () => verifyToken(tamperedToken, { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "INVALID_SIGNATURE"
  );
});

test("Auth: Rejects Expired Token", () => {
  // Create token with negative expiresInSec so exp is already in the past
  const expiredToken = createToken(
    { sub: "inspector-42" },
    TEST_SECRET,
    { expiresInSec: -100 }
  );

  assert.throws(
    () => verifyToken(expiredToken, { secret: TEST_SECRET }),
    (err) => err instanceof AuthenticationError && err.code === "TOKEN_EXPIRED"
  );
});

test("Auth: Rejects Untrusted Issuer and Audience", () => {
  const token = createToken(
    { sub: "inspector-42" },
    TEST_SECRET,
    { issuer: "rogue-issuer", audience: "wrong-audience" }
  );

  assert.throws(
    () => verifyToken(token, { secret: TEST_SECRET, issuer: "quillgrade-auth" }),
    (err) => err instanceof AuthenticationError && err.code === "INVALID_ISSUER"
  );

  assert.throws(
    () => verifyToken(token, { secret: TEST_SECRET, audience: "cinnasense-api" }),
    (err) => err instanceof AuthenticationError && err.code === "INVALID_AUDIENCE"
  );
});

test("Auth: Fails Closed When Verification Key Not Configured", () => {
  const token = createToken({ sub: "inspector-42" }, TEST_SECRET);
  // Do not provide secret in options and ensure environment doesn't have it
  const origSecret = process.env.AUTH_SECRET;
  const origJwtSecret = process.env.JWT_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(
      () => verifyToken(token),
      (err) => err instanceof AuthenticationError && err.code === "AUTH_NOT_CONFIGURED" && err.statusCode === 500
    );
  } finally {
    if (origSecret) process.env.AUTH_SECRET = origSecret;
    if (origJwtSecret) process.env.JWT_SECRET = origJwtSecret;
  }
});

test("Authorization: Inspector Access Policy (Own Records Only)", () => {
  const inspector = { uid: "inspector-01", role: ROLE_INSPECTOR, organizationId: "plant-a" };

  const ownRecord = { ownerId: "inspector-01", organizationId: "plant-a" };
  const otherRecord = { ownerId: "inspector-02", organizationId: "plant-a" };

  assert.equal(canAccessRecord(inspector, ownRecord).allowed, true);

  const crossOwnerCheck = canAccessRecord(inspector, otherRecord);
  assert.equal(crossOwnerCheck.allowed, false);
  assert.equal(crossOwnerCheck.code, "CROSS_OWNER_DENIED");
});

test("Authorization: Supervisor Access Policy (Permitted Organization Records Only)", () => {
  const supervisor = { uid: "supervisor-01", role: ROLE_SUPERVISOR, organizationId: "plant-a" };

  const sameOrgRecord = { ownerId: "inspector-99", organizationId: "plant-a" };
  const diffOrgRecord = { ownerId: "inspector-99", organizationId: "plant-b" };

  assert.equal(canAccessRecord(supervisor, sameOrgRecord).allowed, true);

  const crossOrgCheck = canAccessRecord(supervisor, diffOrgRecord);
  assert.equal(crossOrgCheck.allowed, false);
  assert.equal(crossOrgCheck.code, "CROSS_ORGANIZATION_DENIED");
});

test("Authorization: Admin Has Global Access", () => {
  const admin = { uid: "admin-01", role: ROLE_ADMIN };
  const anyRecord = { ownerId: "anyone", organizationId: "anywhere" };

  assert.equal(canAccessRecord(admin, anyRecord).allowed, true);
});

test("Authorization: Deny by Default for Unknown Role", () => {
  const unknownUser = { uid: "guest-01", role: "guest" };
  const record = { ownerId: "guest-01" };

  assert.equal(canAccessRecord(unknownUser, record).allowed, false);
});

test("Authorization: Ingestion Owner Spoofing Protection", () => {
  const inspector = { uid: "inspector-alice", role: ROLE_INSPECTOR };

  // 1. Ingesting with matching ownerId -> Allowed
  assert.equal(canIngestRecord(inspector, { ownerId: "inspector-alice" }).allowed, true);

  // 2. Ingesting without ownerId (to be stamped by server) -> Allowed
  assert.equal(canIngestRecord(inspector, {}).allowed, true);

  // 3. Ingesting with spoofed ownerId -> REJECTED
  const spoofAttempt = canIngestRecord(inspector, { ownerId: "inspector-bob" });
  assert.equal(spoofAttempt.allowed, false);
  assert.equal(spoofAttempt.code, "CROSS_OWNER_SPOOFING_DENIED");

  // 4. Supervisor cannot submit records (only inspect/audit)
  const supervisor = { uid: "supervisor-1", role: ROLE_SUPERVISOR };
  const supervisorAttempt = canIngestRecord(supervisor, {});
  assert.equal(supervisorAttempt.allowed, false);
  assert.equal(supervisorAttempt.code, "ROLE_NOT_AUTHORIZED_FOR_INGESTION");
});

test("Authorization: Query Scope Construction", () => {
  const inspector = { uid: "inspector-01", role: ROLE_INSPECTOR };
  assert.deepEqual(buildRecordScope(inspector), { ownerId: "inspector-01" });

  const supervisor = { uid: "supervisor-01", role: ROLE_SUPERVISOR, organizationId: "plant-a" };
  assert.deepEqual(buildRecordScope(supervisor), { organizationId: "plant-a" });

  const admin = { uid: "admin-01", role: ROLE_ADMIN };
  assert.deepEqual(buildRecordScope(admin), {});

  // Supervisor without organization throws
  const unassignedSupervisor = { uid: "supervisor-02", role: ROLE_SUPERVISOR, organizationId: null };
  assert.throws(() => buildRecordScope(unassignedSupervisor), /not assigned to an organization/);
});

test("Middleware: Authenticate Rejects Missing or Malformed Headers", () => {
  const authMw = authenticate({ secret: TEST_SECRET });

  // Missing Authorization header
  const ctx1 = mockRequestResponse();
  authMw(ctx1.req, ctx1.res, () => {});
  assert.equal(ctx1.getStatus(), 401);
  assert.equal(ctx1.getBody().error.code, "MISSING_TOKEN");

  // Malformed header (no Bearer scheme)
  const ctx2 = mockRequestResponse({ authorization: "Basic dXNlcjpwYXNz" });
  authMw(ctx2.req, ctx2.res, () => {});
  assert.equal(ctx2.getStatus(), 401);
  assert.equal(ctx2.getBody().error.code, "MALFORMED_TOKEN");
});

test("Middleware: Authenticate Sets User Context on Valid Token", () => {
  const authMw = authenticate({ secret: TEST_SECRET });
  const token = createToken({ sub: "inspector-77", role: ROLE_INSPECTOR }, TEST_SECRET);

  const ctx = mockRequestResponse({ authorization: `Bearer ${token}` });
  authMw(ctx.req, ctx.res, () => ctx.res.status(200));

  assert.ok(ctx.req.user);
  assert.equal(ctx.req.user.uid, "inspector-77");
  assert.equal(ctx.req.user.role, ROLE_INSPECTOR);
});

test("Middleware: RequireRole Enforces Role Permissions", () => {
  const supervisorOnly = requireRole(ROLE_SUPERVISOR);

  // Inspector denied supervisor resource
  const ctxInspector = mockRequestResponse();
  ctxInspector.req.user = { uid: "insp-1", role: ROLE_INSPECTOR };
  supervisorOnly(ctxInspector.req, ctxInspector.res, () => {});
  assert.equal(ctxInspector.getStatus(), 403);
  assert.equal(ctxInspector.getBody().error.code, "FORBIDDEN_ROLE");

  // Supervisor granted
  let supervisorNextCalled = false;
  const ctxSupervisor = mockRequestResponse();
  ctxSupervisor.req.user = { uid: "sup-1", role: ROLE_SUPERVISOR };
  supervisorOnly(ctxSupervisor.req, ctxSupervisor.res, () => { supervisorNextCalled = true; });
  assert.equal(supervisorNextCalled, true);

  // Admin granted access to supervisor resource
  let adminNextCalled = false;
  const ctxAdmin = mockRequestResponse();
  ctxAdmin.req.user = { uid: "adm-1", role: ROLE_ADMIN };
  supervisorOnly(ctxAdmin.req, ctxAdmin.res, () => { adminNextCalled = true; });
  assert.equal(adminNextCalled, true);
});

test("Middleware: EnforceIngestionOwnership Blocks Spoofing", () => {
  // Attempting to forge another inspector's ID
  const ctxSpoof = mockRequestResponse({}, { ownerId: "inspector-other" });
  ctxSpoof.req.user = { uid: "inspector-actual", role: ROLE_INSPECTOR };

  enforceIngestionOwnership(ctxSpoof.req, ctxSpoof.res, () => {});
  assert.equal(ctxSpoof.getStatus(), 403);
  assert.equal(ctxSpoof.getBody().error.code, "CROSS_OWNER_SPOOFING_DENIED");

  // Legitimate ingestion stamps verified UID
  let nextCalled = false;
  const ctxLegit = mockRequestResponse({}, {});
  ctxLegit.req.user = { uid: "inspector-actual", role: ROLE_INSPECTOR };

  enforceIngestionOwnership(ctxLegit.req, ctxLegit.res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(ctxLegit.req.authenticatedOwnerId, "inspector-actual");
});

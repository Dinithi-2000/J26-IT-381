import crypto from "node:crypto";

export const ROLE_INSPECTOR = "inspector";
export const ROLE_SUPERVISOR = "supervisor";
export const ROLE_ADMIN = "admin";
export const VALID_ROLES = Object.freeze([ROLE_INSPECTOR, ROLE_SUPERVISOR, ROLE_ADMIN]);

export class AuthenticationError extends Error {
  constructor(message, code = "INVALID_TOKEN", statusCode = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthorizationError extends Error {
  constructor(message, code = "FORBIDDEN", statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Base64URL encode a buffer or UTF-8 string.
 */
function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

/**
 * Base64URL decode to UTF-8 string.
 */
function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

/**
 * Creates a signed JWT using HMAC-SHA256.
 * Intended for test fixtures and token generation.
 */
export function createToken(claims, secret, options = {}) {
  if (!secret || typeof secret !== "string") {
    throw new Error("Secret must be a non-empty string");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresInSec = options.expiresInSec ?? 3600; // 1 hour default

  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const payload = {
    iat: nowSec,
    exp: nowSec + expiresInSec,
    iss: options.issuer || process.env.AUTH_ISSUER || "quillgrade-auth",
    aud: options.audience || process.env.AUTH_AUDIENCE || "cinnasense-api",
    ...claims
  };

  if (!payload.sub && !payload.uid) {
    throw new Error("Claims must include a subject identifier ('sub' or 'uid')");
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

/**
 * Verifies a JWT token using HMAC-SHA256 with timing-safe comparison.
 * Rejects missing, malformed, expired, invalidly signed, or algorithmic bypass attempts.
 */
export function verifyToken(token, options = {}) {
  if (!token || typeof token !== "string") {
    throw new AuthenticationError("Authentication token is required", "MISSING_TOKEN", 401);
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new AuthenticationError("Malformed token structure", "MALFORMED_TOKEN", 401);
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // 1. Decode and validate header
  let header;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch {
    throw new AuthenticationError("Invalid token header format", "MALFORMED_TOKEN", 401);
  }

  // Strictly enforce algorithm; never allow "none" or asymmetric confusion
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    throw new AuthenticationError("Unsupported or invalid token algorithm", "INVALID_ALGORITHM", 401);
  }

  // 2. Resolve verification secret
  const secret = options.secret || process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    // Fail-closed by default: deny access if verification key is not configured
    throw new AuthenticationError(
      "Authentication service unavailable: verification key not configured",
      "AUTH_NOT_CONFIGURED",
      500
    );
  }

  // 3. Timing-safe signature verification
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new AuthenticationError("Invalid token signature", "INVALID_SIGNATURE", 401);
  }

  // 4. Decode payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new AuthenticationError("Invalid token payload format", "MALFORMED_TOKEN", 401);
  }

  // 5. Expiration validation
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new AuthenticationError("Authentication token has expired", "TOKEN_EXPIRED", 401);
  }

  // 6. Not-before (nbf) check
  if (typeof payload.nbf === "number" && payload.nbf > nowSec) {
    throw new AuthenticationError("Token is not active yet", "TOKEN_NOT_ACTIVE", 401);
  }

  // 7. Issuer validation (if configured)
  const expectedIssuer = options.issuer || process.env.AUTH_ISSUER;
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new AuthenticationError("Untrusted token issuer", "INVALID_ISSUER", 401);
  }

  // 8. Audience validation (if configured)
  const expectedAudience = options.audience || process.env.AUTH_AUDIENCE;
  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new AuthenticationError("Invalid token audience", "INVALID_AUDIENCE", 401);
  }

  // 9. Subject validation
  const uid = payload.sub || payload.uid;
  if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
    throw new AuthenticationError("Token subject (uid) is missing", "INVALID_SUBJECT", 401);
  }

  return payload;
}

/**
 * Normalizes verified token claims into a standard authenticated user identity context.
 */
export function extractUserIdentity(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AuthenticationError("Invalid token claims", "INVALID_CLAIMS", 401);
  }

  const uid = (payload.sub || payload.uid || "").trim();
  const rawRole = (payload.role || ROLE_INSPECTOR).trim().toLowerCase();
  const role = VALID_ROLES.includes(rawRole) ? rawRole : ROLE_INSPECTOR;

  const rawOrg = payload.orgId || payload.organizationId;
  const organizationId = rawOrg ? String(rawOrg).trim() : null;
  const email = payload.email ? String(payload.email).trim() : null;

  return Object.freeze({
    uid,
    role,
    organizationId,
    email,
    claims: payload
  });
}

/**
 * Authorization policy: checks if an authenticated user can read/access a specific grading record.
 * Denies access by default.
 */
export function canAccessRecord(user, record) {
  if (!user || !user.uid || !user.role) {
    return { allowed: false, code: "UNAUTHENTICATED", reason: "User context is required" };
  }
  if (!record) {
    return { allowed: false, code: "NOT_FOUND", reason: "Record not found" };
  }

  // Admin has global audit access
  if (user.role === ROLE_ADMIN) {
    return { allowed: true };
  }

  // Supervisor: permitted to view records in their organization only
  if (user.role === ROLE_SUPERVISOR) {
    if (!user.organizationId) {
      return {
        allowed: false,
        code: "SUPERVISOR_NO_ORG",
        reason: "Supervisor is not assigned to any organization"
      };
    }
    if (record.organizationId !== user.organizationId) {
      return {
        allowed: false,
        code: "CROSS_ORGANIZATION_DENIED",
        reason: "Access denied: record belongs to a different organization"
      };
    }
    return { allowed: true };
  }

  // Inspector: permitted to view own records only
  if (user.role === ROLE_INSPECTOR) {
    if (record.ownerId !== user.uid) {
      return {
        allowed: false,
        code: "CROSS_OWNER_DENIED",
        reason: "Access denied: record belongs to a different inspector"
      };
    }
    return { allowed: true };
  }

  return { allowed: false, code: "DENY_BY_DEFAULT", reason: "Access denied by default policy" };
}

/**
 * Authorization policy: checks if an authenticated user can ingest a sample record.
 * Never trusts ownerId submitted in payload.
 */
export function canIngestRecord(user, payload) {
  if (!user || !user.uid || !user.role) {
    return { allowed: false, code: "UNAUTHENTICATED", reason: "User context is required" };
  }

  // Only inspectors and admins can submit samples
  if (user.role !== ROLE_INSPECTOR && user.role !== ROLE_ADMIN) {
    return {
      allowed: false,
      code: "ROLE_NOT_AUTHORIZED_FOR_INGESTION",
      reason: `Role '${user.role}' is not authorized to submit grading samples`
    };
  }

  // If a payload specifies an ownerId, it MUST match the authenticated user's uid
  const submittedOwner = payload?.ownerId ? String(payload.ownerId).trim() : null;
  if (submittedOwner && submittedOwner !== user.uid && user.role !== ROLE_ADMIN) {
    return {
      allowed: false,
      code: "CROSS_OWNER_SPOOFING_DENIED",
      reason: `Forbidden: authenticated user '${user.uid}' cannot submit records on behalf of '${submittedOwner}'`
    };
  }

  return { allowed: true };
}

/**
 * Builds a query scope filter for retrieving samples based on user role and identity.
 * Denies access by default.
 */
export function buildRecordScope(user) {
  if (!user || !user.uid) {
    throw new AuthorizationError("Authenticated user context is required to build query scope");
  }

  if (user.role === ROLE_ADMIN) {
    return {}; // All records
  }

  if (user.role === ROLE_SUPERVISOR) {
    if (!user.organizationId) {
      throw new AuthorizationError(
        "Supervisor is not assigned to an organization",
        "SUPERVISOR_NO_ORG"
      );
    }
    return { organizationId: user.organizationId };
  }

  if (user.role === ROLE_INSPECTOR) {
    return { ownerId: user.uid };
  }

  throw new AuthorizationError("Access denied by default", "DENY_BY_DEFAULT");
}

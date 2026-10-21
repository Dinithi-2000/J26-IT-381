import {
  verifyToken,
  extractUserIdentity,
  canIngestRecord,
  ROLE_INSPECTOR,
  ROLE_SUPERVISOR,
  ROLE_ADMIN
} from "../services/authService.js";

/**
 * Express middleware to authenticate requests using Bearer JWT tokens.
 * Denies access by default if token is missing, invalid, or expired.
 */
export function authenticate(options = {}) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: {
          code: "MISSING_TOKEN",
          message: "Authorization header with Bearer token is required"
        }
      });
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      return res.status(401).json({
        error: {
          code: "MALFORMED_TOKEN",
          message: "Authorization header must use format 'Bearer <token>'"
        }
      });
    }

    const token = match[1].trim();

    try {
      const claims = verifyToken(token, options);
      const user = extractUserIdentity(claims);

      // Attach verified identity context to request
      req.user = user;
      req.auth = {
        token,
        claims
      };

      return next();
    } catch (err) {
      const statusCode = err.statusCode || 401;
      const code = err.code || "AUTHENTICATION_FAILED";
      return res.status(statusCode).json({
        error: {
          code,
          message: err.message
        }
      });
    }
  };
}

/**
 * Express middleware to restrict access to specific roles.
 * Admins are permitted by default unless explicitly restricted.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required before role check"
        }
      });
    }

    const userRole = req.user.role;
    if (allowedRoles.includes(userRole) || userRole === ROLE_ADMIN) {
      return next();
    }

    return res.status(403).json({
      error: {
        code: "FORBIDDEN_ROLE",
        message: `Role '${userRole}' is not authorized to access this resource`
      }
    });
  };
}

/**
 * Shorthand middleware for inspector access (mobile field agents).
 */
export const requireInspector = requireRole(ROLE_INSPECTOR, ROLE_ADMIN);

/**
 * Shorthand middleware for supervisor access (dashboard managers/auditors).
 */
export const requireSupervisor = requireRole(ROLE_SUPERVISOR, ROLE_ADMIN);

/**
 * Express middleware to prevent cross-owner spoofing during sample ingestion.
 * Ensures the record is stamped with the verified user UID and not a forged ownerId.
 */
export function enforceIngestionOwnership(req, res, next) {
  if (!req.user || !req.user.uid) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required to submit grading samples"
      }
    });
  }

  const check = canIngestRecord(req.user, req.body);
  if (!check.allowed) {
    return res.status(403).json({
      error: {
        code: check.code,
        message: check.reason
      }
    });
  }

  // Stamp request with verified owner identity
  req.authenticatedOwnerId = req.user.uid;
  next();
}

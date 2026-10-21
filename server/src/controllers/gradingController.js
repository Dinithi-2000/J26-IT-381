import { GradingSample } from "../models/GradingSample.js";
import { isDatabaseConnected } from "../config/db.js";
import {
  validateAndMapGradingPayload,
  toDashboardRecord,
  GradingValidationError
} from "../services/gradingValidationService.js";
import {
  canAccessRecord,
  buildRecordScope,
  ROLE_INSPECTOR,
  ROLE_SUPERVISOR,
  ROLE_ADMIN
} from "../services/authService.js";

/**
 * Escape string for safe use in RegExp to prevent ReDoS.
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * POST /api/grading/sync
 * Ingests or idempotently updates a grading sample from an authenticated inspector.
 */
export async function syncSample(req, res, next) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database service is currently unavailable. Please retry later."
      }
    });
  }

  // 1. Validate payload and map to canonical attributes
  let canonical;
  try {
    canonical = validateAndMapGradingPayload(req.body, req.authenticatedOwnerId);
  } catch (err) {
    if (err instanceof GradingValidationError) {
      return res.status(400).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        }
      });
    }
    return next(err);
  }

  try {
    // 2. Check for existing record by immutable mobileSampleUuid
    const existing = await GradingSample.findOne({
      mobileSampleUuid: canonical.mobileSampleUuid
    });

    if (existing) {
      // Cross-owner overwrite protection
      if (existing.ownerId !== req.authenticatedOwnerId && req.user.role !== ROLE_ADMIN) {
        return res.status(403).json({
          error: {
            code: "CROSS_OWNER_OVERWRITE_DENIED",
            message: "Forbidden: sample UUID is already registered to a different owner"
          }
        });
      }

      // Revision handling: reject older revisions
      if (canonical.syncRevision < existing.syncRevision) {
        return res.status(409).json({
          error: {
            code: "REVISION_CONFLICT",
            message: `Conflict: incoming revision ${canonical.syncRevision} is older than stored revision ${existing.syncRevision}`
          }
        });
      }

      // Idempotent duplicate: exact same revision already saved
      if (canonical.syncRevision === existing.syncRevision) {
        return res.status(200).json({
          status: "acknowledged",
          action: "idempotent_duplicate",
          receipt: {
            mobileSampleUuid: existing.mobileSampleUuid,
            sampleId: existing.sampleId,
            ownerId: existing.ownerId,
            serverReceiptTimestamp: existing.serverReceiptTimestamp.toISOString(),
            revision: existing.syncRevision
          }
        });
      }

      // Legitimate newer revision: update permitted mutable fields only
      existing.predictedGrade = canonical.predictedGrade;
      existing.expertGrade = canonical.expertGrade;
      existing.confidence = canonical.confidence;
      existing.rawProbability = canonical.rawProbability;
      existing.diameterMm = canonical.diameterMm;
      existing.diameterSource = canonical.diameterSource;
      existing.photoReferences = canonical.photoReferences;
      existing.needsReview = canonical.needsReview;
      existing.syncRevision = canonical.syncRevision;
      existing.serverReceiptTimestamp = new Date();

      await existing.save();

      return res.status(200).json({
        status: "acknowledged",
        action: "updated",
        receipt: {
          mobileSampleUuid: existing.mobileSampleUuid,
          sampleId: existing.sampleId,
          ownerId: existing.ownerId,
          serverReceiptTimestamp: existing.serverReceiptTimestamp.toISOString(),
          revision: existing.syncRevision
        }
      });
    }

    // 3. Create new document
    const created = await GradingSample.create({
      ...canonical,
      ownerId: req.authenticatedOwnerId,
      serverReceiptTimestamp: new Date()
    });

    return res.status(201).json({
      status: "acknowledged",
      action: "created",
      receipt: {
        mobileSampleUuid: created.mobileSampleUuid,
        sampleId: created.sampleId,
        ownerId: created.ownerId,
        serverReceiptTimestamp: created.serverReceiptTimestamp.toISOString(),
        revision: created.syncRevision
      }
    });
  } catch (err) {
    // Handle concurrent duplicate key race condition (E11000)
    if (err.code === 11000) {
      try {
        const winner = await GradingSample.findOne({
          mobileSampleUuid: canonical.mobileSampleUuid
        });
        if (winner && winner.ownerId === req.authenticatedOwnerId) {
          return res.status(200).json({
            status: "acknowledged",
            action: "idempotent_duplicate",
            receipt: {
              mobileSampleUuid: winner.mobileSampleUuid,
              sampleId: winner.sampleId,
              ownerId: winner.ownerId,
              serverReceiptTimestamp: winner.serverReceiptTimestamp.toISOString(),
              revision: winner.syncRevision
            }
          });
        }
      } catch {
        // Fall through to standard error handler
      }
    }
    return next(err);
  }
}

/**
 * GET /api/grading
 * Lists grading records scoped strictly to the caller's organization / authorization.
 */
export async function listSamples(req, res, next) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database service is currently unavailable. Please retry later."
      }
    });
  }

  try {
    const scope = buildRecordScope(req.user);

    // Safe model filter
    if (req.query.model === "4-CLASS") {
      scope.modelType = "4-Class Image-Only";
    } else if (req.query.model === "7-CLASS") {
      scope.modelType = "7-Class Hybrid";
    }

    // Safe grade filter
    if (req.query.grade && req.query.grade !== "ALL") {
      scope.predictedGrade = String(req.query.grade).trim();
    }

    // Safe date filter
    const now = Date.now();
    if (req.query.date === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      scope.captureTimestamp = { $gte: startOfToday };
    } else if (req.query.date === "7days") {
      scope.captureTimestamp = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
    } else if (req.query.date === "30days") {
      scope.captureTimestamp = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
    }

    // Safe search filter (sampleId code)
    if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
      const cleanSearch = escapeRegex(req.query.search.trim());
      scope.sampleId = { $regex: cleanSearch, $options: "i" };
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    // Sorting
    let sort = { captureTimestamp: -1 };
    if (req.query.sortBy === "oldest") {
      sort = { captureTimestamp: 1 };
    } else if (req.query.sortBy === "confidence-desc") {
      sort = { confidence: -1 };
    } else if (req.query.sortBy === "confidence-asc") {
      sort = { confidence: 1 };
    } else if (req.query.sortBy === "diameter-desc") {
      sort = { diameterMm: -1 };
    }

    const [docs, total] = await Promise.all([
      GradingSample.find(scope).sort(sort).skip(skip).limit(limit),
      GradingSample.countDocuments(scope)
    ]);

    const records = docs.map(toDashboardRecord);

    res.setHeader("X-Total-Count", total);
    res.setHeader("X-Page", page);
    res.setHeader("X-Limit", limit);

    // Returns an Array directly for 100% compatibility with gradingService.js
    return res.json(records);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/grading/sync-status
 * Returns persisted server sync status and counts scoped to the caller.
 * Note: Must be registered BEFORE GET /api/grading/:id.
 */
export async function getSyncStatus(req, res, next) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database service is currently unavailable. Please retry later."
      }
    });
  }

  try {
    const scope = buildRecordScope(req.user);

    const [total, latest] = await Promise.all([
      GradingSample.countDocuments(scope),
      GradingSample.findOne(scope).sort({ captureTimestamp: -1 })
    ]);

    return res.json({
      status: "ready",
      callerRole: req.user.role,
      organizationId: req.user.organizationId || null,
      totalRecords: total,
      lastSyncTimestamp: latest?.serverReceiptTimestamp?.toISOString() || null,
      latestSampleId: latest?.sampleId || null
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/grading/:id
 * Fetches a single grading sample by sampleId or mobileSampleUuid.
 * Returns 404 if not found or unauthorized to prevent data enumeration.
 */
export async function getSampleById(req, res, next) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database service is currently unavailable. Please retry later."
      }
    });
  }

  const idParam = String(req.params.id || "").trim();
  if (!idParam) {
    return res.status(400).json({
      error: {
        code: "INVALID_ID",
        message: "Sample ID parameter is required"
      }
    });
  }

  try {
    // Find by sampleId or mobileSampleUuid
    const doc = await GradingSample.findOne({
      $or: [{ sampleId: idParam }, { mobileSampleUuid: idParam.toLowerCase() }]
    });

    if (!doc) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grading record not found"
        }
      });
    }

    // Authorization check
    const authCheck = canAccessRecord(req.user, doc);
    if (!authCheck.allowed) {
      // Return 404 to prevent resource enumeration across organizations/owners
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Grading record not found"
        }
      });
    }

    return res.json(toDashboardRecord(doc));
  } catch (err) {
    return next(err);
  }
}

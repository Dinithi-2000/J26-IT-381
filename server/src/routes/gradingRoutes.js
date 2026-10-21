import { Router } from "express";
import {
  syncSample,
  listSamples,
  getSyncStatus,
  getSampleById
} from "../controllers/gradingController.js";
import {
  authenticate,
  requireInspector,
  requireSupervisor,
  enforceIngestionOwnership
} from "../middleware/authMiddleware.js";

const router = Router();

// Apply authentication to all grading routes by default (deny unauthenticated by default)
router.use(authenticate());

/**
 * POST /api/grading/sync
 * Ingests a validated grading sample from an authenticated inspector.
 * Enforces verified owner identity and idempotent write semantics.
 */
router.post("/sync", requireInspector, enforceIngestionOwnership, syncSample);

/**
 * GET /api/grading/sync-status
 * Returns persisted sync metrics scoped to the authenticated caller.
 * Note: Must be registered before GET /:id.
 */
router.get("/sync-status", getSyncStatus);

/**
 * GET /api/grading
 * Returns list of grading records scoped to supervisor's organization or admin.
 */
router.get("/", requireSupervisor, listSamples);

/**
 * GET /api/grading/:id
 * Fetches a single sample by human-readable sampleId or UUID.
 * Returns 404 for inaccessible or non-existent samples.
 */
router.get("/:id", getSampleById);

export default router;

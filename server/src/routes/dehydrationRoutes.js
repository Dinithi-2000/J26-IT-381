import { Router } from "express";

import {
  createTelemetry,
  getLatestTelemetry,
  getBatchTelemetry
} from "../controllers/dehydrationController.js";

const router = Router();


// ESP32 sends data here
router.post(
  "/telemetry",
  createTelemetry
);


// Dashboard reads current values here
router.get(
  "/live",
  getLatestTelemetry
);


// Historical graph/session
router.get(
  "/sessions/:batchId",
  getBatchTelemetry
);


export default router;
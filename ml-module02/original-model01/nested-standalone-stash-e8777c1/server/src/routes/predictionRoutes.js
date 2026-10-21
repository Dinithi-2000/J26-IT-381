import { Router } from "express";
import {
  createPrediction,
  listPredictions
} from "../controllers/predictionController.js";

const router = Router();
router.get("/", listPredictions);
router.post("/", createPrediction);

export default router;

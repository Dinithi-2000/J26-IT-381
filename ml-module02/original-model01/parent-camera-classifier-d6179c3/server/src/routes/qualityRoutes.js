import express, { Router } from "express";
import multer from "multer";
import { maxImageBytes, qualityUploadDirectory } from "../config/qualityStorage.js";
import { createQualityController } from "../controllers/qualityController.js";
import { deviceAuth, operatorAuth } from "../module02/auth.js";

// Module 02 / Model 01 image analysis. Parsers are created on first use so limits
// and folders configured in server/.env (loaded after imports) take effect.
let multipartUpload;
let rawImageBody;
let staticImages;

function receiveImage(request, response, next) {
  multipartUpload ??= multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxImageBytes(), files: 1, fields: 10 }
  }).single("image");
  rawImageBody ??= express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "application/octet-stream"],
    limit: maxImageBytes()
  });

  const done = (error) => {
    if (!error) return next();
    const megabytes = Math.round(maxImageBytes() / 1024 / 1024);
    if (error.code === "LIMIT_FILE_SIZE" || error.type === "entity.too.large") {
      return response.status(413).json({
        error: { code: "IMAGE_TOO_LARGE", message: `Images must be ${megabytes} MB or smaller.` }
      });
    }
    if (error instanceof multer.MulterError) {
      return response.status(400).json({
        error: { code: "INVALID_UPLOAD", message: "Send one photo in a form field named 'image'." }
      });
    }
    return next(error);
  };

  if (request.is("multipart/form-data")) return multipartUpload(request, response, done);
  return rawImageBody(request, response, done);
}

function serveImages(request, response, next) {
  staticImages ??= express.static(qualityUploadDirectory(), {
    index: false,
    dotfiles: "deny",
    immutable: true,
    maxAge: "7d"
  });
  return staticImages(request, response, next);
}

// Writes need credentials, checked before the body is read: the browser sends the
// Module 02 operator token, the ESP32-CAM sends X-Device-Id/X-Device-Key.
function requireWriter(request, response, next) {
  try {
    if (request.get("x-device-id")) {
      deviceAuth(request, response, () => {});
      request.uploadSource = "esp32-cam";
    } else {
      operatorAuth(request, response, () => {});
      request.uploadSource = "upload";
    }
  } catch (error) {
    return response.status(error.status || 401).json({
      error: { code: error.code || "UNAUTHORIZED", message: error.message }
    });
  }
  return next();
}

export function createQualityRouter(dependencies = {}) {
  const { getModelInfo, classifyImage, listAnalyses } = createQualityController(dependencies);
  const router = Router();
  router.get("/model-info", getModelInfo);
  router.get("/analyses", listAnalyses);
  router.post("/classify", requireWriter, receiveImage, classifyImage);
  router.use("/images", serveImages);
  return router;
}

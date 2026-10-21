import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDatabaseConnected } from "../config/db.js";
import { qualityUploadDirectory } from "../config/qualityStorage.js";
import { ImageAnalysis as ImageAnalysisModel } from "../models/ImageAnalysis.js";
import { Sample as SampleModel } from "../module02/models.js";
import { id } from "../module02/validation.js";
import { classifyQualityImage, getQualityModelInfo } from "../services/qualityMlService.js";

function sendError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function databaseUnavailable(response) {
  return sendError(response, 503, "DATABASE_UNAVAILABLE",
    "MongoDB is unavailable. Start MongoDB or configure server/.env with a MongoDB Atlas URI.");
}

// Decide the image type from its first bytes rather than trusting the client.
function detectImageType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

function toResponse(document) {
  const analysis = document.toObject();
  return {
    id: analysis._id,
    sampleId: analysis.sampleId,
    source: analysis.source,
    deviceId: analysis.deviceId ?? null,
    predictedCondition: analysis.predictedCondition,
    predictedLabel: analysis.predictedLabel,
    modelScore: analysis.modelScore,
    topPredictions: analysis.topPredictions,
    suspectedMold: analysis.suspectedMold,
    note: analysis.note,
    analysisStatus: analysis.analysisStatus,
    analysedAt: analysis.analysedAt,
    modelVersion: analysis.modelVersion,
    image: {
      url: `/api/quality/images/${encodeURIComponent(analysis.image.fileName)}`,
      originalName: analysis.image.originalName,
      width: analysis.image.width,
      height: analysis.image.height,
      sizeBytes: analysis.image.sizeBytes,
      sha256: analysis.image.sha256
    },
    record: { saved: true, id: analysis._id }
  };
}

// Dependencies are injectable so HTTP behaviour can be tested without MongoDB or the ML service.
export function createQualityController({
  Sample = SampleModel,
  ImageAnalysis = ImageAnalysisModel,
  classify = classifyQualityImage,
  modelInfo = getQualityModelInfo,
  databaseReady = isDatabaseConnected
} = {}) {
  async function getModelInfo(_request, response, next) {
    try {
      return response.json(await modelInfo());
    } catch (error) {
      if (error.status) return sendError(response, error.status, error.code, error.message);
      return next(error);
    }
  }

  // Requires authentication (see qualityRoutes.js); request.uploadSource and request.deviceId are set there.
  async function classifyImage(request, response, next) {
    // Browser uploads arrive as multipart (field "image"); the ESP32-CAM can POST raw JPEG bytes.
    const rawBody = Buffer.isBuffer(request.body) ? request.body : null;
    const buffer = request.file?.buffer || (rawBody?.length ? rawBody : null);
    if (!buffer) {
      return sendError(response, 400, "IMAGE_REQUIRED",
        "Attach a photo as the 'image' field of a multipart form, or POST the JPEG bytes directly.");
    }
    const type = detectImageType(buffer);
    if (!type) return sendError(response, 415, "UNSUPPORTED_IMAGE_TYPE", "Use a JPEG, PNG or WebP image.");

    // Every analysis must belong to a registered, active sample so predictions stay traceable.
    const fields = { ...request.query, ...(rawBody || !request.body ? {} : request.body) };
    let sampleId;
    try {
      sampleId = id(fields.sampleId);
    } catch (error) {
      return sendError(response, 400, "INVALID_SAMPLE_ID", "A registered sampleId is required (2-64 letters, digits, '_' or '-').");
    }
    if (!databaseReady()) return databaseUnavailable(response);
    try {
      const sample = await Sample.findOne({ sampleId });
      if (!sample) return sendError(response, 404, "SAMPLE_NOT_FOUND", `Sample ${sampleId} is not registered. Register it first.`);
      if (sample.archivedAt) return sendError(response, 409, "SAMPLE_ARCHIVED", "Archived samples cannot receive new analyses.");
    } catch {
      return databaseUnavailable(response);
    }

    let result;
    try {
      result = await classify({ buffer, mimeType: type.mimeType, fileName: `upload.${type.extension}`, sampleId });
    } catch (error) {
      if (error.status) return sendError(response, error.status, error.code, error.message);
      return next(error);
    }

    const fileName = `${randomUUID()}.${type.extension}`;
    const directory = qualityUploadDirectory();
    const filePath = join(directory, fileName);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, buffer, { flag: "wx" });
      const document = await ImageAnalysis.create({
        sampleId,
        source: request.uploadSource,
        deviceId: request.deviceId ?? null,
        predictedCondition: result.predictedCondition,
        predictedLabel: result.predictedLabel,
        modelScore: result.modelScore,
        topPredictions: result.topPredictions,
        suspectedMold: result.suspectedMold,
        note: result.note,
        analysisStatus: result.analysisStatus,
        analysedAt: new Date(result.analysedAt),
        modelVersion: result.modelVersion,
        image: {
          fileName,
          originalName: request.file?.originalname,
          mimeType: type.mimeType,
          sizeBytes: buffer.length,
          width: result.image?.width,
          height: result.image?.height,
          sha256: createHash("sha256").update(buffer).digest("hex")
        }
      });
      return response.status(201).json(toResponse(document));
    } catch (error) {
      await rm(filePath, { force: true });
      return next(error);
    }
  }

  async function listAnalyses(request, response, next) {
    if (!databaseReady()) return databaseUnavailable(response);
    const filter = {};
    if (typeof request.query.sampleId === "string" && request.query.sampleId.trim()) {
      filter.sampleId = request.query.sampleId.trim();
    }
    const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 20, 1), 100);
    try {
      const documents = await ImageAnalysis.find(filter).sort({ analysedAt: -1, _id: -1 }).limit(limit);
      return response.json(documents.map(toResponse));
    } catch (error) {
      return next(error);
    }
  }

  return { getModelInfo, classifyImage, listAnalyses };
}

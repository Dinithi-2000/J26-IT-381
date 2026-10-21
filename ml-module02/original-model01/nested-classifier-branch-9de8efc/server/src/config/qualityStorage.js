import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Read lazily: server/.env is loaded after modules are imported.
export function qualityUploadDirectory() {
  return resolve(serverRoot, process.env.QUALITY_UPLOAD_DIR || "uploads/quality");
}

export function maxImageBytes() {
  const megabytes = Number(process.env.QUALITY_MAX_IMAGE_MB) || 15;
  return megabytes * 1024 * 1024;
}

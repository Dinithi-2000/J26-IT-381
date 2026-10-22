import { createHash, timingSafeEqual } from 'node:crypto';
import { fail, id } from './validation.js';
const matches = (a,b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export function operatorAuth(req, _res, next) {
  const secret = process.env.MODULE02_OPERATOR_TOKEN;
  if (!secret || secret.length < 32) fail(503,'AUTH_UNCONFIGURED','Configure a Module 02 operator token of at least 32 characters.');
  const token = req.get('authorization')?.replace(/^Bearer /,'') || '';
  if (!matches(token,secret)) fail(401,'UNAUTHORIZED','A valid operator bearer token is required.');
  next();
}
export function deviceAuth(req, _res, next) {
  const deviceId = id(req.get('x-device-id'),'deviceId');
  let registry;
  try { registry = JSON.parse(process.env.MODULE02_DEVICE_KEYS || '{}'); } catch { fail(503,'AUTH_UNCONFIGURED','Device authentication is not configured correctly.'); }
  if (!registry || typeof registry !== 'object' || Array.isArray(registry) || !Object.keys(registry).length) fail(503,'AUTH_UNCONFIGURED','Configure Module 02 device keys.');
  const secret = Object.hasOwn(registry,deviceId) ? registry[deviceId] : null;
  if (typeof secret !== 'string' || secret.length < 32 || !matches(req.get('x-device-key') || '',secret)) fail(401,'UNAUTHORIZED','Invalid device credentials.');
  req.deviceId = deviceId; next();
}
// Manual photo uploads from this computer may skip the operator token when
// MODULE02_LOCAL_UPLOADS_WITHOUT_TOKEN=true. Requests from other devices still need it.
export function localUploadAllowed(req) {
  if (process.env.MODULE02_LOCAL_UPLOADS_WITHOUT_TOKEN !== 'true') return false;
  if (req.get('authorization') || req.get('x-device-id') || req.get('x-forwarded-for')) return false;
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
}
export function operatorOrLocalUpload(req, res, next) {
  if (localUploadAllowed(req)) return next();
  return operatorAuth(req, res, next);
}

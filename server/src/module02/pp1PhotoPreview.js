import express, {Router} from 'express';
import {operatorOrLocalUpload} from './auth.js';
import {verifyPp1Connection} from './pp1Dataset.js';
import {imageService, ImageServiceError, validateResult} from '../module02-image/service.js';

// Preview is independent of database storage. No image or sample is saved.
export function createPhotoPreviewRouter({service = imageService, verifyTarget = () => {}} = {}) {
  const router = Router();
  router.get('/status', async (_req, res) => {
    verifyTarget();
    res.json({...await service('/health'), previewAvailable: true});
  });
  router.post('/preview', operatorOrLocalUpload, express.raw({type: ['image/jpeg', 'image/png'], limit: '5mb'}), async (req, res) => {
    verifyTarget();
    const bytes = req.body;
    const png = req.is('image/png') && Buffer.isBuffer(bytes) && bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = req.is('image/jpeg') && Buffer.isBuffer(bytes) && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
    if (!png && !jpeg) return res.status(415).json({error: {code: 'INVALID_IMAGE', message: 'Supply a binary JPEG or PNG photograph.'}});
    const result = validateResult(await service('/classify', {bytes, contentType: png ? 'image/png' : 'image/jpeg', source: 'manual_upload'}));
    res.set('Cache-Control', 'no-store').json({...result, previewOnly: true, analysisStatus: 'completed', source: 'manual_upload'});
  });
  router.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({error: {code: 'UPLOAD_TOO_LARGE', message: 'Maximum image size is 5 MiB.'}});
    if (error instanceof ImageServiceError) return res.status(error.status).json({error: {code: error.code, message: error.message}});
    const status = error.status || 503;
    res.status(status).json({error: {code: status === 401 ? 'UNAUTHORIZED' : 'PHOTO_PREVIEW_UNAVAILABLE', message: status === 401 ? 'A valid operator token is required.' : 'Photo preview is unavailable.'}});
  });
  return router;
}

// Retain the original local runner's database guard for historical tooling.
export function createPp1PhotoPreviewRouter({service = imageService, verifyTarget = verifyPp1Connection} = {}) {
  return createPhotoPreviewRouter({service, verifyTarget});
}

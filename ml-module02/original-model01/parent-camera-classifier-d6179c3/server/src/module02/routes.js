import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as models from './models.js';
import { isDatabaseConnected } from '../config/db.js';
import { operatorAuth, deviceAuth } from './auth.js';
import { fail, id, date, number, object, sampleInput, readingInput, pagination, dateFilter } from './validation.js';
export const uploadDirectory = () => resolve(process.env.MODULE02_UPLOAD_DIR || fileURLToPath(new URL('../../storage/module02', import.meta.url)));
const imageOutput = row => ({ ...row.toObject(), url: `/api/module-02/images/${row._id}/file` });
export function createModule02Router({ Sample = models.Sample, SensorReading = models.SensorReading, SampleImage = models.SampleImage, DegradationPrediction = models.DegradationPrediction, databaseReady = isDatabaseConnected } = {}) {
  const router = Router();
  router.use(['/samples','/module-02'],(_req,_res,next) => { if (!databaseReady()) fail(503,'DATABASE_UNAVAILABLE','Module 02 database is unavailable.'); next(); });
  const sample = async (sampleId, writable = false) => {
    const row = await Sample.findOne({ sampleId: id(sampleId) });
    if (!row) fail(404,'SAMPLE_NOT_FOUND','Sample does not exist.');
    if (writable && row.archivedAt) fail(409,'SAMPLE_ARCHIVED','Archived samples cannot receive updates or new measurements.');
    return row;
  };
  async function list(Model, filter, req, res, sort = 'recordedAt', transform = row => row, direction = -1) {
    const {page,limit} = pagination(req.query);
    const [data,total] = await Promise.all([Model.find(filter).sort({[sort]:direction,_id:direction}).skip((page-1)*limit).limit(limit),Model.countDocuments(filter)]);
    res.json({ data: data.map(transform), pagination: {page,limit,total,pages: Math.ceil(total/limit)} });
  }
  router.post('/samples',operatorAuth,async (req,res) => res.status(201).json(await Sample.create(sampleInput(req.body))));
  router.get('/samples',async (req,res) => {
    const filter = {};
    if (req.query.archived !== 'true') filter.archivedAt = null;
    if (req.query.batchId !== undefined) { if (typeof req.query.batchId !== 'string') fail(400,'VALIDATION_ERROR','Invalid batchId.'); filter.batchId = req.query.batchId; }
    await list(Sample,filter,req,res,'createdAt');
  });
  router.get('/samples/:sampleId',async (req,res) => res.json(await sample(req.params.sampleId)));
  router.patch('/samples/:sampleId',operatorAuth,async (req,res) => {
    const values = sampleInput(req.body,true);
    const row = await sample(req.params.sampleId,true); Object.assign(row,values); await row.save(); res.json(row);
  });
  router.delete('/samples/:sampleId',operatorAuth,async (req,res) => {
    const row = await sample(req.params.sampleId); row.archivedAt ||= new Date(); await row.save(); res.json(row);
  });
  router.post('/module-02/readings',deviceAuth,async (req,res) => {
    const values = readingInput(req.body);
    if (values.deviceId !== req.deviceId) fail(403,'DEVICE_MISMATCH','Payload deviceId must match authenticated device.');
    const row = await sample(values.sampleId,true);
    if (values.recordedAt < row.storageStartDate) fail(400,'VALIDATION_ERROR','Reading predates sample storage.');
    res.status(201).json(await SensorReading.create(values));
  });
  router.get('/module-02/readings/latest',async (req,res) => {
    const row = await sample(req.query.sampleId);
    const reading = await SensorReading.findOne({sampleId:row.sampleId}).sort({recordedAt:-1,_id:-1});
    const offlineAfterSeconds = Number(process.env.MODULE02_OFFLINE_SECONDS) || 300;
    const ageSeconds = reading ? Math.max(0,(Date.now()-reading.recordedAt.getTime())/1000) : null;
    res.json({ data: reading, deviceStatus: { status: ageSeconds !== null && ageSeconds <= offlineAfterSeconds ? 'recent' : 'offline', ageSeconds, offlineAfterSeconds, deviceId: reading?.deviceId || null } });
  });
  router.get('/module-02/samples/:sampleId/readings',async (req,res) => {
    if (req.query.order !== undefined && !['asc','desc'].includes(req.query.order)) fail(400,'VALIDATION_ERROR','order must be asc or desc.');
    const row = await sample(req.params.sampleId); await list(SensorReading,{sampleId:row.sampleId,...dateFilter(req.query)},req,res,'recordedAt',row=>row,req.query.order === 'asc' ? 1 : -1);
  });
  router.post('/module-02/images',deviceAuth,express.raw({type:['image/jpeg','image/png'],limit:'5mb'}),async (req,res) => {
    const row = await sample(req.query.sampleId,true);
    const recordedAt = date(req.query.recordedAt,'recordedAt');
    if (recordedAt < row.storageStartDate || recordedAt > new Date(Date.now()+300000)) fail(400,'VALIDATION_ERROR','Image timestamp is outside the allowed storage period.');
    const role = req.query.role || 'Current';
    if (!['Baseline','Current'].includes(role)) fail(400,'VALIDATION_ERROR','Invalid image role.');
    const bytes = req.body;
    const png = req.is('image/png') && Buffer.isBuffer(bytes) && bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(12,16).toString() === 'IHDR';
    const jpeg = req.is('image/jpeg') && Buffer.isBuffer(bytes) && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
    if (!png && !jpeg) fail(415,'INVALID_IMAGE','Supply a JPEG or PNG binary body with a matching Content-Type and file signature.');
    const filename = `${randomUUID()}.${png ? 'png' : 'jpg'}`;
    const destination = resolve(uploadDirectory(),filename);
    await mkdir(uploadDirectory(),{recursive:true});
    await writeFile(destination,bytes,{flag:'wx'});
    let image;
    try { image = await SampleImage.create({sampleId:row.sampleId,deviceId:req.deviceId,recordedAt,role,filename,contentType:png?'image/png':'image/jpeg',sizeBytes:bytes.length}); }
    catch (error) { await unlink(destination).catch(()=>{}); throw error; }
    res.status(201).json(imageOutput(image));
  });
  router.get('/module-02/samples/:sampleId/images',async (req,res) => {
    const row = await sample(req.params.sampleId); await list(SampleImage,{sampleId:row.sampleId,...dateFilter(req.query)},req,res,'recordedAt',imageOutput);
  });
  router.get('/module-02/images/:imageId/file',async (req,res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.imageId)) fail(400,'VALIDATION_ERROR','Invalid image ID.');
    const image = await SampleImage.findById(req.params.imageId);
    if (!image) fail(404,'IMAGE_NOT_FOUND','Image not found.');
    if (!/^[a-f0-9-]{36}\.(jpg|png)$/.test(image.filename)) fail(500,'STORAGE_ERROR','Invalid stored image reference.');
    let bytes;
    try { bytes = await readFile(resolve(uploadDirectory(),image.filename)); } catch (error) { if(error.code === 'ENOENT') fail(404,'IMAGE_FILE_NOT_FOUND','Image file is missing from storage.'); throw error; }
    res.set('Cache-Control','private, max-age=300').type(image.contentType).send(bytes);
  });
  router.get('/module-02/samples/:sampleId/predictions',async (req,res) => {
    const row = await sample(req.params.sampleId); await list(DegradationPrediction,{sampleId:row.sampleId,...dateFilter(req.query,'predictedAt')},req,res,'predictedAt');
  });
  router.post('/module-02/predict',operatorAuth,async (req,_res) => {
    object(req.body,['sampleId','horizonDays']); await sample(req.body.sampleId);
    const horizon = number(req.body.horizonDays,'horizonDays',1,365);
    if (!Number.isInteger(horizon)) fail(400,'VALIDATION_ERROR','horizonDays must be an integer.');
    fail(503,'MODEL_UNAVAILABLE','No trained and validated storage degradation model is integrated. No prediction was generated.');
  });
  router.use((error,_req,res,_next) => {
    let status = error.status || 500, code = error.code || 'INTERNAL_SERVER_ERROR', message = error.message;
    if(error.code === 11000) { status=409; code='DUPLICATE_RECORD'; message='A record with the same unique identifier (sample ID, device measurement ID or image filename) already exists.'; }
    else if(error.type === 'entity.too.large') { status=413; code='UPLOAD_TOO_LARGE'; message='Request exceeds the allowed size.'; }
    else if(error.name === 'ValidationError' || error.name === 'CastError') { status=400; code='VALIDATION_ERROR'; message='Invalid record values.'; }
    else if(error.name?.startsWith('Mongo') || error.name === 'MongooseError') { status=503; code='DATABASE_UNAVAILABLE'; message='Module 02 database operation failed.'; }
    res.status(status).json({error:{code:typeof code === 'string'?code:'INTERNAL_SERVER_ERROR',message:status===500?'An unexpected Module 02 error occurred.':message}});
  });
  return router;
}

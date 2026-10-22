import express,{Router} from 'express';
import mongoose from 'mongoose';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Sample} from '../module02/models.js';
import {ImageConditionAnalysis} from './model.js';
import {imageService,ImageServiceError} from './service.js';
import {createPhotoPreviewRouter} from '../module02/pp1PhotoPreview.js';
import {localUploadAllowed} from '../module02/auth.js';
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(value))fail(400,'VALIDATION_ERROR','Use a sample/device ID with 2-64 letters, digits, underscores or hyphens.');return value;};
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const directory=()=>resolve(process.env.MODULE02_IMAGE_UPLOAD_DIR||fileURLToPath(new URL('../../storage/module02-condition',import.meta.url)));
export function authorize(req,_res,next) {
 const bearer=req.get('authorization');
 if(bearer) {
  const secret=process.env.MODULE02_OPERATOR_TOKEN||'';
  if(secret.length<32)fail(503,'AUTH_UNCONFIGURED','Configure an operator token of at least 32 characters.');
  if(!bearer.startsWith('Bearer ')||!equal(bearer.slice(7),secret))fail(401,'UNAUTHORIZED','Invalid operator token.');
 }else{
  const deviceId=id(req.get('x-device-id'));let registry;
  try{registry=JSON.parse(process.env.MODULE02_DEVICE_KEYS||'{}');}catch{fail(503,'AUTH_UNCONFIGURED','Device key registry is invalid.');}
  if(!registry||typeof registry!=='object'||Array.isArray(registry))fail(503,'AUTH_UNCONFIGURED','Device key registry is invalid.');
  const key=Object.hasOwn(registry,deviceId)?registry[deviceId]:null;
  if(typeof key!=='string'||key.length<32||!equal(req.get('x-device-key')||'',key))fail(401,'UNAUTHORIZED','Invalid device credentials.');
  req.deviceId=deviceId;
 }
 next();
}
const output=row=>{const value=row.toObject();delete value.filename;return {...value,imageUrl:`/api/module-02/image-classification/${row._id}/file`};};
export function createImageRouter({Model=ImageConditionAnalysis,databaseReady=()=>mongoose.connection.readyState===1,service=imageService,SampleModel=Sample}={}) {
 const router=Router();
 router.use(createPhotoPreviewRouter({service}));
 const operatorOnly=(req,res,next)=>localUploadAllowed(req)?next():authorize(req,res,()=>{if(req.deviceId)fail(403,'FORBIDDEN','Use an operator token for camera controls.');next();});
 router.get('/camera/status',operatorOnly,async(_req,res)=>res.json(await service('/camera/status')));
 router.use((_req,_res,next)=>{if(!databaseReady())fail(503,'DATABASE_UNAVAILABLE','MongoDB is required to store and retrieve sample images.');next();});
 async function analyze(row,bytes) {
  for(const field of ['predictedCondition','modelScore','scores','modelVersion','analyzedAt']) row[field]=undefined;
  try {const result=await service('/classify',{bytes,contentType:row.contentType,source:row.source || 'manual_upload'});Object.assign(row,result,{analysisStatus:'completed',errorCode:undefined});}
  catch(error){if(!(error instanceof ImageServiceError))throw error;row.analysisStatus=['MODEL_UNAVAILABLE','IMAGE_SERVICE_UNAVAILABLE','AUTH_UNCONFIGURED'].includes(error.code)?'model_unavailable':'failed';row.errorCode=error.code;}
  await row.save();return row;
 }
 async function registeredSample(sampleId) {
  const sample=await SampleModel.findOne({sampleId});
  if(!sample)fail(404,'SAMPLE_NOT_FOUND','Register this cinnamon sample before capturing or uploading images.');
  if(sample.archivedAt)fail(409,'SAMPLE_ARCHIVED','Archived samples cannot receive new images.');
 }
 async function persist({sampleId,bytes,contentType,capturedAt,source,deviceId}) {
  const png=contentType==='image/png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR';
  const jpeg=contentType==='image/jpeg'&&bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
  if(!png&&!jpeg)fail(415,'INVALID_IMAGE','JPEG/PNG content type and file signature must match.');
  const filename=`${randomUUID()}.${png?'png':'jpg'}`;await mkdir(directory(),{recursive:true});
  await writeFile(resolve(directory(),filename),bytes,{flag:'wx'});let row;
  try{row=await Model.create({sampleId,deviceId,source,capturedAt,filename,contentType:png?'image/png':'image/jpeg',sizeBytes:bytes.length});}
  catch(error){await unlink(resolve(directory(),filename)).catch(()=>{});throw error;}
  await analyze(row,bytes);return row;
 }
 router.post('/images',(req,res,next)=>localUploadAllowed(req)?next():authorize(req,res,next),express.raw({type:['image/jpeg','image/png'],limit:'5mb'}),async(req,res)=>{
  const sampleId=id(req.query.sampleId),bytes=req.body;
  if(!Buffer.isBuffer(bytes)||!bytes.length)fail(415,'INVALID_IMAGE','Supply binary JPEG/PNG bytes.');
  await registeredSample(sampleId);
  let capturedAt=new Date();
  if(req.query.capturedAt!==undefined){if(typeof req.query.capturedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(req.query.capturedAt))fail(400,'VALIDATION_ERROR','capturedAt must be an ISO timestamp with a timezone.');capturedAt=new Date(req.query.capturedAt);}
  if(!Number.isFinite(capturedAt.getTime())||capturedAt>new Date(Date.now()+300000))fail(400,'VALIDATION_ERROR','Invalid image timestamp.');
  const row=await persist({sampleId,bytes,contentType:req.is('image/png')?'image/png':'image/jpeg',capturedAt,source:req.deviceId?'esp32_cam':'manual_upload',deviceId:req.deviceId});
  res.status(201).json(output(row));
 });
 router.post('/camera',operatorOnly,async(req,res)=>{
  const sampleId=id(req.query.sampleId);await registeredSample(sampleId);
  const capture=await service('/camera/capture');
  const row=await persist({sampleId,bytes:capture.bytes,contentType:capture.contentType,capturedAt:new Date(capture.capturedAt),source:'esp32_cam'});
  res.status(201).json(output(row));
 });
 router.get('/history',async(req,res)=>{
  const sampleId=id(req.query.sampleId);
  const parse=(value,fallback,max)=>{if(value===undefined)return fallback;if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||Number(value)>max)fail(400,'VALIDATION_ERROR','Invalid pagination.');return Number(value);};
  const page=parse(req.query.page,1,100000),limit=parse(req.query.limit,20,100);
  const [rows,total]=await Promise.all([Model.find({sampleId}).sort({capturedAt:-1,_id:-1}).skip((page-1)*limit).limit(limit),Model.countDocuments({sampleId})]);
  res.json({data:rows.map(output),pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
 });
 async function stored(imageId){if(!/^[a-f0-9]{24}$/i.test(imageId))fail(400,'VALIDATION_ERROR','Invalid image ID.');const row=await Model.findById(imageId);if(!row)fail(404,'IMAGE_NOT_FOUND','Image not found.');if(!/^[a-f0-9-]{36}\.(jpg|png)$/.test(row.filename))fail(500,'STORAGE_ERROR','Invalid stored file.');return row;}
 async function bytes(row){try{return await readFile(resolve(directory(),row.filename));}catch(error){if(error.code==='ENOENT')fail(404,'IMAGE_FILE_NOT_FOUND','Stored image file is missing.');throw error;}}
 router.post('/:imageId/analyze',(req,res,next)=>localUploadAllowed(req)?next():authorize(req,res,next),async(req,res)=>{if(req.deviceId)fail(403,'FORBIDDEN','Use an operator token to request reanalysis.');const row=await stored(req.params.imageId);await analyze(row,await bytes(row));res.json(output(row));});
 router.get('/:imageId/file',async(req,res)=>{const row=await stored(req.params.imageId);res.set('Cache-Control','private, max-age=300').type(row.contentType).send(await bytes(row));});
 router.use((error,_req,res,_next)=>{
  let status=error.status||500,code=error.code||'INTERNAL_SERVER_ERROR',message=error.message;
  if(error.type==='entity.too.large'){status=413;code='UPLOAD_TOO_LARGE';message='Maximum image size is 5 MiB.';}
  if(error.name?.startsWith('Mongo')||error.name==='MongooseError'){status=503;code='DATABASE_UNAVAILABLE';message='Image database operation failed.';}
  res.status(status).json({error:{code:typeof code==='string'?code:'INTERNAL_SERVER_ERROR',message:status===500?'Unable to process the sample image.':message}});
 });
 return router;
}

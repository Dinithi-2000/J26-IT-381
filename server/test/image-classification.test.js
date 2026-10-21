import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createImageRouter} from '../src/module02-image/routes.js';
import {ImageServiceError,validateResult,imageService} from '../src/module02-image/service.js';
const token='test-operator-012345678901234567890123456789';
const key='test-device-key-012345678901234567890123456';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKWQAAAAASUVORK5CYII=','base64');
const rows=[];let database=true,failCreate=false,ready=false,cameraAvailable=true,server,base,storage;
const Model={
 async create(values){if(failCreate)throw Object.assign(new Error('secret mongo URI'),{name:'MongoServerError'});const row={...values,_id:String(rows.length+1).padStart(24,'0'),async save(){return this;},toObject(){return {...this,save:undefined,toObject:undefined};}};rows.push(row);return row;},
 findById:async id=>rows.find(row=>row._id===id)||null,
 find:filter=>({sort:()=>({skip:skip=>({limit:async limit=>rows.filter(row=>row.sampleId===filter.sampleId).slice(skip,skip+limit)})})}),
 countDocuments:async filter=>rows.filter(row=>row.sampleId===filter.sampleId).length,
};
const result={predictedCondition:'Good Quality',modelScore:.7,scores:{'Good Quality':.7,'Suspected Mold':.3},modelVersion:'TEST-FIXTURE-ONLY',analyzedAt:'2026-10-20T09:00:00Z',prototype:true};
before(async()=>{
 process.env.MODULE02_OPERATOR_TOKEN=token;process.env.MODULE02_DEVICE_KEYS=JSON.stringify({'CAM-01':key});storage=await mkdtemp(join(tmpdir(),'cinnasense-image-test-'));process.env.MODULE02_IMAGE_UPLOAD_DIR=storage;
 const app=express();app.use('/api/module-02/image-classification',createImageRouter({Model,SampleModel:{findOne:async({sampleId})=>sampleId==='CIN-01'?{archivedAt:null}:null},databaseReady:()=>database,service:async path=>{if(path==='/camera/status'){if(!cameraAvailable)throw new ImageServiceError('CAMERA_UNREACHABLE','Camera offline.',502);return {status:'connected',checkedAt:'2026-10-20T09:00:00Z'};}if(path==='/camera/capture'){if(!cameraAvailable)throw new ImageServiceError('CAMERA_UNREACHABLE','Camera offline.',502);return {bytes:Buffer.from([255,216,255,224,255,217]),contentType:'image/jpeg',capturedAt:'2026-10-20T09:00:00Z'};}if(!ready)throw new ImageServiceError('MODEL_UNAVAILABLE','No trained artifact.');return path==='/health'?{status:'ready',modelVersion:result.modelVersion}:result;}}));
 server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/api/module-02/image-classification`;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(storage,{recursive:true,force:true});});
async function request(path,{method='GET',bytes,headers={}}={}){const response=await fetch(base+path,{method,headers,body:bytes});return {status:response.status,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer()};}
const operator={Authorization:`Bearer ${token}`,'Content-Type':'image/png'};
test('model absence is explicit and no classification is fabricated',async()=>{
 assert.equal((await request('/status')).body.error.code,'MODEL_UNAVAILABLE');
 const response=await request('/images?sampleId=CIN-01',{method:'POST',bytes:png,headers:operator});assert.equal(response.status,201);assert.equal(response.body.analysisStatus,'model_unavailable');assert.equal(response.body.predictedCondition,undefined);assert.equal(response.body.filename,undefined);assert.equal((await readdir(storage)).length,1);
});
test('operator and device authentication, image size/type and IDs are validated',async()=>{
 assert.equal((await request('/images?sampleId=CIN-01',{method:'POST',bytes:png,headers:{...operator,Authorization:'Bearer wrong'}})).status,401);
 assert.equal((await request('/images?sampleId=../bad',{method:'POST',bytes:png,headers:operator})).status,400);
 assert.equal((await request('/images?sampleId=CIN-01',{method:'POST',bytes:Buffer.from('bad'),headers:operator})).status,415);
 assert.equal((await request('/images?sampleId=CIN-01',{method:'POST',bytes:Buffer.alloc(5*1024*1024+1),headers:operator})).status,413);
 const headers={'Content-Type':'image/png','X-Device-Id':'CAM-01','X-Device-Key':key};
 assert.equal((await request('/images?sampleId=CIN-01',{method:'POST',bytes:png,headers})).status,201);
 assert.equal((await request('/000000000000000000000001/analyze',{method:'POST',headers})).status,403);
});
test('validated service output is stored and served with sample history',async()=>{
 ready=true;
 const row=(await request('/000000000000000000000001/analyze',{method:'POST',headers:operator})).body;
 assert.equal(row.analysisStatus,'completed');assert.equal(row.modelScore,.7);assert.equal(row.modelVersion,'TEST-FIXTURE-ONLY');
 assert.equal((await request('/000000000000000000000001/file')).status,200);
 assert.equal((await request('/history?sampleId=CIN-01')).body.pagination.total,2);
 assert.equal((await request('/history?sampleId=CIN-01&limit=1000')).status,400);
 assert.equal((await request('/000000000000000000000099/file')).status,404);
 assert.equal((await request('/invalid/file')).status,400);
});
test('database failure rejects requests and cleans up new files without leaking credentials',async()=>{
 database=false;assert.equal((await request('/history?sampleId=CIN-01')).status,503);database=true;failCreate=true;
 try{const response=await request('/images?sampleId=CIN-01',{method:'POST',bytes:png,headers:operator});assert.equal(response.status,503);assert(!JSON.stringify(response.body).includes('secret'));assert.equal((await readdir(storage)).length,2);}finally{failCreate=false;}
});
test('inference contract rejects fabricated or malformed upstream values',async()=>{
 assert.equal(validateResult(result).modelScore,.7);
 for(const changes of [{modelScore:1.2},{predictedCondition:'Discolored'},{prototype:false},{modelVersion:''},{scores:{'Good Quality':.1,'Suspected Mold':.9}}])assert.throws(()=>validateResult({...result,...changes}));
 await assert.rejects(imageService('/health',{fetcher:async()=>{throw new Error('network failure');}}),error=>error.code==='IMAGE_SERVICE_UNAVAILABLE');
});

test('camera status, capture/prediction, sample association and failures reuse existing history',async()=>{
 const headers={Authorization:`Bearer ${token}`};
 assert.equal((await request('/camera/status',{headers})).body.status,'connected');
 const captured=await request('/camera?sampleId=CIN-01',{method:'POST',headers});
 assert.equal(captured.status,201);assert.equal(captured.body.source,'esp32_cam');assert.equal(captured.body.analysisStatus,'completed');
 assert.equal((await request('/camera?sampleId=UNKNOWN',{method:'POST',headers})).status,404);
 assert.equal((await request('/camera?sampleId=CIN-01',{method:'POST',headers:{Authorization:'Bearer bad'}})).status,401);
 cameraAvailable=false;
 try{assert.equal((await request('/camera/status',{headers})).body.error.code,'CAMERA_UNREACHABLE');assert.equal((await request('/camera?sampleId=CIN-01',{method:'POST',headers})).status,502);}finally{cameraAvailable=true;}
});
test('actual Colab class spelling passes the existing result contract without relabeling',()=>{
 const raw={...result,predictedCondition:'good_quality',modelScore:.91,scores:{'Suspected Mold':.09,good_quality:.91}};
 assert.equal(validateResult(raw).predictedCondition,'good_quality');assert.deepEqual(validateResult(raw).scores,raw.scores);
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { Prediction } from '../src/models/Prediction.js';
import { createApp } from '../src/server.js';
import { Sample, SensorReading } from '../src/module02/models.js';
import { readingInput, sampleInput, dateFilter, pagination } from '../src/module02/validation.js';
const operator = 'operator-test-secret-012345678901234567890';
const deviceKey = 'device-test-secret-01234567890123456789012';
const sample = {sampleId:'CIN-TEST-01',batchId:'BATCH-TEST',grade:'Quills',storage:'Sealed container',storageStartDate:'2026-01-01',initialWeightGrams:250};
const reading = {sampleId:sample.sampleId,deviceId:'ESP32-TEST',measurementId:'M-001',weightGrams:249,red:160,green:110,blue:70,temperatureC:28,relativeHumidityPercent:60,gasResistanceOhms:120000,recordedAt:'2026-02-01T09:00:00Z'};
// Isolated in-memory repository doubles exercise HTTP behavior, not MongoDB persistence.
function memoryModel() {
  const rows=[];
  const match=(row,filter)=>Object.entries(filter).every(([key,value])=>{
    if(value && typeof value==='object' && !(value instanceof Date)) return (!value.$gte || row[key]>=value.$gte)&&(!value.$lte || row[key]<=value.$lte);
    return value===null ? row[key]==null : String(row[key])===String(value);
  });
  const doc=values=>({...values,_id:values._id || String(rows.length+1).padStart(24,'0'),createdAt:new Date(),toObject(){return {...this,toObject:undefined,save:undefined};},async save(){return this;}});
  function query(filter,single=false) {
    let order={},skip=0,limit=Infinity;
    const q={sort(value){order=value;return q;},skip(value){skip=value;return q;},limit(value){limit=value;return q;},then(ok,bad){return Promise.resolve().then(()=>{
      let result=rows.filter(row=>match(row,filter)).sort((a,b)=>{for(const [key,direction] of Object.entries(order)){if(a[key]<b[key])return -direction;if(a[key]>b[key])return direction;}return 0;}).slice(skip,skip+limit);
      return single ? result[0] || null : result;
    }).then(ok,bad);}};return q;
  }
  return {rows,find:filter=>query(filter),findOne:filter=>query(filter,true),findById:async id=>rows.find(row=>row._id===id)||null,countDocuments:async filter=>rows.filter(row=>match(row,filter)).length,
    async create(values){if(rows.some(row=>values.measurementId ? row.deviceId===values.deviceId&&row.measurementId===values.measurementId : values.sampleId && !values.filename && row.sampleId===values.sampleId))throw Object.assign(new Error('duplicate'),{code:11000});const row=doc(values);rows.push(row);return row;}};
}
let server,base,storage;
const models={Sample:memoryModel(),SensorReading:memoryModel(),SampleImage:memoryModel(),DegradationPrediction:memoryModel()};
const auth={Authorization:`Bearer ${operator}`};
const device={'x-device-id':'ESP32-TEST','x-device-key':deviceKey};
async function call(path,{method='GET',body,headers={},raw}={}) {
 const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},body:raw ?? (body?JSON.stringify(body):undefined)});
 const contentType=response.headers.get('content-type')||'';
 return {status:response.status,body:contentType.includes('json')?await response.json():await response.arrayBuffer()};
}
before(async()=>{
 process.env.MODULE02_OPERATOR_TOKEN=operator;process.env.MODULE02_DEVICE_KEYS=JSON.stringify({'ESP32-TEST':deviceKey});
 storage=await mkdtemp(join(tmpdir(),'cinnasense-module02-test-'));process.env.MODULE02_UPLOAD_DIR=storage;
 server=createServer(createApp({module02:{...models,databaseReady:()=>true}}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/api`;
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(storage,{recursive:true,force:true});});
test('sensor bounds, object injection, calendar dates and paging reject invalid values',()=>{
 for(const changes of [{relativeHumidityPercent:101},{weightGrams:-1},{red:256},{temperatureC:'28'},{deviceId:{$ne:null}},{extra:true},{recordedAt:'2026-02-30'},{recordedAt:'2026-02-30T09:00:00+05:30'}])assert.throws(()=>readingInput({...reading,...changes}));
 assert.throws(()=>sampleInput({...sample,sampleId:'../bad'}));assert.throws(()=>pagination({limit:'201'}));assert.throws(()=>dateFilter({from:'2026-02-01',to:'2026-01-01'}));
});
test('Mongoose schemas validate and define database unique indexes',async()=>{
 await assert.rejects(new SensorReading({...reading,weightGrams:-1}).validate());
 assert(SensorReading.schema.indexes().some(([keys,opts])=>keys.deviceId===1&&keys.measurementId===1&&opts.unique));
 assert(Sample.schema.indexes().some(([keys,opts])=>keys.sampleId===1&&opts.unique));
});
test('sample create/read/update/archive and unique sample IDs',async()=>{
 assert.equal((await call('/samples',{method:'POST',body:sample})).status,401);
 assert.equal((await call('/samples',{method:'POST',body:sample,headers:auth})).status,201);
 assert.equal((await call('/samples',{method:'POST',body:sample,headers:auth})).status,409);
 assert.equal((await call('/samples/'+sample.sampleId)).body.sampleId,sample.sampleId);
 assert.equal((await call('/samples/'+sample.sampleId,{method:'PATCH',body:{storage:'Glass jar'},headers:auth})).body.storage,'Glass jar');
 assert.equal((await call('/samples?limit=1')).body.pagination.total,1);
 assert.equal((await call('/samples/UNKNOWN')).status,404);
});
test('authenticated telemetry rejects mismatched device, invalid JSON, invalid readings and unknown samples',async()=>{
 assert.equal((await call('/module-02/readings',{method:'POST',body:reading,headers:{...device,'x-device-key':'wrong'}})).status,401);
 assert.equal((await call('/module-02/readings',{method:'POST',body:{...reading,deviceId:'OTHER'},headers:device})).status,403);
 assert.equal((await call('/module-02/readings',{method:'POST',body:{...reading,red:300},headers:device})).status,400);
 assert.equal((await call('/module-02/readings',{method:'POST',body:{...reading,sampleId:'UNKNOWN'},headers:device})).status,404);
 assert.equal((await call('/module-02/readings',{method:'POST',raw:'{bad',headers:{...device,'Content-Type':'application/json'}})).status,400);
});
test('telemetry ingestion, duplicate measurement rejection, latest offline status and filtered history',async()=>{
 assert.equal((await call('/module-02/readings',{method:'POST',body:reading,headers:device})).status,201);
 assert.equal((await call('/module-02/readings',{method:'POST',body:reading,headers:device})).status,409);
 const latest=await call('/module-02/readings/latest?sampleId='+sample.sampleId);assert.equal(latest.body.deviceStatus.status,'offline');
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/readings?from=2026-03-01`)).body.data.length,0);
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/readings?limit=1`)).body.pagination.total,1);
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/readings?order=asc&limit=1`)).body.data[0].measurementId,'M-001');
 assert.equal((await call('/module-02/readings/latest?sampleId[$ne]=bad')).status,400);
});
test('image types, size limits, binary storage, metadata and retrieval',async()=>{
 const path=`/module-02/images?sampleId=${sample.sampleId}&recordedAt=2026-02-01T09:00:00Z&role=Baseline`;
 assert.equal((await call(path,{method:'POST',raw:Buffer.from('not-image'),headers:{...device,'Content-Type':'image/jpeg'}})).status,415);
 assert.equal((await call(path,{method:'POST',raw:Buffer.alloc(5*1024*1024+1),headers:{...device,'Content-Type':'image/jpeg'}})).status,413);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKWQAAAAASUVORK5CYII=','base64');
 const result=await call(path,{method:'POST',raw:png,headers:{...device,'Content-Type':'image/png'}});assert.equal(result.status,201);
 assert.equal((await readdir(storage)).length,1);assert.equal(result.body.sizeBytes,png.length);
 assert.equal((await call(result.body.url.replace('/api',''))).status,200);
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/images`)).body.data.length,1);
 assert.equal((await call('/module-02/images/not-an-id/file')).status,400);
 const create=models.SampleImage.create;models.SampleImage.create=async()=>{throw Object.assign(new Error('database down'),{name:'MongoServerError'});};
 try {assert.equal((await call(path,{method:'POST',raw:png,headers:{...device,'Content-Type':'image/png'}})).status,503);assert.equal((await readdir(storage)).length,1);}finally{models.SampleImage.create=create;}

});
test('no fabricated prediction and empty prediction history',async()=>{
 const result=await call('/module-02/predict',{method:'POST',body:{sampleId:sample.sampleId,horizonDays:7},headers:auth});assert.equal(result.status,503);assert.equal(result.body.error.code,'MODEL_UNAVAILABLE');
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/predictions`)).body.data.length,0);
});
test('archive preserves history and rejects new telemetry',async()=>{
 assert.equal((await call('/samples/'+sample.sampleId,{method:'DELETE',headers:auth})).status,200);
 assert.equal((await call('/samples')).body.data.length,0);
 assert.equal((await call('/samples?archived=true')).body.data.length,1);
 assert.equal((await call('/module-02/readings',{method:'POST',body:{...reading,measurementId:'M-002'},headers:device})).status,409);
 assert.equal((await call(`/module-02/samples/${sample.sampleId}/readings`)).body.data.length,1);
});
test('database failures return safe 503 responses without credentials',async()=>{
 const unavailable=createServer(createApp({module02:{databaseReady:()=>false}}));await new Promise(resolve=>unavailable.listen(0,'127.0.0.1',resolve));
 try {const res=await fetch(`http://127.0.0.1:${unavailable.address().port}/api/samples`);assert.equal(res.status,503);assert.equal((await res.json()).error.code,'DATABASE_UNAVAILABLE');} finally {await new Promise(resolve=>unavailable.close(resolve));}
 const saved=models.Sample.find;models.Sample.find=()=>{throw Object.assign(new Error('secret database URI'),{name:'MongoServerSelectionError'});};
 try{const res=await call('/samples');assert.equal(res.status,503);assert(!JSON.stringify(res.body).includes('secret'));}finally{models.Sample.find=saved;}
});
test('Module 04 validation, database failure and model-info route remain available',async()=>{
 assert.equal((await call('/predictions',{method:'POST',body:{date:'bad'}})).status,400);
 assert.equal((await call('/predictions')).body.error.code,'DATABASE_UNAVAILABLE');
 assert.equal((await call('/predictions',{method:'POST',body:{date:'2026-01-01',district:'Galle',grade:'Alba'}})).body.error.code,'DATABASE_UNAVAILABLE');
 // Stub only the upstream FastAPI fetch; the Express request uses the original fetch.
 const nativeFetch=globalThis.fetch;globalThis.fetch=async (url,options)=>String(url).endsWith('/health')?new Response(JSON.stringify({status:'ok',modelVersion:'regression-fixture'}),{headers:{'Content-Type':'application/json'}}):nativeFetch(url,options);
 try{assert.equal((await call('/model-info')).body.modelVersion,'regression-fixture');}finally{globalThis.fetch=nativeFetch;}
});

test('missing authentication configuration fails closed',async()=>{
 const secret=process.env.MODULE02_OPERATOR_TOKEN;delete process.env.MODULE02_OPERATOR_TOKEN;
 try {assert.equal((await call('/samples',{method:'POST',body:sample,headers:auth})).body.error.code,'AUTH_UNCONFIGURED');}finally{process.env.MODULE02_OPERATOR_TOKEN=secret;}
 const keys=process.env.MODULE02_DEVICE_KEYS;process.env.MODULE02_DEVICE_KEYS='{}';
 try {assert.equal((await call('/module-02/readings',{method:'POST',body:reading,headers:device})).body.error.code,'AUTH_UNCONFIGURED');}finally{process.env.MODULE02_DEVICE_KEYS=keys;}
});
test('Module 04 successful prediction and history contract with isolated persistence and ML doubles',async()=>{
 const originalDescriptor=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState');
 const create=Prediction.create, find=Prediction.find, nativeFetch=globalThis.fetch;
 const saved=[];
 Object.defineProperty(mongoose.connection,'readyState',{configurable:true,get:()=>1});
 Prediction.create=async value=>{const row={...value,_id:'price-test',createdAt:new Date()};saved.push(row);return row;};
 Prediction.find=()=>({sort:()=>({limit:async()=>saved})});
 globalThis.fetch=async(url,options)=>String(url).endsWith('/predict') ? new Response(JSON.stringify({prediction:4200,currency:'LKR',unit:'per_kg',modelVersion:'price-regression-fixture'}),{headers:{'Content-Type':'application/json'}}):nativeFetch(url,options);
 try {
  const response=await call('/predictions',{method:'POST',body:{date:'2026-10-18',district:'Galle',grade:'Alba'}});
  assert.equal(response.status,201);assert.equal(response.body.predictedPrice,4200);assert.equal(response.body.modelVersion,'price-regression-fixture');
  assert.equal((await call('/predictions')).body[0]._id,'price-test');
 }finally{
  if(originalDescriptor)Object.defineProperty(mongoose.connection,'readyState',originalDescriptor);else delete mongoose.connection.readyState;
  Prediction.create=create;Prediction.find=find;globalThis.fetch=nativeFetch;
 }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQualityService } from '../../client/src/services/qualityService.js';
const json = body => new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
test('quality client maps actual API measurements and keeps the original baseline',async()=>{
 const calls=[];
 const raw={sampleId:'CIN-001',batchId:'BATCH-A',initialWeightGrams:250,storageStartDate:'2026-01-01T00:00:00.000Z'};
 const baseline={_id:'baseline',recordedAt:'2026-01-01T09:00:00Z',weightGrams:250,temperatureC:27,relativeHumidityPercent:60,gasResistanceOhms:140000,red:160,green:110,blue:70};
 const latest={...baseline,_id:'latest',recordedAt:'2026-02-01T09:00:00Z',weightGrams:245};
 const service=createQualityService({fetcher:async url=>{
   calls.push(url);
   if(url.includes('/readings/latest'))return json({data:latest,deviceStatus:{status:'offline',offlineAfterSeconds:300}});
   if(url.includes('order=asc'))return json({data:[baseline],pagination:{total:201}});
   if(url.includes('/readings?'))return json({data:[latest],pagination:{total:201}});
   if(url.includes('/images?'))return json({data:[{_id:'img',url:'/api/module-02/images/123/file',recordedAt:latest.recordedAt,role:'Current'}],pagination:{total:1}});
   if(url.includes('/predictions?'))return json({data:[],pagination:{total:0}});
   return json({data:[raw],pagination:{pages:1}});
 }});
 const samples=await service.getSamples();assert.equal(samples[0].records.length,0);
 const sample=await service.getSampleData(samples[0]);assert.equal(sample.records[0].weight,245);assert.equal(sample.baselineRecord.weight,250);assert.equal(sample.historyTotal,201);assert.equal(sample.images[0].kind,'photograph');assert.equal(sample.predictions.length,0);assert(calls.every(url=>url.startsWith('/api/')));
});
test('quality client preserves API errors and never silently substitutes demonstration records',async()=>{
 const down=createQualityService({fetcher:async()=>{throw new Error('network down');}});
 await assert.rejects(down.getSamples(),error=>error.code==='DISCONNECTED');
 const databaseDown=createQualityService({fetcher:async()=>new Response(JSON.stringify({error:{code:'DATABASE_UNAVAILABLE',message:'Database unavailable'}}),{status:503,headers:{'Content-Type':'application/json'}})});
 await assert.rejects(databaseDown.getSamples(),error=>error.code==='DATABASE_UNAVAILABLE');
});

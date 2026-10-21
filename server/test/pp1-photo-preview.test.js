import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {createPp1PhotoPreviewRouter} from '../src/module02/pp1PhotoPreview.js';
import {ImageServiceError} from '../src/module02-image/service.js';

const token='test-preview-operator-012345678901234567890';
const png=Buffer.from([137,80,78,71,13,10,26,10]);
const result={predictedCondition:'good_quality',modelScore:.8,scores:{'Suspected Mold':.2,good_quality:.8},
  modelVersion:'TEST-ONLY',analyzedAt:'2026-10-21T00:00:00Z',prototype:true};
let server,base,mode='ready',priorToken,calls=0;
before(async()=>{
  priorToken=process.env.MODULE02_OPERATOR_TOKEN;process.env.MODULE02_OPERATOR_TOKEN=token;
  const app=express();app.use(express.json());
  app.use('/preview-api',createPp1PhotoPreviewRouter({verifyTarget:()=>{if(mode==='bad-target')throw Error('Do not reveal private connection info');},
    service:async(path,options)=>{calls++;if(mode==='offline')throw new ImageServiceError('IMAGE_SERVICE_UNAVAILABLE','The image inference service cannot be reached.');
      if(path==='/health')return {status:'ready',classes:['Suspected Mold','good_quality']};
      assert.equal(options.contentType,'image/png');assert(options.bytes.equals(png));
      return mode==='invalid-result'?{...result,modelScore:9}:result;}}));
  server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/preview-api`;
});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));if(priorToken===undefined)delete process.env.MODULE02_OPERATOR_TOKEN;else process.env.MODULE02_OPERATOR_TOKEN=priorToken;});
const call=(bytes=png,headers={Authorization:`Bearer ${token}`,'Content-Type':'image/png'})=>fetch(base+'/preview',{method:'POST',headers,body:bytes});

test('local status advertises photo preview without changing model health fields',async()=>{
 const r=await fetch(base+'/status');assert.equal(r.status,200);const b=await r.json();assert.equal(b.previewAvailable,true);assert.equal(b.status,'ready');
});
test('preview requires the existing operator authentication before inference',async()=>{
 const previous=calls;assert.equal((await call(png,{'Content-Type':'image/png'})).status,401);assert.equal(calls,previous);
});
test('wrong formats, empty input and oversized images are rejected before inference',async()=>{
 const previous=calls;
 for(const bytes of [Buffer.from('not an image'),Buffer.alloc(0)])assert.equal((await call(bytes)).status,415);
 assert.equal((await call(Buffer.alloc(5*1024*1024+1))).status,413);assert.equal(calls,previous);
});
test('real service fields are returned with no sample ID, saved-image URL or fabricated capture timestamp',async()=>{
 const r=await call();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const b=await r.json();
 assert.equal(b.predictedCondition,'good_quality');assert.equal(b.modelScore,.8);assert.equal(Date.parse(b.analyzedAt),Date.parse(result.analyzedAt));
 assert.equal(b.previewOnly,true);assert.equal(b.analysisStatus,'completed');
 for(const field of ['sampleId','_id','imageUrl','capturedAt','filename'])assert(!Object.hasOwn(b,field));
});
test('unavailable and malformed inference results produce explicit errors without predictions',async()=>{
 try {mode='offline';const r=await call();assert.equal(r.status,503);assert.equal((await r.json()).error.code,'IMAGE_SERVICE_UNAVAILABLE');
 mode='invalid-result';const bad=await call();assert.equal(bad.status,503);assert.equal((await bad.json()).error.code,'INVALID_MODEL_RESPONSE');
 }finally{mode='ready';}
});
test('preview refuses an unverified database context and hides internal details',async()=>{
 try {mode='bad-target';const r=await call();assert.equal(r.status,503);const text=await r.text();assert(!text.includes('private connection'));assert(!text.includes('good_quality'));}
 finally{mode='ready';}
});

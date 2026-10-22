import {test} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import {createServer} from 'node:http';
import {PP1_URI, pp1Records, verifyPp1Target, verifyPp1Connection} from '../src/module02/pp1Dataset.js';
import {seedPp1} from '../tools/module02-pp1-seed.mjs';
import {Sample, SensorReading} from '../src/module02/models.js';
import {createModule02Router} from '../src/module02/routes.js';
import {createRiskRouter, storedReadingInput} from '../src/module02-risk/routes.js';
import {RiskServiceError} from '../src/module02-risk/client.js';
import {createQualityService} from '../../client/src/services/qualityService.js';

test('PP1 seeding refuses production, unknown databases, remote hosts and URI redirection',()=>{
  assert.equal(verifyPp1Target(PP1_URI), PP1_URI);
  for (const uri of ['mongodb+srv://example.org/test','mongodb://127.0.0.1:27018/test',
    'mongodb://example.org:27018/cinnasense_module02_pp1_dev',PP1_URI+'?replicaSet=other',
    PP1_URI.replace('27018','27017'),'mongodb://user:pass@127.0.0.1:27018/cinnasense_module02_pp1_dev']) assert.throws(()=>verifyPp1Target(uri));
  assert.throws(()=>verifyPp1Connection({name:'test',host:'127.0.0.1',port:27018}));
});

test('all deterministic fixture documents retain demo provenance; missing measurements stay null',async()=>{
  const {samples,readings}=pp1Records(); assert.equal(samples.length,3); assert.equal(readings.length,18);
  assert.deepEqual(pp1Records(),{samples,readings});
  for(const row of samples) {assert.equal(row.dataOrigin,'DEMO_DATA');await new Sample(row).validate();}
  for(const row of readings) {assert.equal(row.dataOrigin,'DEMO_DATA');await new SensorReading(row).validate();}
  assert.equal(readings.filter(row=>row.temperatureC===null).length,6);
});

test('production freshness protection remains; historical illustration override is explicit and never permits future or incomplete inputs',()=>{
  const {samples,readings}=pp1Records(),now=Date.parse('2026-10-23T10:00:00Z');
  assert.throws(()=>storedReadingInput(samples[0],readings[5],now),e=>e.code==='STALE_READING');
  const input=storedReadingInput(samples[0],readings[5],now,{allowIllustrativeHistory:true});
  assert.equal(input.storage_day,5); assert.equal(input.weight_g,246);
  assert.throws(()=>storedReadingInput(samples[0],{...readings[5],dataOrigin:'REAL_SENSOR'},now,{allowIllustrativeHistory:true}),e=>e.code==='STALE_READING');
  assert.throws(()=>storedReadingInput(samples[2],readings[17],now,{allowIllustrativeHistory:true}),e=>e.code==='ENVIRONMENT_REQUIRED');
  assert.throws(()=>storedReadingInput(samples[0],{...readings[5],recordedAt:new Date(now+1000)},now,{allowIllustrativeHistory:true}),e=>e.code==='FUTURE_READING');
});

test('local seed is idempotent; existing API/client retrieve samples and histories while unavailable ML remains an independent error', {skip:process.env.MODULE02_PP1_TEST!=='1'},async()=>{
  await seedPp1(); await mongoose.connect(PP1_URI); verifyPp1Connection();
  const before=await SensorReading.find({dataOrigin:'DEMO_DATA'}).sort({_id:1}).lean();await mongoose.disconnect();
  await seedPp1();await mongoose.connect(PP1_URI);
  const after=await SensorReading.find({dataOrigin:'DEMO_DATA'}).sort({_id:1}).lean();assert.deepEqual(after,before);
  const originalToken=process.env.MODULE02_OPERATOR_TOKEN;
  process.env.MODULE02_OPERATOR_TOKEN='test-only-pp1-operator-01234567890123456789';
  const app=express();app.use(express.json());
  app.use('/api/module-02',createRiskRouter({allowIllustrativeHistory:true,predict:async()=>{throw new RiskServiceError('RISK_SERVICE_UNAVAILABLE','Model service offline.');}}));
  app.use('/api',createModule02Router());
  const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const service=createQualityService({baseUrl:`http://127.0.0.1:${server.address().port}/api`});
  try {
    const samples=await service.getSamples();assert.equal(samples.length,3);assert(samples.every(row=>row.dataOrigin==='DEMO_DATA'));
    const sample=samples.find(row=>row.id==='CIN-002'), detail=await service.getSampleData(sample);
    assert.equal(detail.records.length,6);assert.equal(detail.records.at(-1).weight,197.5);
    assert.equal(detail.records.at(-1).environment.temperature.source,'illustrative');
    const latest=await service.getLatestReading(sample.id);
    await assert.rejects(service.createRiskPrediction(sample.id,latest.data._id,process.env.MODULE02_OPERATOR_TOKEN),e=>e.code==='RISK_SERVICE_UNAVAILABLE');
    assert.equal((await service.getSamples()).length,3);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await mongoose.disconnect();
    if(originalToken===undefined)delete process.env.MODULE02_OPERATOR_TOKEN;else process.env.MODULE02_OPERATOR_TOKEN=originalToken;}
});

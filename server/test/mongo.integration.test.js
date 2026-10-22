import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Sample, SensorReading, SampleImage, DegradationPrediction } from '../src/module02/models.js';
import { saveModelPrediction } from '../src/module02/predictionStore.js';
const uri=process.env.MODULE02_TEST_MONGODB_URI;
test('real MongoDB persistence, unique measurement index, archives and model output references', {skip:!uri}, async()=>{
 // Refuse nonlocal servers and non-test database names; never drop a database.
 const parsed=new URL(uri);
 assert(['localhost','127.0.0.1','[::1]'].includes(parsed.hostname),'Use a dedicated local MongoDB instance');
 assert(/^\/[a-zA-Z0-9_]*module02_test$/.test(parsed.pathname),'Database name must end in module02_test');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:3000});
 const sampleId=`TEST-${Date.now()}`;
 try{
  await Promise.all([Sample.init(),SensorReading.init(),SampleImage.init(),DegradationPrediction.init()]);
  const sample=await Sample.create({sampleId,batchId:'TEST-BATCH',grade:'Test',storage:'Test',storageStartDate:new Date('2026-01-01'),initialWeightGrams:250});
  const reading={sampleId,deviceId:'TEST-DEVICE',measurementId:sampleId,recordedAt:new Date(),weightGrams:249,red:160,green:110,blue:70,temperatureC:28,relativeHumidityPercent:60,gasResistanceOhms:120000};
  const row=await SensorReading.create(reading);await assert.rejects(SensorReading.create(reading),error=>error.code===11000);
  const prediction=await saveModelPrediction({sampleId,modelVersion:'test-fixture-only',predictedAt:new Date().toISOString(),horizonDays:7,riskCategory:'low',readingIds:[row._id.toString()],imageIds:[]});assert.equal(prediction.sampleId,sampleId);
  await assert.rejects(saveModelPrediction({sampleId,modelVersion:'test',predictedAt:new Date().toISOString(),horizonDays:7,riskCategory:'low',readingIds:[new mongoose.Types.ObjectId().toString()]}));
  sample.archivedAt=new Date();await sample.save();assert.equal(await SensorReading.countDocuments({sampleId}),1);
 }finally{
  await Promise.all([Sample,SensorReading,SampleImage,DegradationPrediction].map(Model=>Model.deleteMany({sampleId})));
  await mongoose.disconnect();
 }
});

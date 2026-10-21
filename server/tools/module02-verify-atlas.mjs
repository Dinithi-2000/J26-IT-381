// Read-only verification, except a retry of the already saved prediction.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const env=dotenv.parse(await readFile(fileURLToPath(new URL('../.env',import.meta.url))));
const headers={Authorization:`Bearer ${env.MODULE02_OPERATOR_TOKEN}`};
async function get(url,options={}) {const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});assert(response.ok,`${new URL(url).pathname}: HTTP ${response.status}`);return response.json();}
try {
  await mongoose.connect(env.MONGODB_URI,{serverSelectionTimeoutMS:10000});assert.equal(mongoose.connection.name,'test');
  const counts={};for(const name of ['module02_samples','module02_sensor_readings','module02_synthetic_risk_predictions','module02_image_condition_analyses'])counts[name]=await mongoose.connection.db.collection(name).countDocuments();
  const saved=await mongoose.connection.db.collection('module02_synthetic_risk_predictions').findOne({_id:new mongoose.Types.ObjectId('6ad869a4b65d075c36b599a8')});assert(saved);
  const health=await get('http://127.0.0.1:5000/api/health');assert.equal(health.database,'connected');
  const routes=[];
  for(const port of [5000,5173]) {
    const base=`http://localhost:${port}/api`;
    const samples=await get(base+'/samples?limit=100',{headers});assert(samples.data.some(s=>s.sampleId==='CIN-PP1-001'));
    const readings=await get(base+'/module-02/samples/CIN-PP1-001/readings?limit=100',{headers});assert.equal(readings.pagination.total,6);
    const history=await get(base+'/module-02/samples/CIN-PP1-001/risk-predictions',{headers});assert(history.data.some(r=>r._id===String(saved._id)));
    const images=await get(base+'/module-02/image-classification/history?sampleId=CIN-PP1-001',{headers});assert.equal(images.pagination.total,0);
    routes.push({port,samples:samples.pagination.total,readings:readings.pagination.total,riskHistory:history.pagination.total});
  }
  const retry=await get('http://127.0.0.1:5000/api/module-02/risk-predictions',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({sampleId:saved.sampleId,readingId:String(saved.sensorReadingId)})});
  assert.equal(retry._id,String(saved._id));assert.equal(retry.predictedRisk,'Low');assert.equal(retry.dataOrigin,'SYNTHETIC_DEMO');assert.equal(retry.predictionHorizonDays,null);
  // A duplicate Node request intentionally retrieves history. Verify fresh ML
  // inference separately, without inserting a new Atlas prediction record.
  const liveRisk=await get('http://127.0.0.1:8000/predict-risk',{method:'POST',headers:{'X-Risk-Service-Token':env.MODULE02_RISK_SERVICE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(saved.inputSnapshot)});
  assert.equal(liveRisk.predicted_risk,saved.predictedRisk);assert.equal(liveRisk.data_origin,'SYNTHETIC_DEMO');
  const photo=await readFile('C:/Users/USER/Downloads/OneDrive_1_10-20-2026/Good_quality/CIN001_01.jpg');
  const preview=await get('http://localhost:5173/api/module-02/image-classification/preview',{method:'POST',headers:{...headers,'Content-Type':'image/jpeg'},body:photo});
  assert.equal(preview.predictedCondition,'good_quality');assert(Math.abs(preview.modelScore-0.8355658054351807)<0.000001);assert.equal(preview.previewOnly,true);
  const imageHealth=await get('http://127.0.0.1:8002/health');const riskHealth=await get('http://127.0.0.1:8000/risk/health',{headers:{'X-Risk-Service-Token':env.MODULE02_RISK_SERVICE_TOKEN}});const price=await get('http://127.0.0.1:5000/api/model-info');
  assert.equal(await mongoose.connection.db.collection('module02_synthetic_risk_predictions').countDocuments(),counts.module02_synthetic_risk_predictions);
  console.log(JSON.stringify({status:'verified',database:'Atlas/test',counts,routes,retrySameRecord:true,model01:{class:preview.predictedCondition,score:preview.modelScore,baselineMatches:true},model02FreshInference:liveRisk.predicted_risk,model01Health:imageHealth.status,model02Health:riskHealth.status,priceHealth:price.status||price.model_type||'responding'}));
}catch(error){console.error(JSON.stringify({status:'failed',type:error.name,detail:error.name==='AssertionError'?error.message:'Verification failed; secret details withheld.'}));process.exitCode=1;}
finally{await mongoose.disconnect();}

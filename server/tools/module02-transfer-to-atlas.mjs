// One-time transfer of EXISTING presentation records. Never generates fixtures.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PP1_URI, verifyPp1Connection} from '../src/module02/pp1Dataset.js';

const EJSON = mongoose.mongo.BSON.EJSON;
const encode = value => EJSON.stringify(value, {relaxed:false});
const collections = {
  module02_samples: row => ({sampleId:row.sampleId}),
  module02_sensor_readings: row => ({deviceId:row.deviceId, measurementId:row.measurementId}),
  module02_synthetic_risk_predictions: row => ({sampleId:row.sampleId, sensorReadingId:row.sensorReadingId}),
};
const connections=[];
try {
  const backup = process.argv[2];
  if (!backup || !resolve(backup).startsWith('C:\\Github Project\\CinnaSense-backups\\')) throw Error('BACKUP_LOCATION_REQUIRED');
  const env = dotenv.parse(await readFile(fileURLToPath(new URL('../.env',import.meta.url))));
  const uri=env.MONGODB_URI, target=new URL(uri);
  if(target.protocol!=='mongodb+srv:' || target.hostname!=='cinnasensecluster.choowhv.mongodb.net' || !['','/','/test'].includes(target.pathname)) throw Error('UNEXPECTED_DESTINATION');
  const source=mongoose.createConnection(PP1_URI,{serverSelectionTimeoutMS:10000});connections.push(source);await source.asPromise();verifyPp1Connection(source);
  const destination=mongoose.createConnection(uri,{serverSelectionTimeoutMS:10000});connections.push(destination);await destination.asPromise();
  if(destination.name!=='test') throw Error('UNEXPECTED_DATABASE');
  const sourceData={},targetData={},pending={};
  for(const [name,key] of Object.entries(collections)) {
    sourceData[name]=await source.db.collection(name).find({}).sort({_id:1}).toArray();
    targetData[name]=await destination.db.collection(name).find({}).sort({_id:1}).toArray();
    pending[name]=[];
    for(const row of sourceData[name]) {
      const matches=targetData[name].filter(existing=>encode(existing._id)===encode(row._id)||encode(key(existing))===encode(key(row)));
      if(matches.some(existing=>encode(existing)!==encode(row))) throw Error('DESTINATION_COLLISION');
      if(!matches.length)pending[name].push(row);
    }
  }
  const samples=sourceData.module02_samples,readings=sourceData.module02_sensor_readings,risks=sourceData.module02_synthetic_risk_predictions;
  if(samples.length!==3||readings.length!==18||risks.length!==1)throw Error('SOURCE_COUNTS_CHANGED');
  if(samples.some(s=>s.dataOrigin!=='DEMO_DATA')||readings.some(r=>r.dataOrigin!=='DEMO_DATA'||!samples.some(s=>s.sampleId===r.sampleId))||risks.some(r=>r.dataOrigin!=='SYNTHETIC_DEMO'||!readings.some(x=>String(x._id)===String(r.sensorReadingId)&&x.sampleId===r.sampleId)))throw Error('SOURCE_PROVENANCE_OR_RELATIONSHIP_INVALID');
  // Exclusive creation protects previous snapshots; no credentials are exported.
  await mkdir(backup,{recursive:false});
  const manifest={database:'test',destination:'Atlas CinnaSenseCluster',createdAt:new Date().toISOString(),files:{}};
  for(const [name,data] of Object.entries({source:sourceData,destination:targetData})) {
    const contents=encode(data),path=resolve(backup,name+'.ejson');await writeFile(path,contents,{flag:'wx'});
    const saved=await readFile(path,'utf8');if(saved!==contents)throw Error('BACKUP_VERIFICATION_FAILED');
    manifest.files[name+'.ejson']={sha256:createHash('sha256').update(saved).digest('hex'),counts:Object.fromEntries(Object.entries(data).map(([n,rows])=>[n,rows.length]))};
  }
  await writeFile(resolve(backup,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  const session=await destination.startSession();
  try {
    await session.withTransaction(async()=>{
      for(const [name,rows] of Object.entries(pending)) {
        // Recheck within the transaction: concurrent changes must not be overwritten.
        for(const row of sourceData[name]) {
          const matches=await destination.db.collection(name).find({$or:[{_id:row._id},collections[name](row)]},{session}).toArray();
          if(matches.some(existing=>encode(existing)!==encode(row)))throw Error('CONCURRENT_COLLISION');
        }
        if(rows.length)await destination.db.collection(name).insertMany(rows,{session});
      }
    });
  } finally {await session.endSession();}
  for(const [name,rows] of Object.entries(sourceData)) {
    for(const row of rows)if(encode(await destination.db.collection(name).findOne({_id:row._id}))!==encode(row))throw Error('POST_TRANSFER_VERIFICATION_FAILED');
  }
  console.log(JSON.stringify({status:'verified',database:destination.name,backup,inserted:Object.fromEntries(Object.entries(pending).map(([name,rows])=>[name,rows.length])),counts:Object.fromEntries(await Promise.all(Object.keys(collections).map(async name=>[name,await destination.db.collection(name).countDocuments()])))}));
} catch(error) {
  // Driver exceptions may contain credentials/connection URLs; never print them.
  console.error(JSON.stringify({status:'failed',errorType:error.name,code:typeof error.code==='number'?error.code:undefined,safeReason:/^[A-Z_]+$/.test(error.message)?error.message:'Connection or transfer failed; no secret details printed.'}));
  process.exitCode=1;
} finally {await Promise.allSettled(connections.map(connection=>connection.close()));}

import mongoose from 'mongoose';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {Sample, SensorReading} from '../src/module02/models.js';
import {PP1_URI, pp1Records, verifyPp1Target, verifyPp1Connection} from '../src/module02/pp1Dataset.js';

export async function seedPp1(uri = PP1_URI) {
  verifyPp1Target(uri);
  await mongoose.connect(uri, {serverSelectionTimeoutMS: 5000});
  try {
    verifyPp1Connection();
    const existingResearch = await Sample.exists({archivedAt: null, dataOrigin: {$ne: 'DEMO_DATA'}});
    if (existingResearch) return {reusedExistingResearch: true, database: mongoose.connection.name,
      samples: await Sample.countDocuments({archivedAt: null}), observations: await SensorReading.countDocuments({})};
    const {samples, readings} = pp1Records();
    const insertedAt = new Date();
    for (const row of [...samples, ...readings]) Object.assign(row, {createdAt: insertedAt, updatedAt: insertedAt});
    // Preflight every identifier and document before writing anything. Never overwrite.
    for (const row of samples) {
      await new Sample(row).validate();
      const existing = await Sample.findOne({sampleId: row.sampleId});
      if (existing && (existing.dataOrigin !== 'DEMO_DATA' || existing.archivedAt)) throw new Error('Seed sample identifier belongs to a protected or archived record.');
    }
    for (const row of readings) {
      await new SensorReading(row).validate();
      const existing = await SensorReading.findOne({deviceId: row.deviceId, measurementId: row.measurementId});
      if (existing && (existing.sampleId !== row.sampleId || existing.dataOrigin !== 'DEMO_DATA')) throw new Error('Measurement identifier belongs to a protected record.');
    }
    await Promise.all([Sample.init(), SensorReading.init()]);
    for (const row of samples) await Sample.updateOne({sampleId: row.sampleId}, {$setOnInsert: row}, {upsert: true, timestamps: false});
    for (const row of readings) await SensorReading.updateOne({deviceId: row.deviceId, measurementId: row.measurementId}, {$setOnInsert: row}, {upsert: true, timestamps: false});
    return {database: mongoose.connection.name, origin: 'DEMO_DATA', samples: await Sample.countDocuments({dataOrigin:'DEMO_DATA'}), observations: await SensorReading.countDocuments({dataOrigin:'DEMO_DATA'})};
  } finally {await mongoose.disconnect();}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {values} = parseArgs({options: {uri: {type:'string', default:PP1_URI}}});
  seedPp1(values.uri).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error('PP1 seed refused or failed:',error.name);process.exitCode=1;});
}

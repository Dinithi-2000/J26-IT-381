// Internal integration boundary: never accepts untrusted browser predictions.
import mongoose from 'mongoose';
import { Sample, SensorReading, SampleImage, DegradationPrediction } from './models.js';
import { fail, id, text, date, number, object } from './validation.js';
export async function saveModelPrediction(output) {
  object(output,['sampleId','modelVersion','predictedAt','horizonDays','riskCategory','readingIds','imageIds']);
  const sampleId = id(output.sampleId);
  if (!await Sample.exists({sampleId})) fail(404,'SAMPLE_NOT_FOUND','Sample does not exist.');
  const values = {sampleId,modelVersion:text(output.modelVersion,'modelVersion'),predictedAt:date(output.predictedAt,'predictedAt'),horizonDays:number(output.horizonDays,'horizonDays',1,365),riskCategory:output.riskCategory};
  if (!Number.isInteger(values.horizonDays) || !['low','moderate','high'].includes(values.riskCategory)) fail(400,'VALIDATION_ERROR','Invalid model output.');
  for (const [field,Model] of [['readingIds',SensorReading],['imageIds',SampleImage]]) {
    const refs = output[field] || [];
    if (!Array.isArray(refs) || refs.length > 1000 || refs.some(ref=>typeof ref !== 'string' || !mongoose.isObjectIdOrHexString(ref)) || new Set(refs).size !== refs.length) fail(400,'VALIDATION_ERROR','Invalid input references.');
    if (await Model.countDocuments({_id:{$in:refs},sampleId}) !== refs.length) fail(400,'VALIDATION_ERROR','Input references must belong to the same sample.');
    values[field] = refs;
  }
  if (!values.readingIds.length && !values.imageIds.length) fail(400,'VALIDATION_ERROR','Model output must reference at least one input.');
  return DegradationPrediction.create(values);
}

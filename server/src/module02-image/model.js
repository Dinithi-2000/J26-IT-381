import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  sampleId:{type:String,required:true,index:true},deviceId:String,
  capturedAt:{type:Date,required:true,index:true},filename:{type:String,required:true},contentType:{type:String,required:true},sizeBytes:{type:Number,required:true},
  analysisStatus:{type:String,enum:['pending','completed','model_unavailable','failed'],default:'pending'},
  predictedCondition:{type:String,enum:['Good Quality','Suspected Mold']},modelScore:{type:Number,min:0,max:1},
  scores:{'Good Quality':Number,'Suspected Mold':Number},modelVersion:String,analyzedAt:Date,errorCode:String,
  prototype:{type:Boolean,default:true},
},{timestamps:true,bufferCommands:false});
schema.index({sampleId:1,capturedAt:-1,_id:-1});
export const ImageConditionAnalysis=mongoose.model('Module02ImageConditionAnalysis',schema,'module02_image_condition_analyses');

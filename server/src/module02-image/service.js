export class ImageServiceError extends Error { constructor(code,message,status=503) {super(message);this.code=code;this.status=status;} }
export function validateResult(body) {
 const labels=['Good Quality','Suspected Mold'];
 if (!body || !labels.includes(body.predictedCondition) || !Number.isFinite(body.modelScore) || body.modelScore<0 || body.modelScore>1 || typeof body.modelVersion!=='string' || !body.modelVersion.trim() || !Number.isFinite(Date.parse(body.analyzedAt)) || body.prototype!==true || !labels.every(label=>Number.isFinite(body.scores?.[label]) && body.scores[label]>=0 && body.scores[label]<=1) || Math.abs(labels.reduce((sum,label)=>sum+body.scores[label],0)-1)>0.0001 || Math.abs(body.modelScore-body.scores[body.predictedCondition])>0.0001 || body.modelScore < Math.max(...labels.map(label=>body.scores[label]))-0.0001) throw new ImageServiceError('INVALID_MODEL_RESPONSE','Image service returned an invalid output.');
 return {predictedCondition:body.predictedCondition,modelScore:body.modelScore,scores:body.scores,modelVersion:body.modelVersion,analyzedAt:new Date(body.analyzedAt),prototype:true};
}
export async function imageService(path,{bytes,contentType,fetcher=globalThis.fetch}={}) {
 const base=process.env.MODULE02_IMAGE_SERVICE_URL || 'http://127.0.0.1:8002';
 const token=process.env.MODULE02_IMAGE_SERVICE_TOKEN || '';
 if(bytes && token.length<32) throw new ImageServiceError('AUTH_UNCONFIGURED','Configure a separate inference-service token.');
 let response;
 try{ response=await fetcher(`${base.replace(/\/$/,'')}${path}`,{method:bytes?'POST':'GET',headers:bytes?{'Content-Type':contentType,'X-Quality-Service-Token':token}:{},body:bytes,signal:AbortSignal.timeout(bytes?30000:3000)}); }
 catch{throw new ImageServiceError('IMAGE_SERVICE_UNAVAILABLE','The image inference service cannot be reached.');}
 let body;try{body=await response.json();}catch{throw new ImageServiceError('INVALID_MODEL_RESPONSE','The image service returned an unreadable response.');}
 if(!response.ok) {
  const code=body.detail?.code || body.code || 'IMAGE_SERVICE_UNAVAILABLE';
  throw new ImageServiceError(['MODEL_UNAVAILABLE','INVALID_IMAGE','AUTH_UNCONFIGURED'].includes(code)?code:'IMAGE_SERVICE_UNAVAILABLE',code==='MODEL_UNAVAILABLE'?'No trained image-condition model is loaded.':'The image service could not classify this image.',code==='INVALID_IMAGE'?400:503);
 }
 return bytes?validateResult(body):body;
}

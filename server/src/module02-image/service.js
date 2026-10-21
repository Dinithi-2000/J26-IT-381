export class ImageServiceError extends Error {
 constructor(code,message,status=503) {super(message);this.code=code;this.status=status;}
}
export function validateResult(body) {
 const labels=Object.hasOwn(body?.scores || {},'good_quality')?['Suspected Mold','good_quality']:['Good Quality','Suspected Mold'];
 if (!body || !labels.includes(body.predictedCondition) || !Number.isFinite(body.modelScore) || body.modelScore<0 || body.modelScore>1 || typeof body.modelVersion!=='string' || !body.modelVersion.trim() || !Number.isFinite(Date.parse(body.analyzedAt)) || body.prototype!==true || Object.keys(body.scores || {}).length!==2 || !labels.every(label=>Number.isFinite(body.scores?.[label]) && body.scores[label]>=0 && body.scores[label]<=1) || Math.abs(labels.reduce((sum,label)=>sum+body.scores[label],0)-1)>0.0001 || Math.abs(body.modelScore-body.scores[body.predictedCondition])>0.0001 || body.modelScore < Math.max(...labels.map(label=>body.scores[label]))-0.0001) throw new ImageServiceError('INVALID_MODEL_RESPONSE','Image service returned an invalid output.');
 return {predictedCondition:body.predictedCondition,modelScore:body.modelScore,scores:body.scores,modelVersion:body.modelVersion,analyzedAt:new Date(body.analyzedAt),prototype:true};
}
export async function imageService(path,{bytes,contentType,source='manual_upload',fetcher=globalThis.fetch}={}) {
 const base=process.env.MODULE02_IMAGE_SERVICE_URL || 'http://127.0.0.1:8002';
 const token=process.env.MODULE02_IMAGE_SERVICE_TOKEN || '';
 const authenticated=path!=='/health';
 if(authenticated && token.length<32) throw new ImageServiceError('AUTH_UNCONFIGURED','Configure a separate inference-service token.');
 let response;
 try {
  response=await fetcher(`${base.replace(/\/$/,'')}${path}`,{method:bytes?'POST':'GET',headers:{...(bytes?{'Content-Type':contentType,'X-Image-Source':source}:{}),...(authenticated?{'X-Quality-Service-Token':token}:{})},body:bytes,signal:AbortSignal.timeout(path.startsWith('/camera/')?45000:bytes?30000:3000)});
 }catch{throw new ImageServiceError('IMAGE_SERVICE_UNAVAILABLE','The image inference service cannot be reached.');}
 if(response.ok && path==='/camera/capture') {
  if(response.headers.get('content-type')?.split(';')[0]!=='image/jpeg') throw new ImageServiceError('CAMERA_INVALID_IMAGE','Camera service did not return JPEG bytes.',502);
  const chunks=[];let size=0;
  const reader=response.body?.getReader();
  if(!reader)throw new ImageServiceError('CAMERA_INVALID_IMAGE','Camera service returned an empty image.',502);
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();throw new ImageServiceError('CAMERA_IMAGE_TOO_LARGE','Camera image exceeds 5 MiB.',413);}chunks.push(Buffer.from(value));}}
  catch(error){if(error instanceof ImageServiceError)throw error;throw new ImageServiceError('CAMERA_UNREACHABLE','Camera image transfer failed.',502);}
  const capturedAt=response.headers.get('x-captured-at');
  if(!size || !Number.isFinite(Date.parse(capturedAt)))throw new ImageServiceError('CAMERA_INVALID_RESPONSE','Camera service returned invalid capture metadata.',502);
  return {bytes:Buffer.concat(chunks),contentType:'image/jpeg',capturedAt};
 }
 let body;try{body=await response.json();}catch{throw new ImageServiceError('INVALID_MODEL_RESPONSE','The image service returned an unreadable response.');}
 if(!response.ok) {
  const code=body.detail?.code || body.code || 'IMAGE_SERVICE_UNAVAILABLE';
  const messages={MODEL_UNAVAILABLE:'No compatible trained image-condition model is loaded.',INVALID_IMAGE:'The image could not be decoded.',AUTH_UNCONFIGURED:'Configure the inference-service token.',CAMERA_NOT_CONFIGURED:'Configure ESP32_CAM_URL in the Python service.',CAMERA_UNREACHABLE:'Camera is unreachable. Check power, Wi-Fi and its current IP address.',CAMERA_TIMEOUT:'Camera capture timed out.',CAMERA_INVALID_RESPONSE:'Camera returned an unexpected response.',CAMERA_INVALID_IMAGE:'Camera returned an invalid JPEG.',CAMERA_IMAGE_TOO_LARGE:'Camera image exceeds 5 MiB.'};
  const known=Object.hasOwn(messages,code);
  throw new ImageServiceError(known?code:'IMAGE_SERVICE_UNAVAILABLE',known?messages[code]:'The image service could not complete the request.',known && [400,413,502,503,504].includes(response.status)?response.status:503);
 }
 return bytes?validateResult(body):body;
}

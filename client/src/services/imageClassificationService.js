const base='/api/module-02/image-classification';
const presentationBase = base;
export async function imageRequest(path,{signal,method='GET',file,token,baseUrl=base}={}) {
 let response;
 try{response=await fetch(`${baseUrl}${path}`,{signal,method,headers:{...(file?{'Content-Type':file.type}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:file});}
 catch(error){if(error.name==='AbortError')throw error;throw new Error('The image backend cannot be reached. Check that Express is running.');}
 let body;try{body=await response.json();}catch{throw new Error('The image backend returned an unreadable response.');}
 if(!response.ok)throw Object.assign(new Error(body.error?.message || 'Image request failed.'),{code:body.error?.code});
 return body;
}
// Phone cameras produce 12-50 MP photos; the server accepts at most 20 MP and 5 MiB,
// and the model only needs 224 px. Shrink large photos in the browser before upload.
export const MAX_UPLOAD_SIDE = 1600;
export async function shrinkPhoto(file, maxSide = MAX_UPLOAD_SIDE) {
 if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
 let bitmap;
 try { bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'}); }
 catch { return file; }
 try {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 4 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg'}) : file;
 } finally { bitmap.close?.(); }
}
export const imageClassificationService={
 cameraStatus:token=>imageRequest('/camera/status',{token}),
 capture:(sampleId,token)=>imageRequest(`/camera?sampleId=${encodeURIComponent(sampleId)}`,{method:'POST',token}),
 status:options=>imageRequest('/status',{...options,baseUrl:presentationBase}),
 preview:async(file,token,options)=>imageRequest('/preview',{...options,method:'POST',file:await shrinkPhoto(file),token,baseUrl:presentationBase}),
 history:(sampleId,page=1,options)=>imageRequest(`/history?sampleId=${encodeURIComponent(sampleId)}&page=${page}&limit=12`,options),
 upload:async(sampleId,file,token)=>imageRequest(`/images?sampleId=${encodeURIComponent(sampleId)}`,{method:'POST',file:await shrinkPhoto(file),token}),
 analyze:(id,token)=>imageRequest(`/${encodeURIComponent(id)}/analyze`,{method:'POST',token}),
};

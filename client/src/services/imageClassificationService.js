const base='/api/module-02/image-classification';
export async function imageRequest(path,{signal,method='GET',file,token}={}) {
 let response;
 try{response=await fetch(`${base}${path}`,{signal,method,headers:{...(file?{'Content-Type':file.type}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:file});}
 catch(error){if(error.name==='AbortError')throw error;throw new Error('The image backend cannot be reached. Check that Express is running.');}
 let body;try{body=await response.json();}catch{throw new Error('The image backend returned an unreadable response.');}
 if(!response.ok)throw Object.assign(new Error(body.error?.message || 'Image request failed.'),{code:body.error?.code});
 return body;
}
export const imageClassificationService={
 cameraStatus:token=>imageRequest('/camera/status',{token}),
 capture:(sampleId,token)=>imageRequest(`/camera?sampleId=${encodeURIComponent(sampleId)}`,{method:'POST',token}),
 status:options=>imageRequest('/status',options),
 history:(sampleId,page=1,options)=>imageRequest(`/history?sampleId=${encodeURIComponent(sampleId)}&page=${page}&limit=12`,options),
 upload:(sampleId,file,token)=>imageRequest(`/images?sampleId=${encodeURIComponent(sampleId)}`,{method:'POST',file,token}),
 analyze:(id,token)=>imageRequest(`/${encodeURIComponent(id)}/analyze`,{method:'POST',token}),
};

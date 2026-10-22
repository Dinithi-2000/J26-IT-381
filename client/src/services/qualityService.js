export class QualityServiceError extends Error {
  constructor(message, code) { super(message); this.name = 'QualityServiceError'; this.code = code; }
}
export const normalizeQualityReading = (row, sample) => ({...row,id:row._id,timestamp:row.recordedAt,
  day:Math.floor((Date.parse(row.recordedAt)-Date.parse(sample.storageStartTimestamp || sample.storageStartDate))/86400000),
  weight:row.weightGrams,temperature:row.temperatureC,humidity:row.relativeHumidityPercent,rgb:[row.red,row.green,row.blue]});
export function createQualityService({ baseUrl = '/api', fetcher = globalThis.fetch } = {}) {
  async function request(path, { signal, method = 'GET', body, token, cache } = {}) {
    let response;
    try { response = await fetcher(`${baseUrl.replace(/\/$/,'')}${path}`, {signal,method,...(cache ? {cache} : {}),headers:{ ...(body ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {}) },...(body ? {body:JSON.stringify(body)} : {})}); }
    catch(error) { if(error.name === 'AbortError') throw error; throw new QualityServiceError('Cannot reach the quality backend. Check that the Express server is running.','DISCONNECTED'); }
    let result;
    try { result = await response.json(); } catch { throw new QualityServiceError('The quality backend returned an unreadable response.','DISCONNECTED'); }
    if(!response.ok) throw new QualityServiceError(result.error?.message || `Quality API returned HTTP ${response.status}.`,result.error?.code || 'REQUEST_FAILED');
    return result;
  }
  const path = id => `/module-02/samples/${encodeURIComponent(id)}`;
  const normalize = sample => ({...sample,id:sample.sampleId,initialWeight:sample.initialWeightGrams,storageStartTimestamp:sample.storageStartDate,storageStartDate:String(sample.storageStartDate ?? '').slice(0,10),records:[],images:[],predictions:[],deviceStatus:{status:'offline'},detailsLoaded:false});
  return {
    async getSamples(options) {
      // Sample summaries are paginated; obtain all pages without fetching sensor histories for every sample.
      let page = 1, pages = 1, samples = [];
      do { const result = await request(`/samples?limit=200&page=${page}`,options); samples.push(...result.data.map(normalize)); pages=result.pagination.pages; page++; } while(page<=pages);
      // Preserve server provenance. Stored illustrative records remain explicitly labeled.
      return samples;
    },
    async getSampleData(sample, options) {
      const {skipLatest = false, ...requestOptions} = options || {};
      const [history,latest,images,predictions,baseline] = await Promise.all([
        request(`${path(sample.id)}/readings?limit=200`,requestOptions),skipLatest ? Promise.resolve({deviceStatus:sample.deviceStatus}) : request(`/module-02/readings/latest?sampleId=${encodeURIComponent(sample.id)}`,requestOptions),
        request(`${path(sample.id)}/images?limit=200`,requestOptions),request(`${path(sample.id)}/predictions?limit=200`,requestOptions),request(`${path(sample.id)}/readings?limit=1&order=asc`,requestOptions),
      ]);
      const normalizeReading = row => normalizeQualityReading(row,sample);
      return {...sample,baselineRecord:baseline.data[0] ? normalizeReading(baseline.data[0]) : null,detailsLoaded:true,historyTotal:history.pagination.total,imageTotal:images.pagination.total,predictionTotal:predictions.pagination.total,
        records:history.data.reverse().map(normalizeReading),
        images:images.data.map(row=>({...row,id:row._id,src:row.url,timestamp:row.recordedAt,kind:'photograph'})),predictions:predictions.data,deviceStatus:latest.deviceStatus};
    },
    createSample: (input,token) => request('/samples',{method:'POST',token,body:{sampleId:input.id,batchId:input.batchId,grade:input.grade,storage:input.storage,storageStartDate:input.storageStartDate,initialWeightGrams:input.initialWeight}}).then(normalize),
    updateSample: (id,body,token) => request(`/samples/${encodeURIComponent(id)}`,{method:'PATCH',body,token}),
    archiveSample: (id,token) => request(`/samples/${encodeURIComponent(id)}`,{method:'DELETE',token}),
    getLatestReading: (id,options) => request(`/module-02/readings/latest?sampleId=${encodeURIComponent(id)}`,options),
    getMeasurements: (id,options) => request(`${path(id)}/readings?limit=200`,options),
    getImages: (id,options) => request(`${path(id)}/images?limit=200`,options),
    getPredictions: (id,options) => request(`${path(id)}/predictions?limit=200`,options),
    createRiskPrediction: (sampleId,readingId,token,options={}) => request('/module-02/risk-predictions',{...options,method:'POST',token,body:{sampleId,readingId}}),
    getRiskPredictions: (id,token,page=1,options={}) => request(`${path(id)}/risk-predictions?page=${page}&limit=30`,{...options,token}),
  };
}
// All stored Module 02 data uses the main Atlas-backed Node API.
export const qualityService = createQualityService({baseUrl: '/api'});

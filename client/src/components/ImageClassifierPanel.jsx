import {useEffect,useState} from 'react';
import {useQuality} from './QualityProvider';
import AssetImage from './AssetImage';
import {Panel} from './QualityUI';
import {imageClassificationService as service} from '../services/imageClassificationService';
import {formatTimestamp} from '../data/demoQuality';

const scoreText = score => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
 ? `${(score * 100).toFixed(1)}%` : 'Not available';
const resultTime = timestamp => timestamp && Number.isFinite(Date.parse(timestamp)) ? formatTimestamp(timestamp) : 'Not available';

export function ImageClassificationResult({row}) {
 if (!row) return <section className="classifier-latest" aria-label="Latest image analysis"><h3>Latest image result</h3><p>No image classification available. Upload an actual registered sample photograph or load its stored history.</p></section>;
 return <section className="classifier-latest" aria-label="Latest image analysis" aria-live="polite">
  <h3>Latest image result - {row.sampleId}</h3>
  <div className="module02-image-result">
   <AssetImage src={row.imageUrl} fallback={null} alt={`Image submitted for ${row.sampleId} classification`} className="classifier-result-image" />
   <div><span className="small-badge">MODEL 01 / STORED IMAGE</span>
    <h4>{row.analysisStatus === 'completed' ? row.predictedCondition : 'Not classified'}</h4>
    <dl className="detail-list">
     <div><dt>Confidence score (uncalibrated model output)</dt><dd>{row.analysisStatus === 'completed' ? scoreText(row.modelScore) : 'Not available'}</dd></div>
     <div><dt>Classification timestamp</dt><dd>{resultTime(row.analyzedAt)}</dd></div>
     <div><dt>Image captured</dt><dd>{resultTime(row.capturedAt)}</dd></div>
     <div><dt>Source</dt><dd>{row.source === 'esp32_cam' ? 'ESP32-CAM' : row.source === 'manual_upload' ? 'Manual upload' : 'Not available'}</dd></div>
     <div><dt>Model version</dt><dd>{row.modelVersion || 'Not available'}</dd></div>
    </dl>
    {row.analysisStatus === 'completed' && !!Object.keys(row.scores || {}).length && <details><summary>Class score breakdown</summary><dl className="detail-list">{Object.entries(row.scores).map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{scoreText(score)}</dd></div>)}</dl></details>}
    {row.analysisStatus !== 'completed' && <p>No prediction generated: {row.errorCode || row.analysisStatus || 'Not available'}</p>}
    <p className="panel-caption">This score is not calibrated confidence or a verified probability of mold. Suspected Mold is a visual suspicion requiring independent confirmation, not food-safety certification or a future forecast.</p>
   </div>
  </div>
 </section>;
}

export default function ImageClassifierPanel(){
 const {selected,demoEnabled}=useQuality();
 const illustrative = selected?.dataOrigin === 'DEMO_DATA';
 const [sampleId,setSampleId]=useState(''),[token,setToken]=useState(''),[file,setFile]=useState(null),[preview,setPreview]=useState('');
 const [model,setModel]=useState({state:'loading',message:''}),[history,setHistory]=useState({data:[],pagination:{page:1,pages:0,total:0}});
 const [activeId,setActiveId]=useState(''),[busy,setBusy]=useState(false),[historyBusy,setHistoryBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [revision,setRevision]=useState(0);
 const [camera,setCamera]=useState({state:'unchecked',message:'Camera connection has not been checked.'});
 const [latest,setLatest]=useState(null);
 useEffect(()=>{const controller=new AbortController();setModel({state:'loading',message:''});service.status({signal:controller.signal}).then(body=>setModel({state:body.status==='ready'?'ready':'unavailable',version:body.modelVersion,message:'Two-class visual prototype. Scores are not calibrated confidence.'})).catch(failure=>{if(!controller.signal.aborted)setModel({state:'unavailable',message:failure.message});});return()=>controller.abort();},[revision]);
 useEffect(()=>{setLatest(null);setFile(null);setError('');setNotice('');if(!demoEnabled&&!illustrative&&selected?.id){setSampleId(selected.id);setActiveId(selected.id);}else{setSampleId('');setActiveId('');setHistory({data:[],pagination:{page:1,pages:0,total:0}});}},[selected?.id,demoEnabled,illustrative]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(!activeId||demoEnabled)return;const controller=new AbortController();setHistoryBusy(true);setHistory({data:[],pagination:{page:1,pages:0,total:0}});service.history(activeId,1,{signal:controller.signal}).then(body=>{if(!controller.signal.aborted){setHistory(body);setError('');}}).catch(failure=>{if(!controller.signal.aborted)setError(failure.message);}).finally(()=>{if(!controller.signal.aborted)setHistoryBusy(false);});return()=>controller.abort();},[activeId,demoEnabled,revision]);
 const validId=()=>/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(sampleId);
 async function upload(event){event.preventDefault();setError('');setNotice('');
  if(!validId())return setError('Enter a sample ID with 2-64 letters, digits, hyphens or underscores.');
  if(!file||!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024||!file.size)return setError('Choose a JPEG or PNG image, no larger than 5 MiB.');
  if(!token)return setError('Enter the configured operator token.');
  setBusy(true);
  try{const row=await service.upload(sampleId,file,token);setLatest(row);setActiveId(sampleId);setRevision(value=>value+1);setNotice(row.analysisStatus==='completed'?'Image stored and classified by the configured research prototype.':'Image stored. No classification was generated: '+(row.errorCode || row.analysisStatus)+'. You can retry analysis after configuring the service and model.');}
  catch(failure){setError(failure.message);}finally{setBusy(false);}
 }
 async function checkCamera(){
  if(!token)return setCamera({state:'error',message:'Enter your operator token before checking the camera.'});
  setBusy(true);setCamera({state:'checking',message:'Checking the configured capture endpoint...'});
  try{const result=await service.cameraStatus(token);setCamera({state:'connected',message:result.message,checkedAt:result.checkedAt});}
  catch(failure){setCamera({state:'error',message:failure.message});}finally{setBusy(false);}
 }
 async function capture(){
  setError('');setNotice('');
  if(!validId())return setError('Select or enter a registered sample ID before capturing.');
  if(!token)return setError('Enter your operator token before capturing.');
  setBusy(true);setLatest(null);setCamera({state:'capturing',message:'Fetching a JPEG and requesting model inference...'});
  try{const row=await service.capture(sampleId,token);setFile(null);setLatest(row);setActiveId(sampleId);setRevision(value=>value+1);setCamera({state:'connected',message:'A camera image was captured and stored.',checkedAt:row.capturedAt});setNotice(row.analysisStatus==='completed'?'Camera image stored and classified.':'Camera image stored, but classification is unavailable: '+(row.errorCode||row.analysisStatus));}
  catch(failure){setError(failure.message);setCamera({state:'error',message:failure.message});}finally{setBusy(false);}
 }
 async function page(number){setHistoryBusy(true);setError('');try{setHistory(await service.history(activeId,number));}catch(failure){setError(failure.message);}finally{setHistoryBusy(false);}}
 async function retry(id){setBusy(true);setError('');setNotice('');try{const row=await service.analyze(id,token);setLatest(previous=>previous?._id===row._id?row:previous);setHistory(previous=>({...previous,data:previous.data.map(item=>item._id===id?row:item)}));if(row.analysisStatus!=='completed')setNotice('Analysis unavailable: '+(row.errorCode||row.analysisStatus));}catch(failure){setError(failure.message);}finally{setBusy(false);}}
 return <Panel title="Image condition prototype" eyebrow="MODEL 01 / GOOD QUALITY VS SUSPECTED MOLD" badge={model.state==='ready'?'RESEARCH PROTOTYPE':model.state==='loading'?'CHECKING MODEL':'MODEL UNAVAILABLE'} className="classifier-panel">
  <p>Classify the current visible condition of a manually uploaded or ESP32-CAM image. This two-class prototype does not detect physical damage or discoloration, predict future degradation, or confirm mold contamination.</p>
  <p role="status">{model.state==='ready'?`Loaded model: ${model.version}. `:''}{model.message}</p>
  {demoEnabled||illustrative?<p className="research-note">{illustrative ? 'This illustrative database sample has no captured photograph or image classification. Choose a registered real sample to use Model 01. No image scores are fabricated.' : 'Turn off demo mode to work with actual images. No model scores are fabricated for demonstration samples.'}</p>:<>
   <form onSubmit={upload} className="sample-form">
    <fieldset disabled={busy}><legend>Upload an actual sample photograph</legend>
     <div className="form-grid">
      <label>Sample ID<input value={sampleId} maxLength={64} onChange={event=>{setSampleId(event.target.value);setLatest(null);}} required placeholder="Your registered research sample ID" /></label>
      <label>Operator token<input type="password" value={token} autoComplete="off" onChange={event=>setToken(event.target.value)} required /></label>
      <label>JPEG or PNG photograph (maximum 5 MiB)<input type="file" accept="image/jpeg,image/png" onChange={event=>{setFile(event.target.files?.[0]||null);setNotice('');setLatest(null);}} /></label>
     </div>
     <p className="panel-caption">The token stays in this component memory. Images are saved on the backend. Sample IDs associate photographs with your research records; register samples in the Sample Management page before capturing or uploading.</p>
     {preview&&!latest&&<figure className="classifier-preview"><img src={preview} alt="Selected cinnamon sample before upload"/><figcaption>Selected image - not yet classified</figcaption></figure>}
     <section className="classifier-camera" aria-label="ESP32-CAM controls">
      <h3>ESP32-CAM capture</h3>
      <p role="status" aria-live="polite">{camera.message}{camera.checkedAt?` Last response: ${formatTimestamp(camera.checkedAt)}.`:''}</p>
      <p className="panel-caption">Uses the configured CameraWebServer capture endpoint. A successful check describes one response, not a continuous live connection.</p>
      <div className="classifier-actions"><button className="button secondary" type="button" onClick={checkCamera}>Check camera connection</button><button className="button" type="button" onClick={capture}>Capture and predict</button></div>
     </section>
     <div className="classifier-actions"><button className="button" type="submit">{busy?'Processing...':'Store image and request classification'}</button>
      <button className="button secondary" type="button" disabled={!validId()||historyBusy} onClick={()=>{setError('');setHistory({data:[],pagination:{page:1,pages:0,total:0}});setActiveId(sampleId);setRevision(value=>value+1);}}>Load sample history</button></div>
    </fieldset>
   </form>
   {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <ImageClassificationResult row={latest || history.data[0]} />
   <div className="classifier-history" aria-busy={historyBusy}>
    <h3>Stored image and classification history{activeId?` - ${activeId}`:''}</h3>
    {historyBusy?<p role="status">Loading stored image records...</p>:!history.data.length?<p>No image records loaded. Enter a sample ID and load its history, or upload a photograph.</p>:<>
     <div className="classifier-cards">{history.data.map(row=><article key={row._id} className="classifier-record">
      <AssetImage src={row.imageUrl} fallback={null} alt={`Stored cinnamon sample ${row.sampleId}`} loading="lazy" />
      <h4>{row.analysisStatus==='completed'?row.predictedCondition:'Not classified'}</h4>
      <p>Captured: {formatTimestamp(row.capturedAt)}<br/>Source: {row.source==='esp32_cam'?'ESP32-CAM':'Manual upload'}</p>
      {row.analysisStatus==='completed'?<><p><strong>Model score: {scoreText(row.modelScore)}</strong></p><p>Uncalibrated score, not confirmed mold probability.</p><p>Model: {row.modelVersion}<br/>Analyzed: {formatTimestamp(row.analyzedAt)}</p></>:<p>Status: {row.analysisStatus} {row.errorCode?`(${row.errorCode})`:''}</p>}
      <p className="panel-caption">Visual research screening only. Suspected mold requires independent confirmation.</p>
      <button className="button secondary" type="button" disabled={busy||!token} onClick={()=>retry(row._id)}>Retry analysis</button>
     </article>)}</div>
     <div className="classifier-actions"><button type="button" className="button secondary" disabled={historyBusy||history.pagination.page<=1} onClick={()=>page(history.pagination.page-1)}>Previous</button><span>Page {history.pagination.page} of {history.pagination.pages} - {history.pagination.total} records</span><button type="button" className="button secondary" disabled={historyBusy||history.pagination.page>=history.pagination.pages} onClick={()=>page(history.pagination.page+1)}>Next</button></div>
    </>}
   </div>
  </>}
 </Panel>;
}

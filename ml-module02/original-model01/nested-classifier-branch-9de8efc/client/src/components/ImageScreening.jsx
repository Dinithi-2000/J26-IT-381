import { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../data/demoQuality';
import { checkImageFile, imageAnalysisService, percent } from '../services/imageAnalysisService';
import { Panel } from './QualityUI';
import { useQuality } from './QualityProvider';
import Icon from './Icon';

// Module 02 / Model 01: live visible-condition screening of stored cinnamon photos.
const PROPOSAL_CLASSES = ['Good quality', 'Discolored', 'Physical damage', 'Suspected mold'];
const toneOf = result => (result?.suspectedMold ? 'tone-mold' : 'tone-good');
const formatSize = bytes => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function ScreeningPanel({ model, defaultSampleId, onResult, result }) {
  const { samples, demoEnabled } = useQuality();
  const [sampleId, setSampleId] = useState(defaultSampleId || '');
  const [token, setToken] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  useEffect(() => { setSampleId(defaultSampleId || ''); }, [defaultSampleId]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function choose(nextFile) {
    const problem = checkImageFile(nextFile);
    setError(problem || '');
    if (problem) return;
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setStatus('idle');
  }

  async function analyse(event) {
    event.preventDefault();
    const problem = checkImageFile(file) || (!sampleId ? 'Choose a registered sample.' : !token ? 'Enter the operator token.' : null);
    if (problem) { setError(problem); return; }
    setStatus('analysing');
    setError('');
    try {
      const analysis = await imageAnalysisService.classify(file, sampleId, token);
      setStatus('done');
      onResult({ ...analysis, localImageUrl: URL.createObjectURL(file), fileName: file.name });
    } catch (requestError) {
      setStatus('error');
      setError(requestError.message);
    }
  }

  const ready = model.status === 'ready' && !demoEnabled;
  const badge = model.status === 'ready' ? 'MODEL ONLINE' : model.status === 'loading' ? 'CHECKING MODEL' : 'MODEL OFFLINE';
  return <Panel title="Screen a cinnamon photo" eyebrow="COMPUTER VISION / MODEL 01" badge={badge} className="screening-panel">
    <form className="screening-form" onSubmit={analyse}>
      {demoEnabled && <p className="form-hint">Turn off demo data to screen real photos. Results are only filed under registered samples.</p>}
      <label htmlFor="screening-sample"><span>Registered sample</span>
        <select id="screening-sample" value={sampleId} disabled={demoEnabled} onChange={event => setSampleId(event.target.value)}>
          <option value="">Choose a sample…</option>
          {!demoEnabled && samples.map(sample => <option key={sample.id} value={sample.id}>{sample.id}</option>)}
        </select>
      </label>
      <label htmlFor="screening-token"><span>Operator token <small>(kept in this form only)</small></span>
        <input id="screening-token" type="password" autoComplete="off" value={token} disabled={demoEnabled}
          onChange={event => setToken(event.target.value)} />
      </label>
      <div className={`dropzone${dragging ? ' is-dragging' : ''}${previewUrl ? ' has-image' : ''}`}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }}>
        {previewUrl
          ? <img src={previewUrl} alt="Selected cinnamon sample" />
          : <span className="dropzone-icon"><Icon name="camera" size={28} /></span>}
        <div>
          <strong>{file ? file.name : 'Choose a photo or drop it here'}</strong>
          <span>{file ? formatSize(file.size) : 'JPEG, PNG or WebP · up to 15 MB · one quill per photo'}</span>
          <button type="button" className="button secondary" onClick={() => input.current?.click()}>
            {file ? 'Choose another photo' : 'Choose photo'}
          </button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          tabIndex={-1} aria-hidden="true" onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={!ready || !file || !sampleId || !token || status === 'analysing'}>
        {status === 'analysing' ? 'Analysing…' : 'Analyse photo'} <Icon name="sparkles" size={18} />
      </button>
      {!ready && model.status !== 'loading' && <p className="form-hint">The image model is not reachable: {model.error}</p>}
    </form>
    <div aria-live="polite">{result && <ScreeningResult result={result} />}</div>
  </Panel>;
}

function ScreeningResult({ result }) {
  const imageUrl = result.image?.url || result.localImageUrl;
  return <article className={`screening-result ${toneOf(result)}`}>
    <img src={imageUrl} alt={`Analysed cinnamon sample${result.sampleId ? ` ${result.sampleId}` : ''}`} />
    <div>
      <p className="eyebrow">PREDICTED VISIBLE CONDITION</p>
      <h3>{result.predictedLabel}</h3>
      <p className="result-score">Model score <strong>{percent(result.modelScore)}</strong></p>
      <div className="score-bars">{result.topPredictions.map(item => <div key={item.condition}>
        <span>{item.label}</span><span className="score-track"><span style={{ width: percent(item.score) }} /></span><span>{percent(item.score)}</span>
      </div>)}</div>
      <dl className="detail-list">
        <div><dt>Sample ID</dt><dd>{result.sampleId || 'Not given'}</dd></div>
        <div><dt>Analysed</dt><dd>{formatTimestamp(result.analysedAt)}</dd></div>
        <div><dt>Status</dt><dd>{result.analysisStatus}</dd></div>
        <div><dt>Record</dt><dd>{result.record?.saved ? 'Saved to history' : 'Not saved (database offline)'}</dd></div>
      </dl>
      {result.suspectedMold && <div className="research-note"><Icon name="info" size={17} /><div>
        <strong>Image-based indication only</strong><p>Confirm suspected mould by physical inspection or laboratory testing.</p></div></div>}
    </div>
  </article>;
}

export function InterpretationPanel({ result }) {
  return <Panel title="A suspicion is not a confirmation." eyebrow="INTERPRETING RESULTS" className="risk-panel">
    <p>The model flags suspected fungal growth from appearance alone. An image-based suspicion stays distinct from confirmed fungal contamination.</p>
    <dl className="detail-list">
      <div><dt>Visual screening result</dt><dd>{result ? result.predictedLabel : 'Not assessed'}</dd></div>
      <div><dt>Suspected fungal growth</dt><dd>{result ? (result.suspectedMold ? 'Flagged (image-based)' : 'Not flagged') : 'Not assessed'}</dd></div>
      <div><dt>Confirmed fungal contamination</dt><dd>No confirmation data</dd></div>
    </dl>
  </Panel>;
}

export function ModelCard({ model }) {
  if (model.status !== 'ready') {
    return <Panel title="About the image model" eyebrow="MODEL 01 / AVAILABILITY" badge={model.status === 'loading' ? 'CHECKING' : 'OFFLINE'}>
      {model.status === 'loading' ? <p>Checking the image model…</p> : <>
        <p>{model.error}</p>
        <p className="panel-caption">Run the ML service (<code>npm run dev:ml</code>) and the API (<code>npm run dev</code>), then check again.</p>
        <button className="button secondary" onClick={model.retry}>Check again</button>
      </>}
    </Panel>;
  }
  const { info } = model;
  const metrics = info.testMetrics || {};
  const labels = info.classes.map(item => item.label);
  const missing = PROPOSAL_CLASSES.filter(label => !labels.some(found => found.toLowerCase() === label.toLowerCase()));
  const ci = metrics.accuracy95ci ? `95% CI ${percent(metrics.accuracy95ci[0], 0)}–${percent(metrics.accuracy95ci[1], 0)}` : '';
  return <Panel title="About the image model" eyebrow="MODEL 01 / HELD-OUT TEST RESULTS" badge="VALIDATION">
    <div className="model-metrics">
      <div><span>Test accuracy</span><strong>{percent(metrics.accuracy)}</strong><small>{ci}</small></div>
      <div><span>Macro F1</span><strong>{metrics.macroF1?.toFixed(2) ?? '—'}</strong><small>{metrics.testImages} test images</small></div>
      <div><span>Always-majority baseline</span><strong>{percent(metrics.majorityBaselineAccuracy)}</strong><small>accuracy to beat</small></div>
    </div>
    <dl className="detail-list">
      {Object.entries(metrics.perClass || {}).map(([condition, values]) => {
        const label = info.classes.find(item => item.condition === condition)?.label || condition;
        return <div key={condition}><dt>{label}: recall</dt><dd>{percent(values.recall, 0)} of {values.support}</dd></div>;
      })}
      <div><dt>Model version</dt><dd>{info.modelVersion}</dd></div>
    </dl>
    <div className="class-chips">{labels.map(label => <span key={label}>{label}</span>)}
      {missing.map(label => <span key={label} className="is-missing">{label} · not yet trained</span>)}</div>
    <p className="panel-caption">{info.caveats?.join(' ')}</p>
  </Panel>;
}

export function AnalysisHistory({ revision, sessionResults }) {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  useEffect(() => {
    const controller = new AbortController();
    imageAnalysisService.listAnalyses({ limit: 20 }, { signal: controller.signal })
      .then(items => setState({ status: 'ready', items, error: '' }))
      .catch(error => {
        if (!controller.signal.aborted) setState({ status: error.code === 'DATABASE_UNAVAILABLE' ? 'no-database' : 'error', items: [], error: error.message });
      });
    return () => controller.abort();
  }, [revision]);

  const items = state.status === 'ready' ? state.items : sessionResults;
  const badge = state.status === 'ready' ? `${items.length} SAVED` : `${items.length} THIS SESSION`;
  return <Panel title="Screening history" eyebrow="SAVED IMAGE ANALYSES" badge={badge} className="hardware-panel">
    {state.status === 'no-database' && <p className="form-hint">MongoDB is offline, so results are not being saved. Showing this session only.</p>}
    {state.status === 'error' && <p className="form-hint">{state.error} Showing this session only.</p>}
    {state.status === 'loading' ? <p>Loading history…</p> : !items.length ? <p>No photos analysed yet.</p> :
      <div className="table-wrap" tabIndex="0" role="region" aria-label="Screening history"><table>
        <caption>Most recent first · timestamps in Sri Lanka time</caption>
        <thead><tr>{['Photo', 'Sample ID', 'Result', 'Model score', 'Source', 'Analysed'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{items.map((item, index) => <tr key={item.id || `${item.analysedAt}-${index}`}>
          <td><img className="history-thumb" src={item.image?.url || item.localImageUrl} alt="" /></td>
          <td>{item.sampleId || '—'}</td>
          <td><span className={`result-pill ${toneOf(item)}`}>{item.predictedLabel}</span></td>
          <td>{percent(item.modelScore)}</td>
          <td>{item.source === 'esp32-cam' ? 'ESP32-CAM' : 'Upload'}</td>
          <td>{formatTimestamp(item.analysedAt)}</td>
        </tr>)}</tbody>
      </table></div>}
  </Panel>;
}

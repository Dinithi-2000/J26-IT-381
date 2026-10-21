import { useCallback, useEffect, useState } from 'react';
import { conditionService as api } from '../services/conditionService';
import { Panel } from './QualityUI';
import { formatTimestamp } from '../data/demoQuality';

const pretty = name => name.replace('_', ' ');

export default function ConditionClassifier({ sampleId }) {
  const [service, setService] = useState({ status: 'loading', classes: [], error: '' });
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [latest, setLatest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const health = await api.health();
      setService({ status: health.status, classes: health.classes, error: health.error || '' });
      setHistory(await api.list(undefined, 20));
      api.metrics().then(setMetrics).catch(() => setMetrics(null));
    } catch (e) {
      setService({ status: 'offline', classes: [], error: e.message });
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function onFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { setLatest(await api.classify(file, sampleId)); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function onCapture() {
    setBusy(true); setError('');
    try { setLatest(await api.capture(sampleId)); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const shown = latest || history[0];
  const report = metrics?.test_report;
  const online = service.status === 'ok';
  return <>
    <Panel title="Visible condition classification" eyebrow="MODEL 01 · MOBILENETV2" badge={online ? 'SERVICE ONLINE' : 'NOT CONNECTED'}>
      {!online && <p role="status">The image service is {service.status === 'offline' ? 'not reachable' : 'unavailable'}{service.error ? ` (${service.error})` : ''}. Start it from the quality-service folder with: uvicorn app.main:app --port 8001</p>}
      {online && <>
        <p>Classes the model can currently predict: <strong>{service.classes.map(pretty).join(', ')}</strong>. Discoloration and physical damage are not yet trained.</p>
        <label>
          <span>{busy ? 'Analysing…' : `Upload an image for ${sampleId || 'UNASSIGNED'}: `}</span>
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} />
        </label>
        <button type="button" className="button" onClick={onCapture} disabled={busy} style={{ marginLeft: 12 }}>Capture from ESP32-CAM</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </>}
      {shown && <div className="image-comparison" style={{ marginTop: 16 }}>
        <figure><img src={api.imageSrc(shown.imageUrl)} alt={`Analysed cinnamon sample ${shown.sampleId}`} style={{ maxWidth: '100%', borderRadius: 8 }} />
          <figcaption>{shown.source === 'esp32-cam' ? 'ESP32-CAM' : 'Dashboard upload'}</figcaption></figure>
        <dl className="detail-list">
          <div><dt>Predicted condition</dt><dd>{shown.predictedCondition}{shown.uncertain ? ' (low confidence)' : ''}</dd></div>
          <div><dt>Model score</dt><dd>{Math.round(shown.score * 100)}%</dd></div>
          <div><dt>Sample ID</dt><dd>{shown.sampleId}</dd></div>
          <div><dt>Analysed</dt><dd>{formatTimestamp(shown.createdAt)}</dd></div>
          <div><dt>Status</dt><dd>{shown.status}</dd></div>
        </dl>
      </div>}
      <p>A model score is not a calibrated probability. “Suspected Mold” is an image-based indication only and needs physical or laboratory confirmation.</p>
    </Panel>

    <Panel title="Held-out test performance" eyebrow="MODEL EVALUATION">
      {!report ? <p>No evaluation metrics available.</p> : <>
        <div className="table-wrap"><table>
          <caption>{metrics.test_images} test images · accuracy {Math.round(report.accuracy * 100)}% · group-wise split</caption>
          <thead><tr><th scope="col">Class</th><th scope="col">Precision</th><th scope="col">Recall</th><th scope="col">F1</th><th scope="col">Images</th></tr></thead>
          <tbody>{metrics.classes.map(c => <tr key={c}><td>{pretty(c)}</td>
            {['precision', 'recall', 'f1-score'].map(k => <td key={k}>{report[c][k].toFixed(2)}</td>)}<td>{report[c].support}</td></tr>)}</tbody>
        </table></div>
        <p>Confusion matrix (rows = actual, columns = predicted; {metrics.classes.map(pretty).join(' / ')}): {metrics.confusion_matrix.map(r => `[${r.join(', ')}]`).join(' ')}.</p>
        <p>{metrics.note}</p>
      </>}
    </Panel>

    <Panel title="Analysis history" eyebrow="STORED RESULTS">
      {!history.length ? <p>No images have been analysed yet.</p> : <div className="table-wrap"><table>
        <thead><tr><th scope="col">Time</th><th scope="col">Sample</th><th scope="col">Source</th><th scope="col">Condition</th><th scope="col">Score</th></tr></thead>
        <tbody>{history.map(h => <tr key={h.id}><td>{formatTimestamp(h.createdAt)}</td><td>{h.sampleId}</td>
          <td>{h.source === 'esp32-cam' ? 'ESP32-CAM' : 'Upload'}</td><td>{h.predictedCondition}{h.uncertain ? ' ⚠' : ''}</td><td>{Math.round(h.score * 100)}%</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}

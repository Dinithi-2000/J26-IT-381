import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel } from '../components/QualityUI';
import { uploadSamplePhoto } from '../services/sampleImages';
import { useOperatorToken } from '../services/operatorToken';
import {Module02MeasurementHistory as MeasurementHistory} from '../components/Module02SensorPanel';
import { formatTimestamp } from '../data/demoQuality';

export default function SampleDetails() {
  const { id } = useParams();
  const { samples, demoEnabled, status, setSelectedId, deviceStatus, refresh } = useQuality();
  const [token] = useOperatorToken();
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState({ text: '', error: false });
  const sample = samples.find(item => item.id === id);
  // Carry the opened sample into image and prediction views for a continuous workflow.
  useEffect(() => { if (sample) setSelectedId(sample.id); }, [sample, setSelectedId]);
  const hasBaseline = sample?.images.some(image => image.role === 'Baseline');
  async function upload(event) {
    event.preventDefault(); const form = event.currentTarget;
    setMessage({ text: '', error: false }); setBusy(true);
    try {
      await uploadSamplePhoto(sample.id, file, hasBaseline ? 'Current' : 'Baseline', token);
      setFile(null); form.reset(); refresh();
      setMessage({ text: hasBaseline ? 'Current photo saved.' : 'First (baseline) photo saved.', error: false });
    } catch (failure) { setMessage({ text: failure.message, error: true }); } finally { setBusy(false); }
  }
  return <>
    <Link className="breadcrumb" to="/module-02/samples">← All samples</Link>
    <DataState />
    {!sample && ['demo', 'ready'].includes(status) && <Panel title="Sample not found">
      <p>This sample is not present in the current session. Local registrations reset after a refresh or when leaving Module 02.</p>
      <Link className="inline-link" to="/module-02/samples">Browse available samples →</Link>
    </Panel>}
    {sample && <>
      <Panel title={sample.id} eyebrow="SAMPLE DETAIL" badge={demoEnabled ? 'DEMO DATA' : null}>
        <dl className="sample-details-grid">
          {[['Batch ID', sample.batchId], ['Description', sample.grade], ['Storage setting', sample.storage],
            ['Storage start date', sample.storageStartDate], ['Initial weight', `${sample.initialWeight} g`],
            ['Latest measurement', formatTimestamp(sample.records.at(-1)?.timestamp)],
            ['Overall quality', 'Not assessed'], ['Device connection', deviceStatus],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </Panel>
      <MeasurementHistory sample={sample} />
      <Panel title="Sample photos" eyebrow="FIRST VS LATEST" className="hardware-panel">
        <ImageComparison sample={sample} />
        {!demoEnabled && <form className="sample-form" onSubmit={upload}><fieldset disabled={busy}>
          <legend className="visually-hidden">Add a photo</legend>
          <label>{hasBaseline ? 'Add a current photo' : 'Add the first (baseline) photo'}
            <input type="file" accept="image/jpeg,image/png" required onChange={event => setFile(event.target.files?.[0] || null)} /></label>
          <button className="button" type="submit">{busy ? 'Saving photo...' : 'Save photo'}</button>
        </fieldset>
          {message.text && <p role={message.error ? 'alert' : 'status'} className={message.error ? 'form-error' : undefined}>{message.text}</p>}
        </form>}
        {sample.images.length > 2 && <ul className="image-history">{sample.images.map(image => <li key={image.id}>
          <strong>{image.role}</strong><span>{formatTimestamp(image.timestamp)}</span>
        </li>)}</ul>}
      </Panel>
    </>}
  </>;
}

import { Link, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel } from '../components/QualityUI';
import {Module02MeasurementHistory as MeasurementHistory} from '../components/Module02SensorPanel';
import { formatTimestamp } from '../data/demoQuality';

export default function SampleDetails() {
  const { id } = useParams();
  const { samples, demoEnabled, status, setSelectedId, deviceStatus } = useQuality();
  const sample = samples.find(item => item.id === id);
  // Carry the opened sample into image and prediction views for a continuous workflow.
  useEffect(() => { if (sample) setSelectedId(sample.id); }, [sample, setSelectedId]);
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
      <Panel title="Image history" eyebrow="VISUAL REFERENCES" className="hardware-panel">
        <ImageComparison sample={sample} />
        <p>{demoEnabled ? 'Demo references are illustrations, not sample photographs.' : 'Stored image references appear when available; capture requires authenticated device uploads.'}</p>
        {sample.images.length > 0 && <ul className="image-history">{sample.images.map(image => <li key={image.id}>
          <strong>{image.role} reference</strong><span>{image.id}</span><span>{formatTimestamp(image.timestamp)}</span>
        </li>)}</ul>}
      </Panel>
    </>}
  </>;
}

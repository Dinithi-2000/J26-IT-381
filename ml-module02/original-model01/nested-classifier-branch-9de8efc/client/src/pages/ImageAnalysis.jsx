import { useEffect, useRef, useState } from 'react';
import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel, SampleSelector } from '../components/QualityUI';
import { AnalysisHistory, InterpretationPanel, ModelCard, ScreeningPanel } from '../components/ImageScreening';
import { formatTimestamp } from '../data/demoQuality';
import { useQualityModel } from '../services/imageAnalysisService';

export default function ImageAnalysis() {
  const { selected, demoEnabled } = useQuality();
  const model = useQualityModel();
  const [result, setResult] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [historyRevision, setHistoryRevision] = useState(0);
  const objectUrls = useRef([]);
  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), []);

  function handleResult(analysis) {
    objectUrls.current.push(analysis.localImageUrl);
    setResult(analysis);
    setSessionResults(previous => [analysis, ...previous].slice(0, 20));
    setHistoryRevision(value => value + 1);
  }

  // Real photos are never filed under synthetic demo samples.
  const defaultSampleId = !demoEnabled && selected ? selected.id : '';
  return <>
    <DataState /><SampleSelector />
    <div className="quality-grid">
      <ScreeningPanel model={model} defaultSampleId={defaultSampleId} onResult={handleResult} result={result} />
      <div className="screening-side">
        <InterpretationPanel result={result} />
        <ModelCard model={model} />
      </div>
    </div>
    <AnalysisHistory revision={historyRevision} sessionResults={sessionResults} />
    <Panel title="Baseline and current, side by side." eyebrow="ESP32-CAM / IMAGE INTERFACE" badge={demoEnabled ? 'DEMO DATA' : 'STORED IMAGES'} className="hardware-panel">
      <ImageComparison sample={selected} />
      <p>{demoEnabled ? 'Demo references are illustrations and cannot assess sample quality.' : 'Stored photographs are supplied by authenticated device uploads.'}</p>
    </Panel>
    <Panel title="Sample image history" eyebrow="TRACEABLE REFERENCES" className="hardware-panel">
      {selected?.imageTotal > 200 && <p>Showing the latest 200 of {selected.imageTotal} image records. Older records are available through the API.</p>}
      {!selected?.images.length ? <p>No image history available.</p> : <div className="table-wrap"><table>
        <caption>{demoEnabled ? 'DEMO DATA · ' : ''}{selected.id} - {demoEnabled ? 'illustrative metadata' : 'captured image metadata'}</caption>
        <thead><tr><th scope="col">Reference ID</th><th scope="col">Role</th><th scope="col">Recorded timestamp</th><th scope="col">Source</th></tr></thead>
        <tbody>{selected.images.map(image => <tr key={image.id}><td>{image.id}</td><td>{image.role}</td><td>{formatTimestamp(image.timestamp)}</td><td>{demoEnabled ? 'Botanical illustration' : image.deviceId}</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}

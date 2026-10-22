import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel, SampleSelector } from '../components/QualityUI';
import { formatTimestamp } from '../data/demoQuality';
import ConditionClassifier from '../components/ConditionClassifier';

export default function ImageAnalysis() {
  const { selected, demoEnabled } = useQuality();
  return <>
    <DataState /><SampleSelector />
    <Panel title="Baseline and current, side by side." eyebrow="ESP32-CAM / IMAGE INTERFACE" badge={demoEnabled ? 'DEMO DATA' : 'NOT CONNECTED'}>
      <ImageComparison sample={selected} />
      <p>The comparison above uses demo references only; live ESP32-CAM results appear in the classification panels below. Demo references are the same botanical illustration; they cannot be used to assess sample quality or visual change.</p>
    </Panel>
    <ConditionClassifier sampleId={selected?.id} />
    <Panel title="Sample image history" eyebrow="TRACEABLE REFERENCES" className="hardware-panel">
      {!selected?.images.length ? <p>No image history available.</p> : <div className="table-wrap"><table>
        <caption>{demoEnabled ? 'DEMO DATA · ' : ''}{selected.id} · illustrative metadata only</caption>
        <thead><tr><th scope="col">Reference ID</th><th scope="col">Role</th><th scope="col">Fixture timestamp</th><th scope="col">Source</th></tr></thead>
        <tbody>{selected.images.map(image => <tr key={image.id}><td>{image.id}</td><td>{image.role}</td><td>{formatTimestamp(image.timestamp)}</td><td>Botanical illustration</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}

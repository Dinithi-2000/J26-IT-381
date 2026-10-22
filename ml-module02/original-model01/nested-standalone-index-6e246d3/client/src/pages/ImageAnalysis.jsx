import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel, SampleSelector } from '../components/QualityUI';
import { formatTimestamp } from '../data/demoQuality';
import Icon from '../components/Icon';

export default function ImageAnalysis() {
  const { selected, demoEnabled } = useQuality();
  return <>
    <DataState /><SampleSelector />
    <Panel title="Baseline and current, side by side." eyebrow="ESP32-CAM / IMAGE INTERFACE" badge={demoEnabled ? 'DEMO DATA' : 'NOT CONNECTED'}>
      <ImageComparison sample={selected} />
      <p>ESP32-CAM capture is not integrated. Demo references are the same botanical illustration; they cannot be used to assess sample quality or visual change.</p>
    </Panel>
    <div className="quality-grid hardware-panel">
      <Panel title="Visible defect screening" eyebrow="COMPUTER VISION">
        <div className="defect-empty"><span><Icon name="camera" size={32} /></span><strong>Image analysis not connected</strong>
          <p>No discoloration, surface defect, or suspected growth result has been generated.</p></div>
        <p>Planned workflow: capture a standardized image, associate it with a sample, run a validated model, and review suspected visual defects.</p>
      </Panel>
      <Panel title="A suspicion is not a confirmation." eyebrow="INTERPRETING FUTURE RESULTS" className="risk-panel">
        <p>Future visual screening may flag suspected fungal growth. An image-based suspicion must remain distinct from confirmed fungal contamination.</p>
        <dl className="detail-list"><div><dt>Visual defect result</dt><dd>Unavailable</dd></div>
          <div><dt>Suspected fungal growth</dt><dd>Not assessed</dd></div>
          <div><dt>Confirmed fungal contamination</dt><dd>No confirmation data</dd></div></dl>
      </Panel>
    </div>
    <Panel title="Sample image history" eyebrow="TRACEABLE REFERENCES" className="hardware-panel">
      {!selected?.images.length ? <p>No image history available.</p> : <div className="table-wrap"><table>
        <caption>{demoEnabled ? 'DEMO DATA · ' : ''}{selected.id} · illustrative metadata only</caption>
        <thead><tr><th scope="col">Reference ID</th><th scope="col">Role</th><th scope="col">Fixture timestamp</th><th scope="col">Source</th></tr></thead>
        <tbody>{selected.images.map(image => <tr key={image.id}><td>{image.id}</td><td>{image.role}</td><td>{formatTimestamp(image.timestamp)}</td><td>Botanical illustration</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}

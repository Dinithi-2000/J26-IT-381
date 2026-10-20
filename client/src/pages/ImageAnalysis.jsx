import ImageClassifierPanel from '../components/ImageClassifierPanel';
import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Panel, SampleSelector } from '../components/QualityUI';
import { formatTimestamp } from '../data/demoQuality';
import Icon from '../components/Icon';

export default function ImageAnalysis() {
  const { selected, demoEnabled } = useQuality();
  return <>
    <DataState /><SampleSelector />
    <ImageClassifierPanel />
    <Panel title="Baseline and current, side by side." eyebrow="ESP32-CAM / IMAGE INTERFACE" badge={demoEnabled ? 'DEMO DATA' : 'STORED IMAGES'}>
      <ImageComparison sample={selected} />
      <p>{demoEnabled ? 'Demo references are illustrations and cannot assess sample quality.' : 'Stored photographs are supplied by authenticated uploads. Use the separate Model 01 panel above for image-condition classification.'}</p>
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
      {selected?.imageTotal > 200 && <p>Showing the latest 200 of {selected.imageTotal} image records. Older records are available through the API.</p>}
      {!selected?.images.length ? <p>No image history available.</p> : <div className="table-wrap"><table>
        <caption>{demoEnabled ? 'DEMO DATA · ' : ''}{selected.id} - {demoEnabled ? 'illustrative metadata' : 'captured image metadata'}</caption>
        <thead><tr><th scope="col">Reference ID</th><th scope="col">Role</th><th scope="col">Recorded timestamp</th><th scope="col">Source</th></tr></thead>
        <tbody>{selected.images.map(image => <tr key={image.id}><td>{image.id}</td><td>{image.role}</td><td>{formatTimestamp(image.timestamp)}</td><td>{demoEnabled ? 'Botanical illustration' : image.deviceId}</td></tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}

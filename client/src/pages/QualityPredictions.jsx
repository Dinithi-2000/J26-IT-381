import { useState } from 'react';
import { useQuality } from '../components/QualityProvider';
import { Panel, SampleSelector } from '../components/QualityUI';
import Icon from '../components/Icon';

export default function QualityPredictions() {
  const [horizon, setHorizon] = useState('7');
  const { selected } = useQuality();
  return <>
    <SampleSelector />
    <div className="quality-grid">
      <Panel title="Future degradation risk" eyebrow="AI PREDICTION WORKSPACE" className="risk-panel" badge="MODEL UNAVAILABLE">
        <span className="risk-symbol"><Icon name="shield" size={46} /></span><h3>No prediction generated</h3>
        <p>There is no trained, validated degradation model connected. Demo sensor data does not produce a risk result.</p>
        <label className="horizon-label" htmlFor="prediction-horizon">Planning horizon
          <select id="prediction-horizon" value={horizon} onChange={event => setHorizon(event.target.value)}>
            <option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
        </label>
        <p>This selector records a proposed {horizon}-day horizon for this view only. It does not request or generate a forecast.</p>
        <dl className="detail-list"><div><dt>Sample</dt><dd>{selected?.id || 'No sample selected'}</dd></div>
          <div><dt>Predicted risk</dt><dd>Unavailable</dd></div><div><dt>Model confidence</dt><dd>Unavailable</dd></div>
          <div><dt>Model version / accuracy</dt><dd>No validated model</dd></div></dl>
      </Panel>
      <Panel title="How future outputs will be read" eyebrow="RISK CATEGORIES / LEGEND ONLY">
        <div className="risk-legend">{['Low', 'Moderate', 'High'].map((label, index) => <div key={label}>
          <span className={`legend-dot risk-${index}`} /><strong>{label}</strong><span>Not assigned</span>
        </div>)}</div>
        <p>Categories are interface labels only. Their definitions and thresholds must come from validation, not arbitrary rules on demo measurements.</p>
        <div className="research-note"><strong>Confidence requires validation</strong><p>Confidence and accuracy will appear only when supplied by an appropriately validated model. No percentages are fabricated here.</p></div>
      </Panel>
      <Panel title="Inputs to investigate" eyebrow="RISK-FACTOR EXPLANATIONS / NOT YET AVAILABLE">
        <p>No sample-specific risk explanation exists yet. Candidate research inputs include:</p>
        <ul className="feature-list"><li>Weight change relative to baseline</li><li>Calibrated color change over storage time</li><li>Temperature and humidity histories</li><li>Gas resistance under a validated interpretation protocol</li><li>Standardized images and visible defect observations</li></ul>
      </Panel>
      <Panel title="Prepare for reliable interpretation" eyebrow="RESEARCH WORKFLOW RECOMMENDATIONS">
        <p>These are general preparation steps, not AI-generated advice about the selected sample.</p>
        <ol className="feature-list"><li>Register a baseline and maintain sample and batch IDs.</li><li>Calibrate sensors and use consistent image capture conditions.</li><li>Collect reference quality labels alongside measurements.</li><li>Validate the model and its horizon before displaying risk or confidence.</li></ol>
      </Panel>
    </div>
  </>;
}

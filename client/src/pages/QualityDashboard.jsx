import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuality } from '../components/QualityProvider';
import { DataState, ImageComparison, Metric, Panel, SampleSelector } from '../components/QualityUI';
import TrendChart from '../components/TrendChart';
import Icon from '../components/Icon';
import ImageClassifierPanel from '../components/ImageClassifierPanel';
import RiskPredictionPanel from '../components/RiskPredictionPanel';
import Module02SensorPanel, {Module02MeasurementHistory as MeasurementHistory} from '../components/Module02SensorPanel';
import { formatTimestamp, weightChange } from '../data/demoQuality';

const measurements = {
  weight: { label: 'Weight (g)', series: [{ name: 'Weight (g)', read: record => record.weight }] },
  temperature: { label: 'Temperature (°C)', series: [{ name: 'Temperature (°C)', color: '#A85A2A', read: record => record.temperature }] },
  humidity: { label: 'Humidity (% RH)', series: [{ name: 'Relative humidity (% RH)', color: '#527F9A', read: record => record.humidity }] },
  gas: { label: 'Gas resistance (Ω)', series: [{ name: 'Gas resistance (Ω)', read: record => record.gasResistanceOhms }] },
  color: { label: 'RGB color', series: ['Red', 'Green', 'Blue'].map((name, index) => ({ name, color: ['#AD6652', '#426B53', '#527F9A'][index], read: record => record.rgb[index] })) },
};
export default function QualityDashboard() {
  const { selected: sample, samples, demoEnabled, deviceStatus, status, refresh } = useQuality();
  const [metric, setMetric] = useState('weight');
  const current = sample?.records.at(-1), baseline = sample?.baselineRecord || sample?.records[0];
  const change = sample && Number.isFinite(current?.weight) ? weightChange(sample) : null;
  const measurement = measurements[metric];
  const historyLabel = demoEnabled ? 'HISTORICAL · DEMO DATA' : 'HISTORICAL RECORDS';
  return <>
    <DataState />
    <section className="module02-workspace-intro" aria-label="Module 02 model workspace">
      <div><p className="eyebrow">MODULE 02 / STORED CINNAMON QUALITY</p><h2>Quality monitoring</h2>
        <p>Review image condition alongside stored sensor measurements and synthetic deterioration risk. Each result keeps its own timestamp and provenance.</p></div>
      <button className="button secondary" type="button" disabled={status === 'loading'} onClick={refresh}>Refresh stored records</button>
      <p>{samples.length} registered records{sample ? ` · Selected: ${sample.id}` : ''}</p>
      {!sample && status !== 'loading' && <p>No cinnamon record is selected. <Link className="inline-link" to="/module-02/samples">Register cinnamon for monitoring</Link>. Measurements appear after sensor readings are received.</p>}
    </section>
    <SampleSelector />
    <Module02SensorPanel />
    <section className="module02-model-workspace" aria-label="Unified Model 01 and Model 02 outputs">
      <ImageClassifierPanel />
      <RiskPredictionPanel />
    </section>
    {sample && <>
      <div className="quality-summary" aria-label="Quality overview">
        <div><span>Quality interpretation</span><strong><span className="connection-dot neutral" />Research outputs below</strong></div>
        <div><span>Sensor connection</span><strong><span className="connection-dot neutral" />{deviceStatus}</strong></div>
        <div><span>Latest {demoEnabled ? 'demo ' : ''}measurement</span><strong>{formatTimestamp(current?.timestamp)}</strong></div>
        <div><span>Storage started</span><strong>{sample.storageStartDate}</strong></div>
      </div>
      <div className="dashboard-section-heading"><div><p className="eyebrow">STORAGE AT A GLANCE</p><h2>Storage Quality Trends</h2></div><span className={`data-badge ${demoEnabled ? 'demo' : 'neutral'}`}>{historyLabel}</span></div>
      <section className="metrics-grid" aria-label={`${demoEnabled ? 'DEMO DATA: ' : ''}sample measurements`}>
        <Metric label="Storage duration" value={current?.day} unit="days" note="At the latest measurement" symbol="clock" />
        <Metric label="Current weight" value={current?.weight?.toFixed(1)} unit="g" note={Number.isFinite(sample.initialWeight) ? `Initial weight: ${sample.initialWeight} g` : 'Initial weight not recorded'} symbol="scale" />
        <Metric label="Weight change" value={change?.toFixed(2)} unit="%" note="Relative to initial weight" symbol="trend" />
        <Metric label="Temperature" value={current?.temperature?.toFixed(1)} unit="°C" note="Ambient storage temperature" symbol="thermometer" />
        <Metric label="Relative humidity" value={current?.humidity} unit="% RH" note="Storage environment" symbol="droplet" />
        <Metric label="Gas resistance" value={current?.gasResistanceOhms?.toLocaleString()} unit="Ω" note="BME688 · not aroma concentration" symbol="wind" />
      </section>
      <div className="quality-grid">
        <Panel title="Quality changes over time" eyebrow="MEASUREMENT HISTORY" badge={demoEnabled ? 'DEMO DATA' : 'HISTORICAL'} className="primary-trend-panel">
          <div className="chart-tabs" role="group" aria-label="Trend measurement">{Object.entries(measurements).map(([key, value]) => <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{value.label}</button>)}</div>
          <TrendChart records={sample.records} series={measurement.series} label={`${demoEnabled ? 'DEMO DATA: ' : ''}${measurement.label} history for ${sample.id}`} />
          <div className="chart-footnote"><span><span className="connection-dot neutral" />{sample.records.length} historical observations</span><a href="#measurement-history">View records ↓</a></div>
        </Panel>
        <Panel title="Temperature" eyebrow="STORAGE ENVIRONMENT" badge={demoEnabled ? 'DEMO DATA' : 'HISTORICAL'} className="environment-chart">
          <div className="chart-reading"><span>{current?.temperature?.toFixed(1) ?? '—'}<small>°C</small></span><Icon name="thermometer" size={22} /></div>
          <TrendChart records={sample.records} series={measurements.temperature.series} label={`${historyLabel}: storage temperature`} />
        </Panel>
        <Panel title="Relative humidity" eyebrow="STORAGE ENVIRONMENT" badge={demoEnabled ? 'DEMO DATA' : 'HISTORICAL'} className="environment-chart">
          <div className="chart-reading"><span>{current?.humidity ?? '—'}<small>% RH</small></span><Icon name="droplet" size={22} /></div>
          <TrendChart records={sample.records} series={measurements.humidity.series} label={`${historyLabel}: storage humidity`} />
        </Panel>
        <Panel title="A closer look at color" eyebrow="RGB / BASELINE VS CURRENT" badge={demoEnabled ? 'DEMO DATA' : 'HISTORICAL'}>
          <div className="rgb-comparison">{[['Baseline', baseline], ['Current', current]].map(([label, record]) => <div key={label}>
            <div className="rgb-reference-label"><strong>{label}</strong><span>{record ? formatTimestamp(record.timestamp) : 'No measurement'}</span></div>
            <div className="color-reference"><span className="rgb-swatch" style={record?.rgb?.every(Number.isFinite) ? { background: `rgb(${record.rgb.join(',')})` } : undefined} aria-label={record?.rgb?.every(Number.isFinite) ? `${label} display RGB swatch` : `${label}: no color measurement`} />
              <div className="rgb-readings">{['R', 'G', 'B'].map((channel, index) => <div key={channel}><span className={`color-dot color-${index}`} /><span>{channel}</span><strong>{record?.rgb?.[index] ?? '—'}</strong></div>)}</div>
            </div>
          </div>)}</div>
          <p className="panel-caption">Display RGB (0–255), uncalibrated. Raw sensor counts are preserved separately in Weight and color evidence. Swatches are not a validated color assessment.</p>
          <div className="research-note"><Icon name="info" size={17} /><div><strong>CIELAB & ΔE awaiting calibrated data</strong><p>No color-difference result is inferred without calibration.</p></div></div>
        </Panel>
        <Panel title="Gas resistance" eyebrow="BME688 / ENVIRONMENTAL RESPONSE" badge={demoEnabled ? 'DEMO DATA' : 'HISTORICAL'}>
          <div className="chart-reading"><span>{current?.gasResistanceOhms?.toLocaleString() ?? '—'}<small>Ω</small></span><Icon name="wind" size={22} /></div>
          <TrendChart records={sample.records} series={measurements.gas.series} label={`${historyLabel}: gas resistance in ohms`} />
          <p className="panel-caption">Gas resistance is not direct VOC or aroma concentration. Relative VOC response interpretation is not calibrated; no essential-oil percentage is inferred.</p>
        </Panel>
        <Panel title="Cinnamon, side by side" eyebrow="BASELINE & CURRENT IMAGE REFERENCES" className="wide-panel" badge={demoEnabled ? 'DEMO REFERENCES' : 'IMAGE HISTORY'}>
          <ImageComparison sample={sample} />
          <div className="image-panel-footer"><p>{demoEnabled ? 'Both references are botanical illustrations, not captured sample photographs.' : 'Sample image references are shown when available.'}</p><Link className="inline-link" to="/module-02/images">Image analysis <Icon name="external" size={15} /></Link></div>
        </Panel>
        <Panel title="Build a reliable research record" eyebrow="RECOMMENDATIONS / WORKFLOW ONLY">
          <p className="panel-caption">General preparation steps, not model-generated recommendations.</p>
          <ol className="recommendation-list"><li><span>01</span><div><strong>Start with a baseline</strong><p>Keep sample IDs, initial weights, and capture conditions consistent.</p></div></li><li><span>02</span><div><strong>Keep the history connected</strong><p>Associate observations and images with the same sample.</p></div></li><li><span>03</span><div><strong>Validate before interpreting</strong><p>Calibrate signals and validate the model before assigning risk.</p></div></li></ol>
        </Panel>
      </div>
      <div id="measurement-history"><MeasurementHistory sample={sample} /></div>
    </>}
    <Panel title="A connected sensing foundation" eyebrow="DEVICE INGESTION API" className="hardware-panel">
      <div className="hardware-chips">{['ESP32 board - awaiting identification', 'HX711 + load cell', 'TCS34725 RGBC', 'Temperature / humidity - not available'].map(item => <span key={item}><span className="connection-dot offline" />{item}</span>)}</div>
      <p>Authenticated HTTP telemetry and image ingestion are available. Firmware and hardware controls are not implemented here. The dashboard reads stored records; recent telemetry does not prove a continuous live connection.</p>
    </Panel>
  </>;
}

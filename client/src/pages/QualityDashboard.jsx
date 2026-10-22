import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuality } from '../components/QualityProvider';
import { DataState, Metric, Panel, SampleSelector } from '../components/QualityUI';
import TrendChart from '../components/TrendChart';
import Icon from '../components/Icon';
import { Module02MeasurementHistory as MeasurementHistory } from '../components/Module02SensorPanel';
import { formatTimestamp, weightChange } from '../data/demoQuality';

const measurements = {
  weight: { label: 'Weight', series: [{ name: 'Weight (g)', read: record => record.weight }] },
  temperature: { label: 'Temperature', series: [{ name: 'Temperature (°C)', color: '#A85A2A', read: record => record.temperature }] },
  humidity: { label: 'Humidity', series: [{ name: 'Relative humidity (% RH)', color: '#527F9A', read: record => record.humidity }] },
  color: { label: 'Color', series: ['Red', 'Green', 'Blue'].map((name, index) => ({ name, color: ['#AD6652', '#426B53', '#527F9A'][index], read: record => record.rgb?.[index] })) },
  gas: { label: 'Gas resistance', series: [{ name: 'Gas resistance (Ω)', read: record => record.gasResistanceOhms }] },
};
const hasValue = (records, series) => records.some(record => series.some(line => Number.isFinite(line.read(record))));
const hasColor = record => record?.rgb?.length === 3 && record.rgb.every(Number.isFinite);

export default function QualityDashboard() {
  const { selected: sample, samples, status, refresh } = useQuality();
  const [metric, setMetric] = useState('weight');
  const records = sample?.records || [];
  const current = records.at(-1), baseline = sample?.baselineRecord || records[0];
  const change = sample && Number.isFinite(current?.weight) ? weightChange(sample) : null;
  // Only offer charts that have data for this sample.
  const available = Object.entries(measurements).filter(([, value]) => hasValue(records, value.series));
  const active = available.some(([key]) => key === metric) ? metric : available[0]?.[0];
  return <>
    <DataState />
    <section className="module02-workspace-intro" aria-label="Module 02 quality monitoring">
      <div><p className="eyebrow">MODULE 02 / STORED CINNAMON QUALITY</p><h2>Quality monitoring</h2>
        <p>Track how a stored cinnamon sample changes over time.</p></div>
      <button className="button secondary" type="button" disabled={status === 'loading'} onClick={refresh}>Refresh</button>
      <p>{samples.length} cinnamon records{sample?.dataOrigin === 'DEMO_DATA' ? ' · illustrative readings, not physical measurements' : ''}</p>
      {!sample && status !== 'loading' && <p>No registered sample selected. <Link className="inline-link" to="/module-02/samples">Register a cinnamon sample</Link> to start monitoring.</p>}
    </section>
    <SampleSelector />
    {sample && <>
      <section className="metrics-grid" aria-label={`Latest values for ${sample.id}`}>
        <Metric label="Storage time" value={current?.day} unit="days" note={`Since ${sample.storageStartDate}`} symbol="clock" />
        <Metric label="Weight (4 quills)" value={current?.weight?.toFixed(1)} unit="g" note={Number.isFinite(sample.initialWeight) ? `Started at ${sample.initialWeight} g` : 'Initial weight not recorded'} symbol="scale" />
        <Metric label="Weight change" value={change?.toFixed(2)} unit="%" note="Since storage started" symbol="trend" />
        {Number.isFinite(current?.temperature) && <Metric label="Temperature" value={current.temperature.toFixed(1)} unit="°C" note="Storage environment" symbol="thermometer" />}
        {Number.isFinite(current?.humidity) && <Metric label="Humidity" value={current.humidity} unit="% RH" note="Storage environment" symbol="droplet" />}
      </section>
      <p className="panel-caption">Latest reading: {formatTimestamp(current?.timestamp)}</p>
      <div className="quality-grid">
        <Panel title="Changes over time" eyebrow="MEASUREMENT HISTORY" className="primary-trend-panel">
          {!active ? <p>No measurements recorded for this sample yet.</p> : <>
            <div className="chart-tabs" role="group" aria-label="Choose a measurement">{available.map(([key, value]) => <button key={key} type="button" aria-pressed={active === key} onClick={() => setMetric(key)}>{value.label}</button>)}</div>
            <TrendChart records={records} series={measurements[active].series} label={`${measurements[active].label} history for ${sample.id}`} />
            <div className="chart-footnote"><span>{records.length} readings</span><a href="#measurement-history">View all readings ↓</a></div>
          </>}
        </Panel>
        <Panel title="Color: start vs now" eyebrow="RGB SENSOR">
          <div className="rgb-comparison">{[['Start', baseline], ['Now', current]].map(([label, record]) => <div key={label}>
            <div className="rgb-reference-label"><strong>{label}</strong><span>{record ? formatTimestamp(record.timestamp) : 'No reading'}</span></div>
            <div className="color-reference"><span className="rgb-swatch" style={hasColor(record) ? { background: `rgb(${record.rgb.join(',')})` } : undefined} aria-label={hasColor(record) ? `${label} color swatch` : `${label}: no color reading`} />
              <div className="rgb-readings">{['R', 'G', 'B'].map((channel, index) => <div key={channel}><span className={`color-dot color-${index}`} /><span>{channel}</span><strong>{record?.rgb?.[index] ?? '—'}</strong></div>)}</div>
            </div>
          </div>)}</div>
          <p className="panel-caption">Lower values mean the cinnamon is getting darker. Uncalibrated sensor color.</p>
        </Panel>
        <Panel title="Model tools" eyebrow="MODEL 01 & MODEL 02">
          <ul className="model-links">
            <li><Link className="inline-link" to="/module-02/images"><Icon name="image" size={17} /> Check a cinnamon photo</Link><p className="panel-caption">Good quality vs suspected mold (Model 01)</p></li>
            <li><Link className="inline-link" to="/module-02/predictions"><Icon name="sparkles" size={17} /> Predict storage risk</Link><p className="panel-caption">Low / Medium / High risk for this sample (Model 02)</p></li>
          </ul>
        </Panel>
      </div>
      <div id="measurement-history"><MeasurementHistory sample={sample} /></div>
    </>}
  </>;
}

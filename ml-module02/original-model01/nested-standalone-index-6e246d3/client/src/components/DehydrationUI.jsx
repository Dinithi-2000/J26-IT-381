import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Metric, Panel } from './QualityUI';
import { useDehydration } from './DehydrationProvider';
import { formatDuration, formatDryingTime } from '../data/demoDehydration';

export { Panel };
export const reading = (value, unit = '', digits = 1) => Number.isFinite(value) ? `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}` : '--';

export function StatusBadge({ children, tone = 'offline' }) {
  return <span className={`drying-status ${tone}`}><span className="connection-dot" />{children}</span>;
}

export function EmptyState({ title, description, icon = 'trend' }) {
  return <div className="drying-empty"><span className="empty-state-icon"><Icon name={icon} size={27} /></span><strong>{title}</strong><p>{description}</p></div>;
}

export function TelemetryCard({ label, value, unit, symbol, demoEnabled }) {
  return <Metric label={label} value={value ?? '--'} unit={unit} symbol={symbol} note={value == null ? 'No live reading' : demoEnabled ? 'DEMO DATA · snapshot' : 'Recorded measurement'} />;
}

export function DetailList({ items }) {
  return <dl className="detail-list drying-detail-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '--'}</dd></div>)}</dl>;
}

export function RDTCard() {
  const { telemetry: data, demoEnabled, predictionConnected } = useDehydration();
  // A simulated time stays illustrative even when demo target settings change.
  const hasPrediction = demoEnabled || predictionConnected;
  const progress = data && Number.isFinite(data.initialMoisture) && Number.isFinite(data.targetMoisture) && Number.isFinite(data.estimatedMoisture) && data.initialMoisture > data.targetMoisture
    ? Math.max(0, Math.min(100, (data.initialMoisture - data.estimatedMoisture) / (data.initialMoisture - data.targetMoisture) * 100)) : null;
  return <Panel title="Remaining drying time" eyebrow="RDT / EXPERIMENTAL PREDICTION" badge={demoEnabled ? 'SIMULATED · DEMO' : 'MODEL NOT CONNECTED'} className="drying-rdt-card">
    <p className="drying-value-label">Predicted RDT</p><div className="drying-rdt-value">{hasPrediction ? formatDuration(data?.remainingDryingTime) : '--'}</div>
    <p className="drying-completion">Estimated completion: <strong>{hasPrediction ? formatDryingTime(data?.estimatedCompletion) : '--'}</strong></p>
    <div className="drying-progress-summary"><span>Drying progress</span><strong>{reading(progress, '%', 0)}</strong></div>
    <div className="drying-progress" role="progressbar" aria-label="Drying progress based on estimated moisture" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} aria-valuetext={progress == null ? 'Unavailable' : `${progress.toFixed(1)} percent`}><span style={{ width: `${progress ?? 0}%` }} /></div>
    <div className="drying-rdt-baseline"><span>Initial MC <strong>{reading(data?.initialMoisture, '%', 0)}</strong></span><span>Target MC <strong>{reading(data?.targetMoisture, '%', 0)}</strong></span></div>
    <div className="drying-prediction-note"><Icon name="info" size={17} /><span>{demoEnabled ? 'Simulated prediction · fixed example, not recalculated by a model.' : predictionConnected ? 'Experimental prediction service' : 'RDT model not connected'}</span></div>
    <Link className="inline-link" to="/module-01/rdt">Explore prediction research <Icon name="external" size={15} /></Link>
  </Panel>;
}

export function ControlStatusCard() {
  const { telemetry: data, demoEnabled } = useDehydration();
  return <Panel title="Chamber control" eyebrow="ON/OFF RELAY CONTROL" badge={demoEnabled ? 'DEMO DATA' : 'OFFLINE'}>
    <DetailList items={[
      ['Heater', <StatusBadge key="heater" tone={demoEnabled && data?.heaterState === 'ON' ? 'on' : 'offline'}>{data?.heaterState ?? 'Unavailable'}</StatusBadge>],
      ['Fan', <StatusBadge key="fan" tone={demoEnabled && data?.fanState === 'ON' ? 'on' : 'offline'}>{data?.fanState ?? 'Unavailable'}</StatusBadge>],
      ['Control mode', data?.controlMode ?? 'Offline'],
      ['Temperature protection', data?.temperatureProtection ?? 'Unavailable'],
      ['Target moisture', reading(data?.targetMoisture, '%', 0)],
    ]} />
    <Link className="inline-link" to="/module-01/controls">Chamber controls <Icon name="external" size={15} /></Link>
  </Panel>;
}

export const dryingSeries = {
  moisture: { key: 'estimatedMoisture', name: 'Estimated moisture', unit: '%', color: '#426B53' },
  temperature: { key: 'temperature', name: 'Chamber temperature', unit: '°C', color: '#A85A2A' },
  humidity: { key: 'humidity', name: 'Chamber humidity', unit: '% RH', color: '#65765C' },
  weight: { key: 'currentWeight', name: 'Weight', unit: 'g', color: '#A85A2A' },
  rdt: { key: 'remainingDryingTime', name: 'Simulated RDT', unit: 'min', color: '#426B53', divisor: 60 },
};

export function DryingTrendChart({ records = [], series = Object.values(dryingSeries).slice(0, 3), label = 'Drying process trend' }) {
  const gradientId = useId().replace(/:/g, '');
  if (!records.length) return <EmptyState title="No drying data recorded yet." description="Chamber observations will appear here. Enable demo data to explore an illustrative drying curve." />;
  const values = records.flatMap(record => series.map(item => record[item.key] == null ? NaN : record[item.key] / (item.divisor ?? 1))).filter(Number.isFinite);
  if (!values.length) return <EmptyState title="No measurements available." description="This series has no recorded observations." />;
  const min = Math.min(...values), max = Math.max(...values), padding = Math.max((max - min) * .15, 1);
  const low = Math.max(0, min - padding), high = max + padding;
  const first = records[0].elapsedTime, last = records.at(-1).elapsedTime;
  const x = time => last === first ? 300 : (time - first) / (last - first) * 600;
  const y = value => 180 - (value - low) / (high - low) * 172;
  const ticks = [3, 2, 1, 0].map(index => low + (high - low) * index / 3);
  return <div className="drying-chart">
    <p className="drying-axis-label">{series.length === 1 ? `${series[0].name} (${series[0].unit})` : 'Measurement values · units in legend'}</p>
    <div className="chart-body"><div className="chart-y-axis">{ticks.map((value, i) => <span key={i}>{value.toFixed(0)}</span>)}</div>
      <div className="chart-plot"><svg viewBox="0 0 600 190" preserveAspectRatio="none" role="img" aria-label={`${label}. Values available in the observations table.`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series[0].color} stopOpacity=".16" /><stop offset="100%" stopColor={series[0].color} stopOpacity="0" /></linearGradient></defs>
        {ticks.map((value, index) => <line key={index} x1="0" x2="600" y1={y(value)} y2={y(value)} stroke="#DFE7D7" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />)}
        {series.map((item, index) => {
          const valid = records.filter(record => Number.isFinite(record[item.key]));
          const points = valid.map(record => `${x(record.elapsedTime)},${y(record[item.key] / (item.divisor ?? 1))}`).join(' ');
          return <g key={item.key}>
            {index === 0 && valid.length > 1 && <polygon points={`${x(valid[0].elapsedTime)},190 ${points} ${x(valid.at(-1).elapsedTime)},190`} fill={`url(#${gradientId})`} />}
            <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.key === 'humidity' ? '6 5' : undefined} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {valid.map(record => <circle key={record.elapsedTime} cx={x(record.elapsedTime)} cy={y(record[item.key] / (item.divisor ?? 1))} r="3" fill="white" stroke={item.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"><title>{formatDuration(record.elapsedTime)} · {item.name}: {reading(record[item.key] / (item.divisor ?? 1), item.unit)}</title></circle>)}
          </g>;
        })}
      </svg><div className="chart-x-axis">{[0, .5, 1].map(fraction => <span key={fraction}>{Math.round((first + (last - first) * fraction) / 60)} min</span>)}</div></div>
    </div>
    <p className="drying-axis-label drying-x-label">Elapsed drying time</p>
    <div className="chart-legend">{series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.name} ({item.unit})</span>)}</div>
    <details className="drying-observations"><summary>View recorded values</summary><div className="table-wrap" tabIndex={0} role="region" aria-label={`${label} observations`}><table><caption>{label} · elapsed time and measurement values</caption><thead><tr><th scope="col">Elapsed time</th>{series.map(item => <th key={item.key} scope="col">{item.name} ({item.unit})</th>)}</tr></thead><tbody>{records.map(record => <tr key={record.elapsedTime}><td>{formatDuration(record.elapsedTime)}</td>{series.map(item => <td key={item.key}>{reading(record[item.key] == null ? null : record[item.key] / (item.divisor ?? 1))}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}

export function ProcessTrendPanel({ records, demoEnabled }) {
  const [selected, setSelected] = useState('all');
  const choices = { all: 'All signals', moisture: 'Moisture', temperature: 'Temperature', humidity: 'Humidity' };
  return <Panel title="Drying process trend" eyebrow="CHAMBER / PROCESS HISTORY" badge={demoEnabled ? 'DEMO DATA' : 'NO LIVE DATA'}>
    <div className="chart-tabs" role="group" aria-label="Drying trend measurement">{Object.entries(choices).map(([key, label]) => <button key={key} aria-pressed={selected === key} onClick={() => setSelected(key)}>{label}</button>)}</div>
    <DryingTrendChart records={records} series={selected === 'all' ? Object.values(dryingSeries).slice(0, 3) : [dryingSeries[selected]]} label={`${demoEnabled ? 'DEMO DATA: ' : ''}${choices[selected]}`} />
  </Panel>;
}

export function SystemLog({ events = [], demoEnabled = false }) {
  return <Panel title="System log" eyebrow="SESSION / EVENT HISTORY" badge={demoEnabled ? 'DEMO DATA' : 'NO EVENTS'}>
    {!events.length ? <EmptyState title="No session events yet." description="Relay changes and process events will appear when recorded." icon="clock" /> : <ol className="drying-event-list">{events.map(event => <li key={event.id}>
      <span className="drying-event-icon"><Icon name={event.icon || 'info'} size={17} /></span><div><strong>{event.name}</strong><p>{event.description}</p><time dateTime={event.timestamp}>{formatDryingTime(event.timestamp, true)}</time></div>
    </li>)}</ol>}
  </Panel>;
}

export function ProcessInformation({ data, demoEnabled }) {
  return <Panel title="Sensor & process information" eyebrow="MEASUREMENTS / SESSION BASELINE" badge={demoEnabled ? 'DEMO DATA' : 'UNAVAILABLE'}>
    <DetailList items={[
      ['Current estimated moisture', reading(data?.estimatedMoisture, '%')], ['Current weight', reading(data?.currentWeight, 'g')],
      ['Chamber temperature', reading(data?.temperature, '°C')], ['Chamber humidity', reading(data?.humidity, '% RH')],
      ['Initial moisture', reading(data?.initialMoisture, '%')], ['Target moisture', reading(data?.targetMoisture, '%')],
      ['Target weight', reading(data?.targetWeight, 'g')], ['Elapsed time', formatDuration(data?.elapsedTime)],
    ]} /><p className="panel-caption">Load-cell weight is a sensor observation. Estimated moisture is a research estimate, not a certified moisture measurement.</p>
  </Panel>;
}

import { Link } from 'react-router-dom';
import { formatTimestamp, weightChange } from '../data/demoQuality';
import { useQuality } from './QualityProvider';
import Icon from './Icon';
import AssetImage from './AssetImage';

export function Panel({ title, eyebrow, children, className = '', badge }) {
  return <section className={`panel ${className}`}>
    <div className="panel-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
      {badge && <span className={`small-badge${badge.includes('DEMO') ? ' badge-demo' : ''}`}>{badge}</span>}</div>{children}
  </section>;
}

export function Metric({ label, value, unit, note, symbol = 'sample' }) {
  return <article className="metric-card"><div><span>{label}</span>
    <span className="metric-symbol"><Icon name={symbol} size={19} /></span></div>
    <p>{value ?? '—'}{value != null && <small>{unit}</small>}</p>
    <span className="metric-note">{note}</span>
  </article>;
}

export function DataState() {
  const { status, error, refresh } = useQuality();
  if (status === 'demo' || status === 'ready') return null;
  const content = {
    loading: ['Checking data availability', 'Please wait while the frontend checks its configured data source.'],
    disconnected: ['Quality service unavailable', 'The quality backend could not be reached. Check the backend and its Atlas connection.'],
    empty: ['No monitoring records yet', 'Register cinnamon to start tracking storage quality. Measurements appear when sensor readings are received.'],
    error: ['Unable to load quality data', error || 'The data source could not be read. Try again.'],
  }[status];
  return <section className={`panel data-state state-${status}`} role="status" aria-live="polite" aria-busy={status === 'loading'}>
    <span className="empty-state-icon"><Icon name={status === 'error' ? 'info' : status === 'empty' ? 'sample' : 'offline'} size={30} /></span><h2>{content[0]}</h2><p>{content[1]}</p>
    {status === 'loading' && <div className="skeleton-grid" aria-hidden="true">{[0, 1, 2].map(item => <div className="skeleton-card" key={item}><span className="skeleton skeleton-label" /><span className="skeleton skeleton-value" /><span className="skeleton skeleton-note" /></div>)}</div>}
    {status !== 'loading' && <button className="button secondary" onClick={refresh}>Check availability again</button>}
  </section>;
}

export function SampleSelector() {
  const { samples, selected, setSelectedId, demoEnabled } = useQuality();
  if (!selected) return null;
  return <section className="sample-toolbar" aria-label="Sample selection">
    <label htmlFor="quality-sample"><span><Icon name="sample" size={15} /> Cinnamon ID</span>
      <select id="quality-sample" value={selected.id} onChange={event => setSelectedId(event.target.value)}>
        {samples.map(sample => <option key={sample.id}>{sample.id}</option>)}
      </select>
    </label>
    <div><span>Batch ID</span><strong>{selected.batchId}</strong></div>
    <div><span>Storage setting{demoEnabled ? ' · demo' : ''}</span><strong>{selected.storage}</strong></div>
    <div><span>Cinnamon record</span><Link className="inline-link" to={`/module-02/samples/${encodeURIComponent(selected.id)}`}>View details <Icon name="external" size={14} /></Link></div>
  </section>;
}

export function MeasurementHistory({ sample }) {
  const { demoEnabled } = useQuality();
  return <Panel title="The details behind the trends." eyebrow="SAMPLE MEASUREMENT HISTORY"
    badge={`${sample.records.length} ${demoEnabled ? 'DEMO ' : ''}RECORDS`} className="measurement-history">
    {sample.historyTotal > 200 && <p>Showing the latest 200 of {sample.historyTotal} readings. Older records are available through the paginated API.</p>}
    {!sample.records.length ? <p>No measurements recorded for this sample. Registration does not create sensor readings.</p> :
      <div className="table-wrap" tabIndex="0" role="region" aria-label={`Measurement history for ${sample.id}`}><table>
        <caption>{demoEnabled ? 'DEMO DATA · ' : ''}{sample.id} · timestamps shown in Sri Lanka time</caption>
        <thead><tr>{['Timestamp', 'Storage day', 'Weight (g)', 'Change (%)', 'Temperature (°C)', 'Humidity (% RH)', 'Gas resistance (Ω)', 'RGB (0–255)'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{sample.records.map(record => <tr key={record.timestamp}>
          <td>{formatTimestamp(record.timestamp)}</td><td>{record.day}</td><td>{record.weight.toFixed(1)}</td>
          <td>{weightChange(sample, record).toFixed(2)}</td><td>{record.temperature.toFixed(1)}</td>
          <td>{record.humidity}</td><td>{record.gasResistanceOhms.toLocaleString()}</td><td>{record.rgb.join(' / ')}</td>
        </tr>)}</tbody>
      </table></div>}
  </Panel>;
}

export function ImageComparison({ sample }) {
  const { demoEnabled } = useQuality();
  const baseline = sample?.images.find(image => image.role === 'Baseline');
  const current = sample?.images.find(image => image.role === 'Current');
  return <div className="image-comparison">{[['Baseline', baseline], ['Current', current]].map(([role, image]) => {
    return <figure key={role}>
      {image ? <AssetImage src={image.src} fallback={null} alt={`${role} cinnamon sample photograph`} /> :
        <div className="image-placeholder"><Icon name="camera" size={30} /><span>No {role === 'Baseline' ? 'first' : 'current'} photo yet</span></div>}
      <figcaption><strong>{role === 'Baseline' ? 'First photo (baseline)' : 'Latest photo (current)'}</strong>
        <span>{image ? formatTimestamp(image.timestamp) : sample?.id || 'No sample selected'}</span>
        {image && demoEnabled && <span className="image-label">DEMO DATA</span>}
      </figcaption>
    </figure>;
  })}</div>;
}

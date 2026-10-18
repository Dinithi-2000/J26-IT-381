import { useDehydration } from '../components/DehydrationProvider';
import { DryingTrendChart, EmptyState, Panel, TelemetryCard, dryingSeries, reading } from '../components/DehydrationUI';
import { formatDuration } from '../data/demoDehydration';

const average = (records, key) => {
  const values = records.map(record => record[key]).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};
export default function DryingAnalytics() {
  const { telemetry: data, records, sessions, demoEnabled } = useDehydration();
  return <>
    <div className="drying-section-heading"><div><p className="eyebrow">RESEARCH / PROCESS INSIGHTS</p><h2>Drying analytics</h2><p>Explore recorded conditions and changes across the drying experiment.</p></div></div>
    <section className="metrics-grid drying-analytics-metrics" aria-label="Drying analytics summary">
      <TelemetryCard label="Average chamber temperature" value={average(records, 'temperature')?.toFixed(1)} unit="°C" symbol="thermometer" demoEnabled={demoEnabled} />
      <TelemetryCard label="Average chamber humidity" value={average(records, 'humidity')?.toFixed(1)} unit="% RH" symbol="wind" demoEnabled={demoEnabled} />
      <TelemetryCard label="Total drying time" value={data ? formatDuration(data.elapsedTime) : null} symbol="clock" demoEnabled={demoEnabled} />
      <TelemetryCard label="Weight change" value={data && Number.isFinite(data.currentWeight) && Number.isFinite(data.initialWeight) ? (data.currentWeight - data.initialWeight).toFixed(1) : null} unit="g" symbol="scale" demoEnabled={demoEnabled} />
      <TelemetryCard label="Estimated moisture change" value={data && Number.isFinite(data.estimatedMoisture) && Number.isFinite(data.initialMoisture) ? (data.estimatedMoisture - data.initialMoisture).toFixed(1) : null} unit="percentage points" symbol="droplet" demoEnabled={demoEnabled} />
    </section>
    <p className="drying-analytics-note">Averages describe the recorded observations. Changes are relative to the session baseline.</p>
    <div className="drying-two-grid">{['temperature', 'humidity', 'moisture', 'weight'].map(key => <Panel key={key} title={`${dryingSeries[key].name} vs time`} badge={demoEnabled ? 'DEMO DATA' : 'NO DATA'}>
      <DryingTrendChart records={records} series={[dryingSeries[key]]} label={`${demoEnabled ? 'DEMO DATA: ' : ''}${dryingSeries[key].name} vs time`} />
    </Panel>)}</div>
    <div className="drying-section-gap"><Panel title="Batch comparison" eyebrow="EXPERIMENTS / SIDE BY SIDE" badge={demoEnabled ? 'DEMO DATA' : 'NO RECORDS'}>
      {!sessions.length ? <EmptyState title="Compare experiments as your research grows." description="Batch durations, weight changes, and estimated moisture changes will appear when session records are available." /> : <div className="table-wrap" tabIndex={0} role="region" aria-label="Batch comparison"><table>
        <caption>DEMO DATA · synthetic sessions with different end states; durations are not a performance ranking</caption>
        <thead><tr>{['Batch', 'Status', 'Duration', 'Weight change', 'Estimated MC change'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{sessions.map(session => <tr key={session.batchId}><td>{session.batchId}</td><td>{session.status}</td><td>{formatDuration(session.elapsedTime)}</td><td>{reading(session.currentWeight - session.initialWeight, 'g')}</td><td>{reading(session.estimatedMoisture - session.initialMoisture, 'pp')}</td></tr>)}</tbody>
      </table></div>}
    </Panel></div>
  </>;
}

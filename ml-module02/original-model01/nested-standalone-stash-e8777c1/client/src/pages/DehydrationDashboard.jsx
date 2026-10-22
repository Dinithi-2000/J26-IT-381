import { useDehydration } from '../components/DehydrationProvider';
import { ControlStatusCard, ProcessInformation, ProcessTrendPanel, RDTCard, StatusBadge, SystemLog, TelemetryCard } from '../components/DehydrationUI';
import { formatDuration, formatDryingTime } from '../data/demoDehydration';

export default function DehydrationDashboard() {
  const { telemetry: data, demoEnabled, records, events } = useDehydration();
  return <>
    <div className="drying-section-heading"><div><p className="eyebrow">OBSERVE / UNDERSTAND / ADAPT</p><h2>Live monitoring</h2><p>{data ? `Batch ${data.batchId} · snapshot ${formatDryingTime(data.updatedAt)}` : 'Waiting for the first chamber observation.'}</p></div>
      <StatusBadge tone={demoEnabled ? 'demo' : 'offline'}>{demoEnabled ? 'Demo session · drying' : 'Chamber offline'}</StatusBadge>
    </div>
    <section className="metrics-grid drying-telemetry" aria-label={demoEnabled ? 'DEMO DATA telemetry' : 'Chamber telemetry'}>
      <TelemetryCard label="Current moisture" value={data?.estimatedMoisture?.toFixed(1)} unit="% estimated" symbol="droplet" demoEnabled={demoEnabled} />
      <TelemetryCard label="Chamber temperature" value={data?.temperature?.toFixed(1)} unit="°C" symbol="thermometer" demoEnabled={demoEnabled} />
      <TelemetryCard label="Chamber humidity" value={data?.humidity?.toFixed(1)} unit="% RH" symbol="wind" demoEnabled={demoEnabled} />
      <TelemetryCard label="Elapsed time" value={data ? formatDuration(data.elapsedTime) : null} symbol="clock" demoEnabled={demoEnabled} />
    </section>
    <div className="drying-main-grid"><RDTCard /><ControlStatusCard /><ProcessTrendPanel records={records} demoEnabled={demoEnabled} /><SystemLog events={events} demoEnabled={demoEnabled} /></div>
    <div className="drying-section-gap"><ProcessInformation data={data} demoEnabled={demoEnabled} /></div>
  </>;
}

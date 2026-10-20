import { Link, useParams } from 'react-router-dom';
import { useDehydration } from '../components/DehydrationProvider';
import { DetailList, DryingTrendChart, EmptyState, Panel, StatusBadge, SystemLog, dryingSeries, reading } from '../components/DehydrationUI';
import { formatDuration } from '../data/demoDehydration';
import Icon from '../components/Icon';

export function DryingSessionTable({ sessions, demoEnabled }) {
  if (!sessions.length) return <EmptyState title="No drying sessions recorded yet." description="Connected session records will appear here. Enable demo data to explore an example history." icon="clock" />;
  return <div className="table-wrap" tabIndex={0} role="region" aria-label="Drying session history"><table className="drying-session-table">
    <caption>{demoEnabled ? 'DEMO DATA · synthetic drying experiments' : 'Recorded drying sessions'} · weights in grams; MC is estimated moisture content</caption>
    <thead><tr>{['Batch ID', 'Date', 'Initial MC', 'Target MC', 'Initial weight', 'Final weight', 'Drying duration', 'Status', 'Details'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{sessions.map(session => <tr key={session.batchId}>
      <td><strong>{session.batchId}</strong></td><td>{session.date}</td><td>{reading(session.initialMoisture, '%', 0)}</td><td>{reading(session.targetMoisture, '%', 0)}</td>
      <td>{reading(session.initialWeight, 'g')}</td><td>{reading(session.finalWeight, 'g')}</td><td>{formatDuration(session.elapsedTime)}</td>
      <td><StatusBadge tone={session.status === 'Completed' ? 'on' : 'demo'}>{session.status}</StatusBadge></td>
      <td><Link className="inline-link" to={`/module-01/sessions/${encodeURIComponent(session.batchId)}`} aria-label={`View details for ${session.batchId}`}>View details <Icon name="external" size={14} /></Link></td>
    </tr>)}</tbody>
  </table></div>;
}

export default function DryingSessions() {
  const { sessions, demoEnabled } = useDehydration();
  return <Panel title="Drying sessions" eyebrow="EXPERIMENTS / SESSION HISTORY" badge={demoEnabled ? 'DEMO DATA' : 'NO RECORDS'}>
    <p className="panel-caption">A record of each drying experiment, from initial conditions to its final observation.</p>
    <DryingSessionTable sessions={sessions} demoEnabled={demoEnabled} />
  </Panel>;
}

export function DryingSessionDetails() {
  const { batchId } = useParams();
  const { sessions, demoEnabled } = useDehydration();
  const session = sessions.find(item => item.batchId === batchId);
  return <>
    <Link className="inline-link drying-back-link" to="/module-01/sessions">← All drying sessions</Link>
    {!session ? <Panel title="Session unavailable"><EmptyState title={demoEnabled ? 'Session not found.' : 'No session data available.'} description="Enable demo data to inspect synthetic sessions, or return to the session history." icon="clock" /></Panel> : <>
      <Panel title={session.batchId} eyebrow="DRYING SESSION / EXPERIMENT RECORD" badge={demoEnabled ? 'DEMO DATA' : 'RECORDED'}>
        <DetailList items={[
          ['Date', session.date], ['Status', session.status], ['Duration', formatDuration(session.elapsedTime)],
          ['Initial → target moisture', `${reading(session.initialMoisture, '%')} → ${reading(session.targetMoisture, '%')}`],
          ['Initial → latest weight', `${reading(session.initialWeight, 'g')} → ${reading(session.currentWeight, 'g')}`],
        ]} />
      </Panel>
      <div className="drying-two-grid drying-section-gap">{[
        ['Environmental history', [dryingSeries.temperature, dryingSeries.humidity]], ['Weight history', [dryingSeries.weight]],
        ['Estimated moisture history', [dryingSeries.moisture]], ['RDT history', [dryingSeries.rdt]],
      ].map(([title, series]) => <Panel key={title} title={title} badge={demoEnabled ? 'DEMO DATA' : 'RECORDED'}><DryingTrendChart records={session.records} series={series} label={`${demoEnabled ? 'DEMO DATA: ' : ''}${title}`} /></Panel>)}</div>
      <div className="drying-section-gap"><SystemLog events={session.events} demoEnabled={demoEnabled} /></div>
    </>}
  </>;
}

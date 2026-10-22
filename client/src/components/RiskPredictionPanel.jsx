import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {useQuality} from './QualityProvider';
import {Panel} from './QualityUI';
import {qualityService} from '../services/qualityService';
import {createRiskWorkspace, readingCondition, RISK_DISCLAIMER, RISK_LABELS} from '../services/riskPredictionState';
import {formatTimestamp} from '../data/demoQuality';
import {TOKEN_OPTIONAL, useOperatorToken} from '../services/operatorToken';

const stamp = value => value && Number.isFinite(Date.parse(value)) ? formatTimestamp(value) : 'Not available';
const value = (number, unit = '') => typeof number === 'number' && Number.isFinite(number) ? `${number}${unit}` : 'Not available';
const noop = () => {};

// One entry per Sri Lanka day (latest prediction of that day), oldest first.
export function dailyRisk(history) {
  const days = new Map();
  for (const row of history) {
    const day = new Date(Date.parse(row.predictedAt) + 5.5 * 3_600_000).toISOString().slice(0, 10);
    if (!days.has(day)) days.set(day, row); // history is newest first
  }
  return [...days].reverse().map(([day, row]) => ({day, row}));
}
const dayLabel = day => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});

const RISK_MEANING = {
  Low: 'Storage conditions look fine. Keep monitoring the sample.',
  Medium: 'Some risk of quality loss. Check the storage temperature and humidity.',
  High: 'High risk of quality loss. Inspect the sample soon.',
};

export function RiskPredictionView({state, sample, token = '', tokenOptional = false, onToken = noop, onPredict = noop,
  onReading = noop, onHistory = noop, now = Date.now()}) {
  const busy = state.predictionStatus === 'loading';
  const reading = state.reading;
  const condition = readingCondition(reading, state.deviceStatus, now);
  const duration = reading && sample?.storageStartTimestamp
    ? Math.floor((Date.parse(reading.recordedAt) - Date.parse(sample.storageStartTimestamp)) / 86400000) : null;
  const result = state.result || state.history[0];
  const enabled = !!sample && !state.demo;
  const rgb = reading ? [reading.red, reading.green, reading.blue] : [];
  const hasColor = rgb.length === 3 && rgb.every(Number.isFinite);
  const cards = [['Storage time', typeof duration === 'number' && duration >= 0 ? `${duration} days` : 'Not available'],
    ['Temperature', value(reading?.temperatureC, ' °C')], ['Humidity', value(reading?.relativeHumidityPercent, ' %')],
    ['Weight', value(reading?.weightGrams, ' g')]];
  const canPredict = enabled && state.hasToken && !!reading && !condition.invalid && state.readingStatus === 'ready' && !busy;
  return <Panel title="Storage risk prediction" eyebrow="MODEL 02 / STORAGE RISK" className="synthetic-risk-panel">
    <p>Check whether the selected cinnamon sample is at <strong>Low</strong>, <strong>Medium</strong> or <strong>High</strong> risk of losing quality, based on its latest sensor reading.</p>
    {state.demo ? <p className="research-note">Demo mode is on. Turn it off to predict risk for a real sample.</p>
      : !sample ? <p role="status">No registered sample selected. Choose a cinnamon sample above.</p> : <>
      <section className="risk-step" aria-label="Latest sensor reading" aria-busy={state.readingStatus === 'loading'}>
        <div className="risk-section-header"><h3>1. Latest reading</h3><button className="button secondary" type="button" disabled={busy || state.readingStatus === 'loading'} onClick={onReading}>Refresh</button></div>
        {state.readingStatus === 'loading' ? <><p role="status">Loading stored sensor reading…</p><div className="risk-input-grid" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <div className="skeleton-card" key={index}><span className="skeleton skeleton-label" /><span className="skeleton skeleton-value" /></div>)}</div></>
          : !reading ? <p>No stored sensor reading for {sample.id} yet.</p> : <>
            <dl className="risk-input-grid">{cards.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}
              <div><dt>Color (R / G / B)</dt><dd><span className="rgb-swatch risk-swatch" style={hasColor ? {background: `rgb(${rgb.join(',')})`} : undefined} aria-hidden="true" />{hasColor ? rgb.join(' / ') : 'Not available'}</dd></div></dl>
            <p className="panel-caption">Measured {stamp(reading.recordedAt)}{reading.dataOrigin === 'DEMO_DATA' ? ' · illustrative reading' : ''}</p>
            {(condition.stale || condition.invalid) && <p className="risk-reading-status risk-reading-warning" role="status">{condition.label}</p>}
          </>}
        {state.readingError && <p className="form-error" role="alert">{state.readingError}</p>}
      </section>
      <form className="risk-step risk-auth-form" onSubmit={event => {event.preventDefault(); onHistory(1);}}>
        <h3>2. Predict</h3>
        {!tokenOptional && <label htmlFor="risk-operator-token">Operator token<input id="risk-operator-token" type="password" autoComplete="off" value={token} disabled={busy} onChange={event => onToken(event.target.value)} /></label>}
        <div className="classifier-actions">
          <button type="button" className="button" onClick={onPredict} disabled={!canPredict}>{busy ? 'Predicting…' : 'Request risk prediction'}</button>
          {!tokenOptional && <button type="submit" className="button secondary" disabled={!state.hasToken || state.historyStatus === 'loading' || busy}>Load past predictions</button>}
        </div>
        {reading && condition.invalid && <p className="form-error" role="note">Can't predict for {sample.id}: {condition.label}</p>}
        {reading && !condition.invalid && !state.hasToken && <p className="form-hint">Enter your operator token to enable the prediction.</p>}
      </form>
    </>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <section className="risk-step risk-result" aria-label="Risk result" aria-live="polite" aria-busy={busy}>
      <h3>3. Result</h3>
      {busy && <p role="status">Predicting…</p>}
      {result && !state.demo ? <>
        <strong className={`risk-category risk-category-${result.riskCategory}`}>{RISK_LABELS[result.predictedRisk]}</strong>
        <p className="risk-meaning">{RISK_MEANING[result.predictedRisk]}</p>
        <p className="panel-caption">{result.sampleId} · predicted {stamp(result.predictedAt)}</p>
        {result.sensorReadingId !== reading?._id && <p className="research-note">This saved result is from an earlier reading, not the latest one above.</p>}
        <details><summary>Technical details</summary>
          <dl className="detail-list"><div><dt>Model version</dt><dd className="risk-reference">{result.modelVersion}</dd></div>
            <div><dt>Prediction horizon</dt><dd>Not verified (null)</dd></div>
            <div><dt>Validation</dt><dd>Not scientifically validated</dd></div>
            <div><dt>Sensor reading ID</dt><dd className="risk-reference">{result.sensorReadingId}</dd></div></dl>
          <dl className="risk-input-grid">{Object.entries(result.inputSnapshot).map(([name, number]) => <div key={name}><dt>{name}</dt><dd>{value(number)}<small className="risk-input-source">Source: {result.inputSources?.[name] || 'Not recorded'}</small></dd></div>)}</dl>
        </details>
      </> : !busy && <p>No prediction yet. Click <strong>Request risk prediction</strong>.</p>}
    </section>
    <section className="risk-step risk-history" aria-label="Risk prediction history" aria-busy={state.historyStatus === 'loading'}>
      <h3>Risk day by day</h3>
      {state.history.length > 0 && !state.demo && <ol className="risk-timeline" aria-label={`Daily risk for ${sample?.id}`}>
        {dailyRisk(state.history).map(({day, row}) => <li key={day} className={`risk-day risk-category-${row.riskCategory}`} title={`${dayLabel(day)}: ${RISK_LABELS[row.predictedRisk]}`}>
          <span className="risk-day-date">{dayLabel(day)}</span><strong>{row.predictedRisk}</strong>
        </li>)}
      </ol>}
      <p className="panel-caption">A new prediction is made automatically once a day when the sensor sends a complete reading.</p>
      {state.historyError && <p role="alert" className="form-error">{state.historyError}</p>}
      {state.historyStatus === 'loading' ? <p role="status">Loading risk prediction history…</p>
        : state.historyStatus === 'locked' ? <p>Enter your operator token to see past predictions.</p>
          : !state.history.length ? <p>No risk predictions have been stored for this sample.</p> : null}
      {!!state.history.length && !state.demo && <>
        <div className="table-wrap" tabIndex="0" role="region" aria-label={`Risk history for ${sample?.id}`}><table>
          <caption>All saved predictions · Sri Lanka time</caption>
          <thead><tr>{['Predicted at', 'Risk', 'Validation'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{state.history.map(row => <tr key={row._id}><td>{stamp(row.predictedAt)}</td><td><span className={`risk-category risk-category-${row.riskCategory}`}>{RISK_LABELS[row.predictedRisk]}</span></td><td>Not validated</td></tr>)}</tbody>
        </table></div>
        {state.pagination.pages > 1 && <div className="classifier-actions"><button className="button secondary" type="button" disabled={state.historyStatus === 'loading' || busy || state.pagination.page <= 1} onClick={() => onHistory(state.pagination.page - 1)}>Previous risk page</button>
          <span>Page {state.pagination.page} of {state.pagination.pages} · {state.pagination.total} records</span>
          <button className="button secondary" type="button" disabled={state.historyStatus === 'loading' || busy || state.pagination.page >= state.pagination.pages} onClick={() => onHistory(state.pagination.page + 1)}>Next risk page</button></div>}
      </>}
    </section>
    <p className="panel-caption" role="note">{RISK_DISCLAIMER}</p>
  </Panel>;
}

export default function RiskPredictionPanel({service = qualityService}) {
  const {selected, demoEnabled} = useQuality();
  const workspace = useMemo(() => createRiskWorkspace(service, {tokenOptional: TOKEN_OPTIONAL}), [service]);
  const state = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot, workspace.getSnapshot);
  const [token, setToken] = useOperatorToken();
  const [now, setNow] = useState(Date.now());
  // Runs before selectSample, so a remembered token loads history straight away.
  useEffect(() => {workspace.setToken(token);}, [workspace, token]);
  useEffect(() => {
    workspace.selectSample(selected, demoEnabled);
    return () => workspace.dispose();
  }, [workspace, selected?.id, selected?.storageStartTimestamp, demoEnabled]);
  useEffect(() => {const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer);}, []);
  // Hide the previous sample synchronously, before effects cancel its requests.
  const visible = state.sampleId === selected?.id && state.demo === demoEnabled ? state
    : {...state, sampleId: selected?.id || null, demo: demoEnabled, reading: null, result: null, history: [], error: '', notice: '', readingError: '', historyError: '', readingStatus: 'loading'};
  return <RiskPredictionView state={visible} sample={selected} token={token} tokenOptional={TOKEN_OPTIONAL} now={now}
    onToken={setToken}
    onPredict={workspace.predict} onReading={workspace.loadReading} onHistory={workspace.loadHistory} />;
}

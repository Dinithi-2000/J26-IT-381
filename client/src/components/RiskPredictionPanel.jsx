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

export function RiskPredictionView({state, sample, token = '', tokenOptional = false, onToken = noop, onPredict = noop,
  onReading = noop, onHistory = noop, now = Date.now()}) {
  const busy = state.predictionStatus === 'loading';
  const reading = state.reading;
  const condition = readingCondition(reading, state.deviceStatus, now);
  const duration = reading && sample?.storageStartTimestamp
    ? Math.floor((Date.parse(reading.recordedAt) - Date.parse(sample.storageStartTimestamp)) / 86400000) : null;
  const result = state.result || state.history[0];
  const enabled = !!sample && !state.demo;
  const metrics = [['Sample ID', sample?.id || 'No sample selected'], ['Temperature', value(reading?.temperatureC, ' °C')],
    ['Relative humidity', value(reading?.relativeHumidityPercent, ' %')], ['Weight', value(reading?.weightGrams, ' g')],
    ['RGB readings', reading ? [reading.red, reading.green, reading.blue].map(channel => value(channel)).join(' / ') : 'Not available'],
    ['Storage duration', typeof duration === 'number' && duration >= 0 ? `${duration} completed days` : 'Not available']];
  return <Panel title="Storage Deterioration Risk" eyebrow="MODEL 02 / RANDOMFOREST" className="synthetic-risk-panel">
    <p className="panel-caption" role="note">{RISK_DISCLAIMER}</p>
    <p className="panel-caption">Model 01 image screening is available alongside this panel on the overview and in Image analysis. This section uses stored sensor readings through the authenticated Node backend.</p>
    {state.demo ? <p className="research-note">Demo mode is enabled. Turn it off to select a registered sample and an actual stored sensor reading. No prediction is generated from demonstration samples.</p>
      : !sample ? <p role="status">No registered sample selected. Register or select a sample to load stored readings. No risk prediction is available.</p> : <>
      <section className="risk-sensor-section" aria-label="Stored sensor inputs" aria-busy={state.readingStatus === 'loading'}>
        <div className="risk-section-header"><h3>Latest stored sensor reading</h3><button className="button secondary" type="button" disabled={busy || state.readingStatus === 'loading'} onClick={onReading}>Refresh reading</button></div>
        {state.readingStatus === 'loading' ? <><p role="status">Loading stored sensor reading…</p><div className="risk-input-grid" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(index => <div className="skeleton-card" key={index}><span className="skeleton skeleton-label" /><span className="skeleton skeleton-value" /></div>)}</div></>
          : <><dl className="risk-input-grid">{metrics.map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>
            <p className={`risk-reading-status${condition.stale || condition.invalid ? ' risk-reading-warning' : ''}`} role="status">{condition.label}</p>
            <p>Sensor reading timestamp: <strong>{stamp(reading?.recordedAt)}</strong></p>
            {reading && <p className="panel-caption">Temperature source: {reading.environment?.temperature?.source || 'Not recorded'}. Humidity source: {reading.environment?.humidity?.source || 'Not recorded'}. Input origin: {reading.dataOrigin || 'Legacy record - origin not recorded'}.</p>}
            {reading && <p className="panel-caption risk-reference">Reading ID: {reading._id}</p>}
          </>}
        {state.readingError && <p className="form-error" role="alert">{state.readingError}</p>}
        <p className="panel-caption">Storage duration uses completed UTC 24-hour periods at measurement time. This is a prototype assumption until training metadata confirms the calculation. The backend independently checks freshness and input limits.</p>
      </section>
      <form className="risk-auth-form" onSubmit={event => {event.preventDefault(); onHistory(1);}}>
        {!tokenOptional && <><label htmlFor="risk-operator-token">Operator token<input id="risk-operator-token" type="password" autoComplete="off" value={token} disabled={busy} onChange={event => onToken(event.target.value)} /></label>
        <p className="panel-caption">Remembered until you close this browser tab. Enter your operator token, never the Python service token.</p></>}
        <div className="classifier-actions">
          <button type="button" className="button" onClick={onPredict} disabled={!enabled || !state.hasToken || !reading || condition.invalid || state.readingStatus !== 'ready' || busy}>{busy ? 'Requesting stored risk result…' : 'Request risk prediction'}</button>
          <button type="submit" className="button secondary" disabled={!state.hasToken || state.historyStatus === 'loading' || busy}>Load risk history</button>
        </div>
        {reading && condition.invalid && <p className="form-error" role="note">Risk prediction is unavailable for {sample.id}: {condition.label} Select a sample that has temperature and humidity readings.</p>}
        {reading && !condition.invalid && !state.hasToken && <p className="form-hint">Enter your operator token to enable Request risk prediction.</p>}
        <p className="panel-caption">Nothing is predicted on page load. Retrying the same sample and reading retrieves the same saved result. Stale readings may only retrieve an existing result.</p>
      </form>
    </>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.notice && <p role="status">{state.notice}</p>}
    <section className="risk-result" aria-label="Model 02 risk result" aria-live="polite" aria-busy={busy}>
      <h3>Stored risk result</h3>
      {busy && <p role="status">Waiting for the backend to validate the reading and return a persisted result…</p>}
      {result && !state.demo ? <>
        <strong className={`risk-category risk-category-${result.riskCategory}`}>{RISK_LABELS[result.predictedRisk]}</strong>

        <dl className="detail-list"><div><dt>Sample ID</dt><dd>{result.sampleId}</dd></div>
          <div><dt>Prediction timestamp</dt><dd>{stamp(result.predictedAt)}</dd></div>
          <div><dt>Model version</dt><dd className="risk-reference">{result.modelVersion}</dd></div>
          <div><dt>Prediction horizon</dt><dd>Not verified (null)</dd></div>
          <div><dt>Validation</dt><dd>Not scientifically validated</dd></div>
          <div><dt>Sensor reading ID</dt><dd className="risk-reference">{result.sensorReadingId}</dd></div></dl>
        {result.sensorReadingId !== reading?._id && <p className="research-note">This stored result refers to a different reading from the current sensor values above. It is historical, not a new assessment of the latest reading.</p>}
        <details><summary>Inputs saved with this result</summary><dl className="risk-input-grid">{Object.entries(result.inputSnapshot).map(([name, number]) => <div key={name}><dt>{name}</dt><dd>{value(number)}<small className="risk-input-source">Source: {result.inputSources?.[name] || 'Not recorded in this historical result'}</small></dd></div>)}</dl></details>
      </> : <p>No Model 02 risk result loaded. Results appear only after an authenticated backend response; no risk category is inferred in the browser.</p>}
    </section>
    <section className="risk-history" aria-label="Risk prediction history" aria-busy={state.historyStatus === 'loading'}>
      <h3>Historical risk predictions</h3>
      {state.historyError && <p role="alert" className="form-error">{state.historyError}</p>}
      {state.historyStatus === 'loading' ? <p role="status">Loading risk prediction history…</p>
        : state.historyStatus === 'locked' ? <p>Enter your operator token and load this sample’s risk history.</p>
          : !state.history.length ? <p>{state.historyStatus === 'ready' ? 'No risk predictions have been stored for this sample.' : 'No risk history loaded.'}</p> : null}
      {!!state.history.length && !state.demo && <>
        <div className="table-wrap" tabIndex="0" role="region" aria-label={`Risk history for ${sample?.id}`}><table>
          <caption>Saved risk predictions · timestamps shown in Sri Lanka time</caption>
          <thead><tr>{['Predicted at', 'Risk category', 'Model version', 'Sensor reading ID', 'Validation'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{state.history.map(row => <tr key={row._id}><td>{stamp(row.predictedAt)}</td><td><span className={`risk-category risk-category-${row.riskCategory}`}>{RISK_LABELS[row.predictedRisk]}</span></td><td className="risk-reference">{row.modelVersion}</td><td className="risk-reference">{row.sensorReadingId}</td><td>Not validated</td></tr>)}</tbody>
        </table></div>
        <div className="classifier-actions"><button className="button secondary" type="button" disabled={state.historyStatus === 'loading' || busy || state.pagination.page <= 1} onClick={() => onHistory(state.pagination.page - 1)}>Previous risk page</button>
          <span>Page {state.pagination.page} of {state.pagination.pages} · {state.pagination.total} records</span>
          <button className="button secondary" type="button" disabled={state.historyStatus === 'loading' || busy || state.pagination.page >= state.pagination.pages} onClick={() => onHistory(state.pagination.page + 1)}>Next risk page</button></div>
      </>}
    </section>
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

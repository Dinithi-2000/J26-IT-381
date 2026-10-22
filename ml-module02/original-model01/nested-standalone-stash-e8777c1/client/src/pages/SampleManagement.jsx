import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuality } from '../components/QualityProvider';
import { DataState, Panel } from '../components/QualityUI';

const initialForm = { id: '', batchId: '', grade: '', storage: '', storageStartDate: '', initialWeight: '' };
export default function SampleManagement() {
  const { demoEnabled, samples, registerSample } = useQuality();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  function submit(event) {
    event.preventDefault();
    setError('');
    const input = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
    if (Object.values(input).some(value => !value)) return setError('Complete every field. Whitespace-only values are not accepted.');
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(input.id)) return setError('Use 2–64 letters, numbers, hyphens, or underscores for the sample ID.');
    input.initialWeight = Number(input.initialWeight);
    if (!Number.isFinite(input.initialWeight) || input.initialWeight <= 0 || input.initialWeight > 10000) {
      return setError('Initial weight must be greater than 0 g and no more than 10,000 g.');
    }
    try {
      const sample = registerSample(input);
      navigate(`/module-02/samples/${encodeURIComponent(sample.id)}`);
    } catch (failure) { setError(failure.message); }
  }
  return <>
    <DataState />
    <div className="section-heading-local"><div><p className="eyebrow">SAMPLE MANAGEMENT</p><h2>A record for every sample.</h2></div>
      <span className="small-badge">{samples.length} {demoEnabled ? 'DEMO ' : ''}SAMPLES</span></div>
    {samples.length > 0 && <div className="sample-cards">{samples.map(sample => <Link key={sample.id} className="panel sample-card" to={`/module-02/samples/${encodeURIComponent(sample.id)}`}>
      <span className="eyebrow">{sample.batchId}</span><h3>{sample.id} ↗</h3>
      <p>{sample.grade} · {sample.storage}</p><span>Storage start: {sample.storageStartDate}</span>
      <span>{sample.records.length} measurements · {sample.images.length} image references</span>
    </Link>)}</div>}
    <Panel title="Register a demonstration sample" eyebrow="FRONTEND WORKFLOW" className="registration-panel">
      <p>Demo registrations stay in memory while you remain in Module 02. Refreshing or leaving this module resets them. No database record is created.</p>
      {!demoEnabled && <p className="form-hint">Enable demo data above to try registration.</p>}
      <form onSubmit={submit} className="sample-form">
        <fieldset disabled={!demoEnabled}>
          <legend className="sr-only">Demonstration sample registration</legend>
          <div className="form-grid">
            {[
              ['id', 'Sample ID', 'text', 'CIN-DEMO-003'], ['batchId', 'Batch ID', 'text', 'BATCH-DEMO-C'],
              ['grade', 'Sample description / grade', 'text', 'Cinnamon quills'], ['storage', 'Storage setting', 'text', 'Container description'],
              ['storageStartDate', 'Storage start date', 'date', ''], ['initialWeight', 'Initial weight (g)', 'number', '250'],
            ].map(([name, label, type, placeholder]) => <label key={name} htmlFor={`register-${name}`}>{label}
              <input id={`register-${name}`} name={name} type={type} value={form[name]} placeholder={placeholder}
                required maxLength={name === 'id' ? 64 : 120} min={type === 'number' ? '0.01' : undefined}
                max={type === 'number' ? '10000' : undefined} step={type === 'number' ? '0.01' : undefined}
                onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))} />
            </label>)}
          </div>
          <button type="submit" className="button">Create local demo sample →</button>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Panel>
  </>;
}

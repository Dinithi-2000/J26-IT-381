import { useEffect, useState } from 'react';
import { useDehydration } from '../components/DehydrationProvider';
import { ControlStatusCard, Panel, StatusBadge } from '../components/DehydrationUI';
import Icon from '../components/Icon';

function NumericSetting({ id, label, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  return <label htmlFor={id}>{label}<input id={id} type="number" min={min} max={max} step="1" value={draft} placeholder="Not available"
    onChange={event => {
      setDraft(event.target.value);
      const next = event.target.valueAsNumber;
      if (Number.isInteger(next) && next >= min && next <= max) onCommit(next);
    }} onBlur={() => {
      const next = draft === '' ? NaN : Number(draft);
      if (!Number.isInteger(next) || next < min || next > max) setDraft(value == null ? '' : String(value));
    }} /></label>;
}

export default function ChamberControls() {
  const { telemetry: data, demoEnabled, liveConnected, simulateControl } = useDehydration();
  const manual = demoEnabled && data?.controlMode === 'Manual';
  const heaterLimited = data?.temperatureProtection === 'Heater limited';
  return <>
    <div className="drying-section-heading"><div><p className="eyebrow">CHAMBER / RELAY SETTINGS</p><h2>Chamber controls</h2><p>Review relay states and explore the planned control interface.</p></div><StatusBadge tone={demoEnabled ? 'demo' : liveConnected ? 'online' : 'offline'}>{demoEnabled ? 'Demo control only' : liveConnected ? 'Chamber connected' : 'Chamber not connected'}</StatusBadge></div>
    <div className="drying-two-grid"><Panel title="Process settings" eyebrow="HEATER / FAN / TARGETS" badge={demoEnabled ? 'DEMO CONTROL ONLY' : 'DISABLED'}>
      <p className="panel-caption">{demoEnabled ? 'Demo control only. Changes are local to this interface and send no hardware commands. Select Manual to simulate relay changes.' : `${liveConnected ? 'Live telemetry active.' : 'Chamber not connected.'} Hardware controls are disabled until the ESP32-S3 control integration is available.`}</p>
      <fieldset className="drying-control-fields" disabled={!demoEnabled}><legend>Chamber settings</legend>
        <label htmlFor="drying-control-mode">Control mode<select id="drying-control-mode" value={data?.controlMode ?? 'Unavailable'} onChange={event => simulateControl('controlMode', event.target.value)}>
          {!demoEnabled && <option>Unavailable</option>}<option>Automatic</option><option>Manual</option>
        </select></label>
        {[['heaterState', 'Heater', 'sun'], ['fanState', 'Fan', 'wind']].map(([key, label, icon]) => <div className="drying-relay" key={key}>
          <div><Icon name={icon} size={21} /><span><strong>{label} relay</strong><small>ON / OFF control</small></span></div>
          <button type="button" role="switch" aria-label={`${label} relay`} aria-checked={data?.[key] === 'ON'} disabled={!manual || (key === 'heaterState' && heaterLimited)} onClick={() => simulateControl(key, data?.[key] === 'ON' ? 'OFF' : 'ON')}>
            <span className={`drying-relay-track${data?.[key] === 'ON' ? ' is-on' : ''}`} aria-hidden="true" /><span>{data?.[key] ?? 'Unavailable'}</span>
          </button>
        </div>)}
        <NumericSetting id="drying-max-temperature" label="Maximum chamber temperature (°C)" min={30} max={60} value={data?.maxTemperature} onCommit={value => simulateControl('maxTemperature', value)} />
        <NumericSetting id="drying-target-moisture" label="Target moisture (%)" min={10} max={30} value={data?.targetMoisture} onCommit={value => simulateControl('targetMoisture', value)} />
      </fieldset>
      {demoEnabled && <p className="drying-control-feedback" role="status">{heaterLimited ? 'Demo temperature protection: heater limited and switched OFF.' : manual ? 'Manual demo controls enabled.' : 'Automatic demo mode. Relay switches are read-only.'}</p>}
      <div className="research-note"><Icon name="info" size={18} /><div><strong>Research prototype · relay control</strong><p>The prototype uses heater and fan ON/OFF relays. Settings and simulated changes reset when demo data is disabled.</p></div></div>
    </Panel><ControlStatusCard /></div>
  </>;
}

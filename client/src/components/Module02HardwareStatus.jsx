import Icon from './Icon';
import {formatTimestamp} from '../data/demoQuality';
import '../styles/module02-hardware.css';

export default function Module02HardwareStatus({hardware, sampleId}) {
  const rows = [['ESP32-S3',hardware.esp32],['HX711 Load Cell',hardware.hx711],['RGB Sensor',hardware.rgb],['DHT11 Temp/Humidity',hardware.dht || 'Offline']];
  return <section className="sidebar-device-panel module02-hardware-panel" aria-label="Module 02 hardware status" aria-busy={hardware.esp32 === 'Checking'}>
    <div className="sidebar-device-heading"><Icon name={hardware.connected ? 'cpu' : 'offline'} size={18} /><strong className="sidebar-copy">Hardware status</strong></div>
    <div className="sidebar-copy">
      <p className="module02-hardware-record">{sampleId || 'No cinnamon selected'}</p>
      <div aria-live="polite" aria-atomic="true">{rows.map(([label,status]) => <div key={label} className="device-row" aria-label={`${label} ${status}`}>
        <span aria-hidden="true" className={`connection-dot ${status === 'Connected' || status === 'Online' ? 'module02-connected' : status === 'Checking' ? 'neutral' : 'offline'}`} />
        <span className="module02-device-name">{label}</span><span className="module02-device-status">{status}</span>
      </div>)}</div>
      <dl className="module02-hardware-reading">
        <div><dt>Last real weight</dt><dd>{Number.isFinite(hardware.weight) ? `${Number(hardware.weight.toFixed(2))} g` : 'No real weight received'}</dd></div>
        {Number.isFinite(hardware.temperature) && <div><dt>Temperature / humidity</dt><dd>{hardware.temperature} °C · {hardware.humidity} %</dd></div>}
        <div><dt>Measured at</dt><dd>{hardware.measuredAt ? formatTimestamp(hardware.measuredAt) : 'No telemetry'}</dd></div>
      </dl>
      <p className="module02-hardware-message">{hardware.message}</p>
      {hardware.illustrative && <p className="module02-hardware-message">Illustrative stored readings do not establish hardware connectivity.</p>}
      <p className="module02-hardware-caption">Checks every 5 seconds. Freshness: {hardware.freshnessSeconds}s. Connected means recent accepted telemetry, not a continuous socket or Wi-Fi check.</p>
    </div>
  </section>;
}

import {useQuality} from './QualityProvider';
import {Panel} from './QualityUI';
import TrendChart from './TrendChart';
import {formatTimestamp} from '../data/demoQuality';

const value = (number, unit = '') => Number.isFinite(number) ? `${Number(number.toFixed(2))}${unit}` : 'Not available';
const stamp = timestamp => timestamp && Number.isFinite(Date.parse(timestamp)) ? formatTimestamp(timestamp) : 'No measurement';

export function Module02SensorView({sample, demo = false, now = Date.now()}) {
  const records = sample?.records || [], current = records.at(-1);
  const previous = records.slice(0, -1).findLast(row => Number.isFinite(row.weight));
  const fresh = current && Date.parse(current.timestamp) <= now && now - Date.parse(current.timestamp) <= (sample?.deviceStatus?.offlineAfterSeconds || 300) * 1000;
  const status = sensor => demo ? 'DEMO - no connected sensor'
    : !current || !fresh || current.sensorStatus?.[sensor] === 'offline' ? 'Sensor Offline'
      : current.dataOrigin === 'REAL_SENSOR' ? 'Recent device record - not a live connection' : 'Historical record - sensor status not recorded';
  const real = !demo && current?.dataOrigin === 'REAL_SENSOR';
  const rgb = current?.rgb || [];
  const hasColor = rgb.length === 3 && rgb.every(Number.isFinite);
  const change = Number.isFinite(current?.weight) && sample?.initialWeight > 0 ? (current.weight - sample.initialWeight) / sample.initialWeight * 100 : null;
  return <Panel title="Weight and color evidence" eyebrow="MODULE 02 / SENSOR MEASUREMENTS" badge={demo ? 'DEMO DATA' : real ? 'REAL_SENSOR RECORD' : undefined} className="module02-sensor-panel">
    <p>Values describe stored captures. Connection labels use the last record and its age; they do not prove that hardware is connected now.</p>
    {!sample && <p role="status">No samples available. Register a sample before importing actual measurements.</p>}
    <dl className="risk-input-grid">
      {[['Sample ID', sample?.id || 'Not selected'], ['Storage start', sample?.storageStartDate || 'Not recorded'],
        ['Storage duration at capture', value(current?.day, ' completed days')], ['Last measurement', stamp(current?.timestamp)],
        ['Current weight', value(current?.weight, ' g')], ['Previous measured weight', value(previous?.weight, ' g')],
        ['Weight change from initial', value(change, ' %')], ['Load Cell connection', status('weight')],
        ['Calibration status', demo ? 'DEMO metadata only' : current?.calibration?.calibratedAt ? 'Calibration recorded; not independently verified' : 'No calibration recorded'],
        ['Calibration time', stamp(current?.calibration?.calibratedAt)], ['Last tare', stamp(current?.calibration?.tareAt)],
        ['Stability spread', value(current?.calibration?.spreadGrams, ' g')], ['RGB sensor status', status('color')],
        ['Raw red counts', value(current?.rgbRaw?.red)], ['Raw green counts', value(current?.rgbRaw?.green)],
        ['Raw blue counts', value(current?.rgbRaw?.blue)], ['Raw clear counts', value(current?.rgbRaw?.clear)],
        ['Sensor gain', value(current?.colorSettings?.gain, 'x')], ['Integration time', value(current?.colorSettings?.integrationTimeMs, ' ms')],
        ['Display RGB (0-255)', hasColor ? rgb.join(' / ') : 'No Reading'],
        ['Temperature', value(current?.temperature, ' °C')], ['Temperature source', demo ? 'DEMO' : current?.environment?.temperature?.source || 'Not recorded'],
        ['Humidity', value(current?.humidity, ' % RH')], ['Humidity source', demo ? 'DEMO' : current?.environment?.humidity?.source || 'Not recorded'],
      ].map(([label, content]) => <div key={label}><dt>{label}</dt><dd>{content}</dd></div>)}</dl>
    <div className="module02-color-preview"><span className="rgb-swatch" style={hasColor ? {backgroundColor: `rgb(${rgb.join(',')})`} : undefined} aria-label={hasColor ? 'Uncalibrated display color preview' : 'No color reading'} /><p>{real ? 'Raw RGBC counts are preserved separately. Display RGB uses a clamped channel-to-clear ratio, not calibrated colorimetry.' : 'No raw sensor counts are inferred from display RGB.'}</p></div>
    <div className="module02-sensor-charts">
      <div><h3>Weight history</h3><TrendChart records={records} series={[{name: 'Weight (g)', read: row => row.weight}]} label={`${demo ? 'DEMO: ' : ''}weight history; timestamped values in measurement history`} /></div>
      <div><h3>RGB change history (display values)</h3><TrendChart records={records} series={['Red', 'Green', 'Blue'].map((name, index) => ({name, color: ['#a85a2a', '#163b2c', '#527f9a'][index], read: row => row.rgb?.[index]}))} label={`${demo ? 'DEMO: ' : ''}normalized display RGB history; raw counts retained separately`} /></div>
    </div>
    <p className="research-note">Temperature and humidity sensors are not available in the current setup. Missing measurements remain null. Actual manually measured environmental values need their instrument and measurement time; simulated values are not accepted by the real-sensor import contract.</p>
  </Panel>;
}

export default function Module02SensorPanel() {
  const {selected, demoEnabled} = useQuality();
  return <Module02SensorView sample={selected} demo={demoEnabled} />;
}

export function Module02MeasurementHistory({sample}) {
  const {demoEnabled} = useQuality();
  return <Panel title="The details behind the trends." eyebrow="SAMPLE MEASUREMENT HISTORY" badge={demoEnabled ? 'DEMO DATA' : 'STORED MEASUREMENTS'}>
    {sample.historyTotal > 200 && <p>Showing the latest 200 of {sample.historyTotal} measurements.</p>}
    {!sample.records.length ? <p>No measurements recorded for this sample. Registration does not create sensor readings.</p> :
      <div className="table-wrap" tabIndex="0" role="region" aria-label={`Measurement history for ${sample.id}`}><table>
        <caption>{demoEnabled ? 'DEMO DATA: ' : ''}{sample.id} - timestamps in Sri Lanka time; missing values are not zero</caption>
        <thead><tr>{['Timestamp', 'Storage day', 'Weight (g)', 'Weight change (%)', 'Temperature (°C)', 'Humidity (% RH)', 'Gas resistance (ohms)', 'Display RGB', 'Raw RGBC counts', 'Data source'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{sample.records.map(row => <tr key={row.id || row.timestamp}>
          <td>{stamp(row.timestamp)}</td><td>{value(row.day)}</td><td>{value(row.weight)}</td><td>{value(Number.isFinite(row.weight) && sample.initialWeight > 0 ? (row.weight - sample.initialWeight) / sample.initialWeight * 100 : null)}</td><td>{value(row.temperature)}</td><td>{value(row.humidity)}</td><td>{value(row.gasResistanceOhms)}</td>
          <td>{row.rgb?.map(channel => value(channel)).join(' / ') || 'No Reading'}</td>
          <td>{row.rgbRaw ? ['red', 'green', 'blue', 'clear'].map(key => value(row.rgbRaw[key])).join(' / ') : 'Not recorded'}</td>
          <td>{demoEnabled ? 'DEMO' : row.dataOrigin || 'Legacy - origin not recorded'}<br />Temperature: {demoEnabled ? 'DEMO' : row.environment?.temperature?.source || 'Not recorded'}<br />Humidity: {demoEnabled ? 'DEMO' : row.environment?.humidity?.source || 'Not recorded'}</td>
        </tr>)}</tbody>
      </table></div>}
  </Panel>;
}

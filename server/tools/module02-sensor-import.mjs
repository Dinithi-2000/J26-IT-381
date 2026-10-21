// Explicit manual serial-log fallback. No serial port access, firmware, or random data.
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {readingInput, date, number, object} from '../src/module02/validation.js';

export function calibrateHx711(input) {
  object(input, ['tareSamples', 'referenceSamples', 'referenceMassGrams', 'tareAt', 'calibratedAt', 'stabilityLimitGrams', 'version']);
  const average = rows => {
    if (!Array.isArray(rows) || rows.length < 5 || rows.length > 64 || rows.some(n => !Number.isInteger(n) || n <= -8388608 || n >= 8388607)) throw new Error('Calibration needs 5–64 actual signed 24-bit counts per window without rail values.');
    return rows.reduce((a, b) => a + b, 0) / rows.length;
  };
  number(input.referenceMassGrams, 'referenceMassGrams', 0.01, 10000);
  number(input.stabilityLimitGrams, 'stabilityLimitGrams', 0.01, 2);
  const tareRaw = Math.round(average(input.tareSamples));
  const countsPerGram = (average(input.referenceSamples) - tareRaw) / input.referenceMassGrams;
  if (!Number.isFinite(countsPerGram) || Math.abs(countsPerGram) < 0.001) throw new Error('Reference mass produced no usable scale difference.');
  for (const rows of [input.tareSamples, input.referenceSamples]) {
    if ((Math.max(...rows) - Math.min(...rows)) / Math.abs(countsPerGram) > input.stabilityLimitGrams) throw new Error('Unstable calibration capture.');
  }
  const calibratedAt = date(input.calibratedAt, 'calibratedAt'), tareAt = date(input.tareAt, 'tareAt');
  if (tareAt > calibratedAt || calibratedAt > new Date()) throw new Error('Invalid calibration/tare chronology.');
  if (typeof input.version !== 'string' || !input.version.trim()) throw new Error('Give this physical calibration a version identifier.');
  return {protocol: 'HX711-known-mass-v1', version: input.version, tareAt: tareAt.toISOString(),
    calibratedAt: calibratedAt.toISOString(), tareRaw, countsPerGram,
    referenceMassGrams: input.referenceMassGrams, stabilityLimitGrams: input.stabilityLimitGrams};
}

export async function main(args = process.argv.slice(2)) {
  const {values} = parseArgs({args, options: {file: {type: 'string'}, calibrate: {type: 'boolean'},
    submit: {type: 'boolean'}, 'confirm-real-source': {type: 'boolean'}, backend: {type: 'string', default: 'http://127.0.0.1:5000'}}});
  let input;
  if (values.file) input = await readFile(values.file, 'utf8');
  else {const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk); input = Buffer.concat(chunks).toString('utf8');}
  if (values.calibrate) {
    if (values.submit) throw new Error('Calibration is local only; no database upload.');
    console.log(JSON.stringify(calibrateHx711(JSON.parse(input)), null, 2)); return;
  }
  const rows = input.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  if (!rows.length) throw new Error('No actual captured JSONL records supplied.');
  for (const row of rows) {
    if (row.dataOrigin !== 'REAL_SENSOR') throw new Error('This tool accepts only actual REAL_SENSOR serial logs.');
    readingInput(row); // Validate ALL rows before any submission.
  }
  if (!values.submit) {console.log(`Validated ${rows.length} records locally. DRY RUN: no database writes.`); return;}
  if (!values['confirm-real-source']) throw new Error('Use --confirm-real-source only after checking these are actual hardware captures.');
  const url = new URL(values.backend);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use a loopback Node backend URL without credentials or path.');
  const deviceId = process.env.MODULE02_IMPORT_DEVICE_ID, key = process.env.MODULE02_IMPORT_DEVICE_KEY;
  if (!deviceId || !key || rows.some(row => row.deviceId !== deviceId)) throw new Error('Configure matching MODULE02_IMPORT_DEVICE_ID and MODULE02_IMPORT_DEVICE_KEY privately.');
  for (const row of rows) {
    const response = await fetch(new URL('/api/module-02/readings', url), {method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Device-Id': deviceId, 'X-Device-Key': key},
      body: JSON.stringify(row), signal: AbortSignal.timeout(10000)});
    const body = await response.json();
    if (response.status === 409 && body.error?.code === 'DUPLICATE_RECORD') {
      console.log('Duplicate measurement ID rejected; no additional record inserted. Check existing history before continuing.');
      return; // Do not assume an identifier collision has identical contents.
    }
    if (response.status !== 201) throw new Error(`Import stopped: HTTP ${response.status}, ${body.error?.code || 'REQUEST_FAILED'}. Earlier accepted rows remain stored.`);
    console.log('Actual capture accepted.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {console.error('Sensor import failed. Check JSONL, calibration, configuration, and backend history; secrets and raw error contents are suppressed.'); process.exitCode = 1;});
}

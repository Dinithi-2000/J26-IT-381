# Module 02: HX711 and TCS34725 software integration

Status: software implemented; physical hardware verification pending. The owner
confirmed that the board is not yet connected. Its exact model and GPIO wiring
remain unconfirmed. No firmware was flashed or board-specific sketch invented.
Original Model 01, trained weights, historical archives, Python model code,
shared authentication, shared server startup, and other modules are unchanged.

## Existing architecture reused

- React overview: `client/src/pages/QualityDashboard.jsx`; predictions:
  `QualityPredictions.jsx`; image workflow: `ImageClassifierPanel.jsx`.
- Sample registration: `POST /api/samples`, operator Bearer authentication.
  Fields: `sampleId`, `batchId`, `grade`, `storage`, ISO `storageStartDate`, and
  **actually measured** `initialWeightGrams`. Register through the sample library.
- Telemetry: `POST /api/module-02/readings`, headers `X-Device-Id` and
  `X-Device-Key`; existing device-key registry is used without changing auth.
- Latest reading: `GET /api/module-02/readings/latest?sampleId=...`.
- History: `GET /api/module-02/samples/:sampleId/readings`, paginated with
  `page`, `limit`, `from`, `to`, and `order=asc|desc`.
- Risk: `POST /api/module-02/risk-predictions` with `{sampleId, readingId}` and
  operator Bearer token; history at
  `GET /api/module-02/samples/:sampleId/risk-predictions`.
- Existing collections: `module02_samples`, `module02_sensor_readings`,
  `module02_sample_images`, `module02_degradation_predictions`, and
  `module02_synthetic_risk_predictions`. No new collection/API was added.

Sensor capture time is stored in existing `recordedAt` (the requested
`capturedAt` meaning); ingestion time remains `createdAt`. Existing `weightGrams`
corresponds to `weightG`; `red/green/blue` are display values, and `rgbRaw`
contains full raw RGBC counts. These names preserve compatibility.

## Opt-in REAL_SENSOR telemetry contract

Existing complete-reading payloads still require all their previous fields.
Only payloads explicitly declaring `dataOrigin: "REAL_SENSOR"` use the new
two-sensor validation rules. Unsupported properties are rejected.

Required fields:

- Existing identifiers: `sampleId`, `deviceId`, unique `measurementId`.
- `recordedAt`: actual ISO capture timestamp with timezone; not in the future,
  and not before sample storage started. Synchronize the board clock, or retain
  a genuinely recorded acquisition timestamp in a supervised serial capture.
- `sensorStatus: {weight: "online"|"offline", color: "online"|"offline"}`.
- For online weight: `rawWeightSamples` (5–64 consecutive signed HX711 counts),
  plus `calibration` below. Optional `weightGrams` must agree with derived weight
  within 0.05 g. Rail values, out-of-range/negative weights and unstable windows
  are rejected, not clamped to zero.
- For online color: `rgbRaw: {red, green, blue, clear}` integer raw counts and
  `colorSettings: {gain, integrationTimeMs, lighting, distanceMm}`. Gain must be
  1, 4, 16 or 60; integration time is actual effective time, 2.4–614.4 ms.
  Dark/zero-clear and saturated captures are rejected, including the ADC limit
  implied by integration time.
- For offline sensors: omit their raw samples and metadata. Weight and display
  RGB are stored as null. A record can report one or both sensors offline.
- `temperatureC` and `relativeHumidityPercent` can be absent/null; stored values
  remain null. No gas sensor is available, so `gasResistanceOhms` is null.

Calibration fields:
`protocol`, `version`, `calibratedAt`, `tareAt`, `tareRaw`, signed
`countsPerGram`, `referenceMassGrams`, and `stabilityLimitGrams`.
Timestamps must describe actual calibration/tare actions and cannot follow the
capture. Server stores `spreadGrams` computed from the raw window.

The prototype accepts a declared stability limit from 0.01 to 2 g and uses the
window range divided by absolute counts-per-gram. These are software acceptance
limits, **not validated instrument precision**. A valid payload cannot prove
that a device was calibrated accurately or even that it physically measured
cinnamon; authenticated hardware and independent verification remain necessary.

Display normalization is explicitly `clear-ratio-clamped-255-v1`:
`round(min(255, rawChannel / rawClear * 255))`. Raw counts are retained unchanged.
This is an uncalibrated visualization, not CIELAB, a color-difference metric, or
evidence that sensor values match the synthetic model's training distribution.

### Actual manual environmental measurements

Supply a numeric `temperatureC` and/or `relativeHumidityPercent` only when
actually measured. Each supplied value requires respectively:

```text
environment.temperature = {source: "manual", measuredAt: actual ISO timestamp, instrument: actual instrument description}
environment.humidity    = {source: "manual", measuredAt: actual ISO timestamp, instrument: actual instrument description}
```

Measurement times must be no later than capture and no more than one hour old
at capture (a prototype association rule). Simulated sources and missing
provenance are rejected. Missing values get source `unavailable`, never zero.

Model 02 requests with either environmental value missing return
`ENVIRONMENT_REQUIRED`: **Temperature and humidity inputs required for risk
prediction.** The browser also blocks the request; no incomplete payload is
sent to the Python model. Normal freshness/positive-weight/RGB checks still
apply. Completed risk results retain an optional `inputSources` snapshot;
historical records without provenance remain unchanged and are labeled as such.
Results remain `SYNTHETIC_DEMO`, unvalidated, with null/unverified horizon.

Duplicate `(deviceId, measurementId)` submissions return the existing 409
`DUPLICATE_RECORD` and never insert a second record. Keep the same ID for retry;
check history rather than assuming an ID collision has identical content.

## Physical setup and calibration workflow

1. Identify the actual ESP32 board, its voltage/pinout and the exact breakout
   boards. Confirm HX711 DT/SCK, TCS34725 SDA/SCL, power and common ground using
   manufacturer diagrams. Do not use guessed ESP32-S3 or ESP32-CAM pins. Load-cell
   wire colors are not a universal pinout. No GPIO assignments are supplied yet.
2. Use the HX711 driver's readiness/timeout checks and reject disconnected/rail
   reads. Use TCS34725 initialization/I2C errors to report offline; never substitute
   random readings or zeros. Its driver can read raw R/G/B/C and set gain/time.
3. Fix lighting, background and sensor distance; record gain, effective integration
   time, lighting description and distance in every capture. Recapture dark or
   saturated images under adjusted settings.
4. Empty and stabilize the platform; record 5–64 raw HX711 tare counts and the
   actual tare timestamp. Place an independently known mass, record its mass in
   grams, another stable raw window and the actual calibration timestamp.
5. Compute `countsPerGram = (mean(referenceCounts) - tareRaw) / knownMassGrams`,
   retaining its sign. Compute sample grams from `(mean(sampleCounts)-tareRaw) /
   countsPerGram`. Re-tare an empty platform when needed and record the new offset
   and time; do not change scale factor by guessing. Recheck with the reference
   mass and record calibration versions. Check independently at several masses.

Driver references: [HX711 library calibration and tare](https://github.com/bogde/HX711),
[Adafruit TCS34725 raw channels, gain and integration](https://learn.adafruit.com/adafruit-color-sensors?view=all).

## Manual serial-log fallback (available now)

The fallback does not require a serial dependency or modify firmware. Once an
appropriate board-specific sketch/driver is confirmed, export actual captures
from its serial terminal into a UTF-8 JSONL file: **one complete REAL_SENSOR
payload per line**. Keep UTC timestamps and stable measurement IDs from the
original capture; do not relabel synthetic examples as real data. Store captures
and calibration files outside tracked source, e.g. under ignored `state/local-runtime`.

The calibration helper takes one JSON object containing `tareSamples`,
`referenceSamples`, `referenceMassGrams`, `tareAt`, `calibratedAt`,
`stabilityLimitGrams`, and a `version` label. All measurements/times must be real.
It writes a calibration object locally and never sends data to a backend:

```powershell
node server/tools/module02-sensor-import.mjs --calibrate --file path-to-your-actual-calibration.json
node server/tools/module02-sensor-import.mjs --file path-to-your-actual-captures.jsonl
```

The second command validates the entire file and defaults to DRY RUN. It does
not generate measurements. To submit, privately configure process variables
`MODULE02_IMPORT_DEVICE_ID` and `MODULE02_IMPORT_DEVICE_KEY` using your existing
registered device credentials, never a frontend variable or Python token. Ensure
the matching device is configured in the backend's existing Module 02 registry.
No live `.env` was edited by this implementation.

```powershell
node server/tools/module02-sensor-import.mjs --file path-to-your-actual-captures.jsonl --submit --confirm-real-source --backend http://127.0.0.1:5000
```

Submission only permits a loopback backend. That backend may use Atlas: **this
command deliberately writes real captures to its configured database**. Do not
use it with example/test data. Imports stop on the first error or duplicate;
earlier accepted rows remain saved, so inspect history before retrying.
The importer never prints credentials and never requests a model prediction.

Start the existing Node backend with `npm run start --workspace server` after
stopping its previous instance; start frontend with `npm run dev --workspace
client`. Model 02 retains its existing `ml-service/.venv` environment on port
8000; Model 01 remains on 8002. The sensor workflow itself requires no ML model.
View `/module-02`; turn demo mode off, select your registered sample, then use
the existing Refresh records button after importing. Automatic continuous device
polling is not claimed. A future Wi-Fi firmware sender must use the existing
device-authenticated API and backend LAN address, not the board's own localhost.

## Verification commands

Use only a dedicated local test database whose name ends in `module02_test`.
The new persistence tests refuse Atlas, remote hosts and ordinary database names.

```powershell
$env:MODULE02_TEST_MONGODB_URI='mongodb://127.0.0.1:27018/cinnasense_sensors_module02_test'
$env:MODULE02_E2E='1'
Push-Location server
node --env-file=.env --test --test-concurrency=1 --test-timeout=30000 test/real-sensors.test.js
npm test
npm run test:e2e
Pop-Location
npm test --workspace client
npm run build --workspace client
```

`--env-file=.env` is used for the server-only risk-service token in the live ML
test; the tests connect only to the independently guarded local test URI.
All fixtures are explicitly fabricated **test fixtures**, never claimed as
physical readings. Tests clean their own records; production Atlas is untouched.
No GPIO/wiring correctness, actual accuracy, load-cell stability, optical
calibration or physical sensor connection is established by software tests.

The new sensor test is invoked explicitly because shared package scripts were
left unchanged. Board-specific firmware compilation, upload and live acquisition
remain pending until the exact board/wiring are confirmed and hardware is connected.

## Verification report

- 100 automated tests passed, zero skipped: 26 frontend, 39 existing backend,
  10 sensor tests (including guarded local persistence and the real-ML manual-input
  workflow), 1 existing real-ML end-to-end workflow, 14 Python risk/price contract
  tests, and 10 Model 01 Python regressions.
- Frontend production build passed. Physical hardware and browser visual
  interaction were not tested; dashboard output was checked by rendering tests.
- Sensor HTTP tests exercised the real existing ingestion router with test-only
  credentials. MongoDB persistence and ML calls used guarded local test databases;
  no fixtures were written to Atlas. Local fixtures were cleaned afterward.
- Existing source-file hashes show only the Module 02 files below changed.
  Active weights and Python model implementations remain identical; all 503
  archival source files matched their preservation-manifest hashes.
- No dependencies, shared package scripts, shared startup, global routing/layout,
  shared authentication or other modules were changed. No commit or push.

**Existing configuration blocker:** a secret-safe parse check found
`MODULE02_DEVICE_KEYS` in `server/.env` is malformed JSON. It was not modified:
this is shared live configuration. Correct that single registry privately under
separate approval before attempting actual device authentication. The passing
tests use temporary valid test-only registries and do not establish that the
current deployed registry accepts devices. Restart the Node backend after the
configuration/code changes are reviewed to load the new schema and validators.

### Complete changed-file inventory (18 files)

Created:

- `client/src/components/Module02SensorPanel.jsx`
- `server/src/module02/realSensor.js`
- `server/tools/module02-sensor-import.mjs`
- `server/test/real-sensors.test.js`
- `server/MODULE02_REAL_SENSORS.md`

Modified:

- `client/src/components/RiskPredictionPanel.jsx`
- `client/src/components/TrendChart.jsx` (only used by Module 02)
- `client/src/pages/QualityDashboard.jsx`
- `client/src/pages/SampleDetails.jsx`
- `client/src/services/qualityService.js`
- `client/src/services/riskPredictionState.js`
- `client/src/styles/quality.css`
- `client/test/risk-render.test.js`
- `client/test/risk-state.test.js`
- `server/src/module02/models.js`
- `server/src/module02/validation.js`
- `server/src/module02-risk/model.js`
- `server/src/module02-risk/routes.js`

Shared `QualityUI.jsx` remains byte-identical. Its history component was replaced
only within Module 02 by a nullable-aware local component, preserving legacy
weight-change and gas-resistance columns alongside the new raw-count information.

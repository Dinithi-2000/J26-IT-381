# Phase 4.5: configuration and end-to-end verification

Completed 2026-10-21. No model implementation, trained artifact, React component,
existing API implementation, firmware or production record was modified.

## Configuration

Inspected `ml-service/.env`, `server/.env`, the Python risk authentication/loader
and the Node risk client without printing secret values. The existing Python
`RISK_SERVICE_TOKEN` was valid; Node's `MODULE02_RISK_SERVICE_TOKEN` was missing.
The existing secret was copied privately into Node's ignored `.env`, without
rotating it or changing Model 01 credentials. A constant-time comparison confirmed
that both values match.

Added missing Node settings using the current defaults:

```dotenv
MODULE02_RISK_SERVICE_URL=http://127.0.0.1:8000
MODULE02_RISK_TIMEOUT_MS=10000
MODULE02_RISK_MAX_READING_AGE_SECONDS=300
```

All unrelated environment values, including the Atlas connection URI, were
preserved. Restarted only Node on port 5000 so it loaded the new settings. Both
Python processes and the existing frontend were left running. The local `.env`
and the pre-change backup remain ignored by Git. No secret was written to React,
source code, documentation or a test log.

## Service and preservation checks

| Check | Result |
| --- | --- |
| Node `/api/health` | HTTP 200, Atlas connected |
| Model 01, `127.0.0.1:8002/health` | Ready, original class order/version |
| Model 01 real `CIN001_01.jpg` inference | `good_quality`, score `0.8355661034584045`; exactly matches Phase 1 |
| Model 02, authenticated `127.0.0.1:8000/risk/health` | Ready, `SYNTHETIC_DEMO`, null/unverified horizon |
| Existing price `/predict` | HTTP 200; `2026-10-21`, `Galle`, `Alba`: `4668.93310546875` LKR/kg, `xgb-v1` |
| Node image and price status proxies | Both HTTP 200 in the isolated workflow |
| Existing source/artifact checksums | 147 pre-existing files unchanged; only `server/package.json` changed for the new test command |

No image predictions were saved, reclassified or deleted during this verification.
The real-image check called Python directly, without MongoDB persistence.

## Real isolated MongoDB verification

No local MongoDB installation was available. Downloaded the official portable
MongoDB 8.0.30 ZIP, verified its SHA-256 against the publisher's checksum, and
extracted `mongod.exe` into the ignored runtime directory. No Windows service,
global dependency or system installation was created. The local instance used:

```text
Bind address: 127.0.0.1 only
Port: 27018
Database: cinnasense_phase45_module02_test
URI: mongodb://127.0.0.1:27018/cinnasense_phase45_module02_test
```

Source: [MongoDB's Windows ZIP instructions](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows-zip/).
The exact archive URL and checksum are recorded in the ignored
`mongo-portable/provenance.json` beside the binary.

The actual frontend `createQualityService` API client called an actual Express
application backed by this local database and the existing real Model 02 service.
Only the test process used this database and temporary operator/device credentials;
the running application on port 5000 continued using Atlas.

Verified, with explicitly labeled test fixtures restricted to the local test DB:

1. Operator-authenticated sample creation and actual MongoDB persistence.
2. Device-authenticated sensor ingestion and reading persistence.
3. Frontend client retrieval of samples, sample details and latest reading.
4. Authenticated Model 02 request using the stored reading ID, not browser sensor
   values. The real model returned `Medium`, stored as `moderate`.
5. Prediction persistence with an exact seven-feature snapshot, synthetic warning,
   unvalidated status and null/unverified horizon.
6. Authenticated history retrieval through the frontend client: one stored result.
7. First prediction HTTP 201; five retried requests HTTP 200, all returning the
   same record ID and unchanged timestamps. Database count remained exactly one.
8. Missing operator authentication rejected with HTTP 401.
9. Existing legacy `/api/module-02/predict` still returned its original HTTP 503
   `MODEL_UNAVAILABLE`; no legacy forecast record was inserted.
10. Existing image and price service proxy contracts remained healthy.

All isolated fixtures were cleaned by their own sample ID afterward. A database
count check confirmed that the isolated collections were empty. Production Atlas
sample, reading, synthetic-risk, forecast and image-condition collection counts
were read only; no test writes were sent to Atlas. The production sample and
sensor collections are still empty, so the real dashboard correctly shows no
physical sample measurements yet.

After verification, the temporary MongoDB was shut down. The downloaded ZIP was
removed to free disk space; the verified portable binary, empty test data directory,
logs and checksum provenance remain locally for reruns. The application backend,
frontend and both ML services remain running.

This is a real frontend-API/Node/ML/MongoDB integration test, not mocked persistence.
It does not constitute a browser click-through, real hardware measurement or
scientific model-validation test. Existing React rendering/state tests complement
the API workflow test.

## Regression results

| Suite | Passed | Skipped |
| --- | ---: | ---: |
| Frontend rendering, API and request-state tests | 19 | 0 |
| Existing backend suite, including both formerly skipped MongoDB tests | 39 | 0 |
| New real-ML isolated end-to-end workflow | 1 | 0 |
| Model 01 Python regressions | 10 | 0 |
| Model 02 and price Python contract tests | 14 | 0 |
| **Total** | **83** | **0** |

The existing non-failing Model 01 Starlette/httpx deprecation warning remains.
No dependency was upgraded or downgraded.

## Registering a real cinnamon sample

Use `/module-02/samples` in the existing React application, or operator-authenticated
`POST /api/samples`. Required JSON fields are:

| Field | Supply from the actual research sample |
| --- | --- |
| `sampleId` | Unique 2–64-character ID: letters, digits, hyphens or underscores |
| `batchId` | Actual batch identifier |
| `grade` | Actual description/grade |
| `storage` | Actual container/storage description |
| `storageStartDate` | Actual ISO date or timestamp with timezone |
| `initialWeightGrams` | Measured starting weight, >0 and <=10000 grams |

Send `Authorization: Bearer <existing operator token>`. Registration creates only
a sample record, not measurements or predictions. Do not copy isolated test
fixture values into production. No real sample was registered on your behalf
because actual sample metadata and baseline measurements were not provided.

After a genuine reading arrives through `POST /api/module-02/readings`, select the
sample in `/module-02/predictions`, enter the operator token and explicitly request
a risk result. React sends only `{sampleId, readingId}` to Node. Model 01 remains
separate at `/module-02/images`.

## Re-running the isolated tests

The portable binary/data directory is recorded under the directory referenced by
`state/local-runtime/phase45-verification-path.txt`. To start it again in a separate
PowerShell terminal from the repository root:

```powershell
$verification = Get-Content state/local-runtime/phase45-verification-path.txt
$mongo = Join-Path $verification 'mongo-portable'
& (Join-Path $mongo 'mongod.exe') --bind_ip 127.0.0.1 --port 27018 --dbpath (Join-Path $mongo 'data') --logpath (Join-Path $mongo 'mongod.log') --logappend
```

Keep the real Model 02 and Model 01 services running, then use another terminal:

```powershell
$env:MODULE02_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27018/cinnasense_phase45_module02_test'
npm test --workspace server
$env:MODULE02_E2E = '1'
npm run test:e2e --workspace server
npm test --workspace client
```

The new end-to-end test is opt-in and skipped without both flags. It refuses
nonlocal/SRV URIs, normal database names and URI query overrides. It never uses
`MONGODB_URI` to choose its test database and never drops a database. Temporary
test environment values do not change `server/.env` or the running Atlas backend.

## Requirements before ESP32-S3 work

- Register the real sample, storage start and measured baseline weight.
- Agree sensor wiring and calibrate the load cell/HX711, RGB sensor and
  environmental/gas-resistance readings against the research protocol.
- Provision a device ID and a separate strong device key in the backend registry;
  never put operator or Python service tokens in firmware.
- Synchronize device UTC time; send correct sample/measurement IDs and units.
  Risk requests reject future readings, zero weight and stale data (default
  300-second limit); unique measurement IDs support ingestion retries.
- Verify real hardware connectivity, ingestion, freshness and power/network
  recovery in an approved hardware phase. No firmware was written here.
- Model 02 remains trained on synthetic data and scientifically unvalidated.
  Confirm training-day semantics and collect real labeled research data before
  scientific use. Its horizon is still unknown; no seven-day forecast is claimed.
- Physical ESP32-CAM capture was not tested here. Model 01's image-file inference
  and its camera API regressions passed, but powered-camera connectivity remains
  a separate physical check.

## Changed files and local evidence

- Updated ignored `server/.env`: matching server-only risk token and defaults.
- Updated `server/package.json`: added the opt-in `test:e2e` command.
- Added `server/test/risk-e2e.integration.test.js`.
- Added this report.

Local, ignored evidence includes the protected source/artifact checksum manifest,
the pre-change environment backup, `verification-results.json`,
`database-verification.json` and portable MongoDB provenance/log files. The runtime
directory is referenced by `state/local-runtime/phase45-verification-path.txt`.
Secrets are omitted from reports and logs.

No commit or push was made. Stop after Phase 4.5; ESP32 firmware and Phase 5
require separate approval.

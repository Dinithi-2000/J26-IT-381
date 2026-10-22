# Phase 4: React Model 02 risk workspace

Open `/module-02/predictions` for the new **Storage Deterioration Risk** panel.
Model 01 stays at `/module-02/images`, with its existing image upload, camera
controls, classification results and history unchanged. Other module routes and
the original forecast-history API remain intact.

## Backend checks before React changes

- Started the existing Node backend on port 5000; `/api/health` returned HTTP 200
  and `database: connected`.
- Inspected `server/MODULE02_RISK_API.md` and the actual risk routes. Both new
  routes require the existing operator bearer token. Missing and wrong tokens
  returned HTTP 401. A valid token reached sample validation (HTTP 404 for an
  unregistered sample).
- Confirmed the history contract from the implementation and regression tests:
  `{data: [...], pagination: {page, limit, total, pages}}`.
- Read-only Atlas metadata checks confirmed that the synthetic-risk collection
  exists and the current database user has insert privilege. **No write probe or
  demonstration record was inserted.** Permissions are not proof of successful
  application persistence.
- No registered samples were present during verification. There was therefore no
  real sample/reading pair for a live risk/history workflow.
- `MODULE02_RISK_SERVICE_TOKEN` is not configured in the actual `server/.env`.
  The frontend now handles the backend's explicit configuration error. No server
  file or secret was changed in Phase 4.
- No dedicated local test URI or MongoDB/Docker executable was available. The
  two optional MongoDB integration tests remain skipped. Frontend behavior was
  tested with mocked API data only, never production Atlas writes.

## Added interface

The panel shows sample ID, latest stored temperature, relative humidity, weight,
RGB values, completed storage days and the reading timestamp/ID. Stored telemetry
is labeled as stored data, not a live stream. It distinguishes recent, stale,
future, missing and invalid readings.

An explicit **Request risk prediction** button sends the selected sample and the
actual stored reading ID. No request is generated on refresh, token entry, sample
selection or history loading. Demo mode does not fetch real readings/history or
request a prediction. Missing/invalid/future readings disable prediction. Stale
readings carry a warning: the backend may return an existing result, but rejects
new inference when the reading exceeds its configured risk age limit.

The result displays `Low Risk`, `Medium Risk` or `High Risk`, model version,
prediction timestamp, reading reference, saved model inputs, null/unverified
horizon and unvalidated status. The exact prominent disclaimer is:

> Storage Deterioration Risk (Synthetic Demo). Predictions are based on synthetic training data and are not validated for real-world cinnamon safety or quality assessment.

There are no Model 02 confidence percentages or fixed forecast-horizon claims.
The old planning-horizon placeholder selector was removed. Existing forecast
records remain visible in a separate section; their historical horizons are not
presented as Model 02 metadata.

Risk history is authenticated and paginated (12 rows per page). Duplicate returned
record IDs are displayed once. A stored result for an older reading is explicitly
distinguished from the latest sensor values. Failed history refreshes do not erase
a successfully confirmed POST result. Buttons, loading skeletons, status/alert
messages, empty states, focus indicators and responsive card layouts follow the
existing design system.

## API and authentication

`createQualityService` now exposes two methods through its existing authenticated
JSON request utility:

| Method | Backend request |
| --- | --- |
| `createRiskPrediction(sampleId, readingId, token, options)` | `POST /api/module-02/risk-predictions`, JSON `{sampleId, readingId}` |
| `getRiskPredictions(sampleId, token, page, options)` | `GET /api/module-02/samples/:sampleId/risk-predictions?page=N&limit=12` |

Both send `Authorization: Bearer <operator token>` to Node through Vite's `/api`
proxy. The frontend does not call either Python service or receive its service
token. It follows the existing operator-token form convention: password input,
component memory only, no local/session storage, no hard-coded credentials.
Changing credentials clears authenticated results/history. Cancellation and
request-generation checks prevent late responses from displaying under another
sample, demo session or credential state.

The small `createRiskWorkspace` external store separates async behavior from
rendering. It never calculates risk; it validates backend labels and provenance
before showing saved records. Duplicate button clicks during an active request
are suppressed; retries use the same sample/reading identifiers so the backend's
unique-key protection remains effective. HTTP failures never cause demo fallback.

The existing sample normalizer now also preserves the full original storage
timestamp as `storageStartTimestamp`. Existing date-only presentation remains
unchanged. The panel uses the complete timestamp to calculate completed UTC
24-hour periods at reading time. **This day definition remains a prototype
assumption until training metadata confirms it.** The backend recalculates all
seven features from its own stored records; React sends no sensor values.

## Run locally

From the repository root, use separate terminals for these processes. Existing
processes may already occupy the ports; do not start duplicates.

```powershell
# Model 01: preserve its original working interpreter/environment
& 'C:\Program Files\Python313\python.exe' -m uvicorn cinnasense_quality.api:app --app-dir ml-module02/src --host 127.0.0.1 --port 8002
```

```powershell
# Model 02 plus the unchanged price service, scikit-learn 1.6.1 environment
cd ml-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Repository root: Node backend
npm run dev --workspace server
```

```powershell
# Repository root: React frontend
npm run dev --workspace client
```

Visit `http://localhost:5173/module-02/predictions`. Use `npm run build --workspace
client` for the production build. No dependencies were added in this phase.

Before a real risk workflow, an operator must configure the **server-only**
`MODULE02_RISK_SERVICE_TOKEN` to match Python's `RISK_SERVICE_TOKEN` and restart
Node (see `server/.env.example`). Do not place this secret in a `VITE_` variable.
Register actual research samples through the existing sample-management flow and
use genuine stored readings from existing authenticated ingestion. Then select
the sample, enter the operator token, load history or explicitly request risk.
Do not fabricate production samples/readings to demonstrate the feature.

## Tests and remaining limitations

```powershell
npm test --workspace client
npm run build --workspace client
npm test --workspace server

$env:PYTHONPATH = 'ml-module02/src'
$env:PYTHONDONTWRITEBYTECODE = '1'
python -m unittest discover -s ml-module02/tests -p test_camera_integration.py -v

$env:PYTHONPATH = 'ml-service'
ml-service/.venv/Scripts/python.exe -m unittest discover -s ml-service/tests -p 'test_risk_*.py' -v
```

Verified results:

- 19 frontend tests passed: request/auth contracts, all risk categories and
  mapping, synthetic disclaimer, no confidence/fixed-horizon claims, missing
  readings, errors, history, duplicate responses, explicit-only prediction,
  in-flight state, cancellation and sample/credential changes. React render tests
  include Model 01's current upload/camera/history UI and existing module routes.
- Frontend production build passed.
- Backend: 37 passed, 2 optional real MongoDB tests skipped.
- Python: 10 Model 01 tests and 14 Model 02/price contract tests passed.
- Model 01 real image `CIN001_01.jpg` still returned `good_quality`, score
  `0.8355661034584045`, exactly matching the Phase 1 baseline.
- Both Python health endpoints responded successfully; price service remained
  healthy as `xgb-v1`.

Render tests use React server rendering through Vite's existing JSX loader;
interaction/request-state tests exercise the controller with mocked APIs. Layout
breakpoints, focus and wrapping rules were checked structurally. This is not a
full browser/device accessibility or end-to-end persistence test. No new testing
dependencies were installed. The existing non-failing Model 01 Starlette/httpx
deprecation warning remains.

Real MongoDB prediction persistence is **not verified**. Atlas privileges are
confirmed, but an actual isolated database test remains necessary. Live risk
workflows also require server token configuration and a real sample/reading.
Model 02 is still synthetic/unvalidated with unknown horizon/training semantics;
the physical camera was not retested in this frontend phase.

ESP32-S3 integration remains separate: sensor wiring/calibration, real measurement
capture, device credentials, correct sample/measurement IDs and UTC timestamps,
authenticated ingestion, network retries and real-data freshness verification.
No firmware or hardware integration is implemented here.

## Files in this phase

Created: `src/components/RiskPredictionPanel.jsx`,
`src/services/riskPredictionState.js`, `test/risk-state.test.js`,
`test/risk-render.test.js`, and this guide.

Modified: `src/services/qualityService.js`, `src/pages/QualityPredictions.jsx`,
`src/pages/QualityDashboard.jsx`, `src/styles/quality.css`, `package.json`.

Model 01 UI/service files, backend code, Python implementations, trained
artifacts, image history and firmware were not modified. Pre-existing uncommitted
work is preserved. The ignored snapshot/checksum manifest is referenced by
`state/local-runtime/phase4-backup-path.txt`; the original uncommitted diff is in
`state/local-runtime/phase4-uncommitted.patch`. No commit or push was made.
Stop after Phase 4; Phase 5 requires separate approval.

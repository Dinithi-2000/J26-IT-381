# Phase 2: verified ML contracts and proposed backend integration

Verified locally on 2026-10-21. This phase adds documentation and a read-only
HTTP verification script only. No service implementation, dependency, environment,
Node.js, MongoDB, React or firmware changes are included. Existing uncommitted
work is preserved. No commits or pushes were made.

## Verification results

| Check | Result |
| --- | --- |
| Simultaneous Model 01 and Model 02 health | 3 concurrent rounds, both HTTP 200 |
| Simultaneous real-image and risk inference | Both HTTP 200 |
| Model 01 real image `CIN001_01.jpg` | `good_quality`, score `0.8355661034584045`; exactly matches Phase 1 |
| Model 02 three valid demonstration payloads | `Medium`, `Low`, `High`, respectively; HTTP 200 |
| Model 02 ten invalid payloads | All HTTP 422, no prediction returned |
| Both prediction routes without authentication | HTTP 401 |
| Model 01 Python regressions | 10 passed |
| Model 02 Python regressions, including price API contract | 14 passed |
| Existing Node image API regressions | 7 passed; mocked persistence |
| Both Python environments: `pip check` | No broken requirements found |
| Existing price service `/health` on 8000 | HTTP 200, `xgb-v1` |
| Physical camera `/camera/status` | HTTP 502, `CAMERA_UNREACHABLE` |

The ten invalid cases cover missing and extra fields, numeric strings, booleans,
fractional/negative storage days, excessive humidity, zero weight, excessive RGB,
and NaN. Invalid-input handling does not fabricate a fallback result.

Machine-readable requests, responses, artifact hashes and timestamps are stored
locally in `state/local-runtime/phase2-verification/results.json` (ignored by Git).
The verifier reads secrets without recording them and calls Python services
directly; it never calls a database persistence endpoint.

## Startup and compatible environments

Both services are already running. For a future restart, use separate terminals;
do not start a second process on an occupied port.

Model 01, from the repository root, using its unchanged existing interpreter:

```powershell
& 'C:\Program Files\Python313\python.exe' -m uvicorn cinnasense_quality.api:app --app-dir ml-module02/src --host 127.0.0.1 --port 8002
```

Model 02, from `ml-service`, using its dedicated virtual environment:

```powershell
cd ml-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Process inspection confirmed these interpreter commands. On Windows the virtual
environment may also show a child process using the base executable; its command
line still selects `ml-service/.venv`. No process was restarted in Phase 2.

| Runtime | Verified installed versions |
| --- | --- |
| Model 01, Python 3.13.5 | TensorFlow 2.21.0, Keras 3.15.1, NumPy 2.3.2, Pillow 13.0.0, FastAPI 0.151.0, Uvicorn 0.54.0 |
| Model 02, Python 3.13.5, `ml-service/.venv` | scikit-learn **1.6.1**, joblib 1.6.0, pandas 2.2.3, NumPy 2.5.4, FastAPI 0.115.12, Uvicorn 0.34.0, XGBoost 3.0.0 |

The global environment has scikit-learn 1.9.1. Do not run Model 02 with that
environment or downgrade the Model 01 environment. The risk loader rejects a
scikit-learn version other than 1.6.1.

Model 01's existing `pyproject.toml` optional extras specify Pillow `<13`, while
its working interpreter currently has 13.0.0. This is a reproducibility mismatch,
despite passing inference/tests and `pip check` (extras are not necessarily
installed as active package requirements). Preserve the current working runtime;
resolve the declared-environment mismatch separately before a fresh deployment.
The Model 01 test client also emits a non-failing Starlette/httpx deprecation
warning. No dependencies were changed to address either item in this phase.

## Model 01: image condition classifier

Base URL: `http://127.0.0.1:8002`.

| Method | Path | Authentication | Request | Success response |
| --- | --- | --- | --- | --- |
| GET | `/health` | None | No body | Health JSON below |
| POST | `/classify` | `X-Quality-Service-Token` | Raw JPEG/PNG bytes; **not multipart** | Classification JSON below |
| GET | `/camera/status` | Same token | No body | Camera status JSON below |
| GET | `/camera/capture` | Same token | No body | Binary `image/jpeg` |
| POST | `/classify/camera` | Same token | No body | Classification JSON, source `esp32_cam`, plus `capturedAt` |

Token: the `MODULE02_IMAGE_SERVICE_TOKEN` value in `ml-module02/.env`, at least
32 characters. Existing Node configuration uses `MODULE02_IMAGE_SERVICE_URL`
(default `http://127.0.0.1:8002`) and the same token. Never expose it to React.

`POST /classify` requires `Content-Type: image/jpeg` or `image/png`. Optional
`X-Image-Source` is `manual_upload` (default) or `esp32_cam`. It labels source;
it does not cause a camera capture. The body limit is 5 MiB, with a maximum of
20,000,000 decoded pixels and a valid JPEG/PNG format.

Unchanged preprocessing: verify image, apply EXIF orientation, convert to RGB,
resize bilinearly to 224 x 224, cast to float32, shape `(1,224,224,3)`, preserve
raw `[0,255]` values. Normalization is embedded in the trained artifact. Node
must forward image bytes without introducing additional preprocessing.

Successful health JSON:

```json
{"status":"ready","prototype":true,"modelVersion":"mobilenetv2-5ef47ee59f34","classes":["Suspected Mold","good_quality"]}
```

Successful classification JSON (all fields shown; timestamp is illustrative):

```json
{
  "predictedCondition": "good_quality",
  "modelScore": 0.8355661034584045,
  "scores": {"Suspected Mold": 0.16443395614624023, "good_quality": 0.8355661034584045},
  "modelVersion": "mobilenetv2-5ef47ee59f34",
  "prototype": true,
  "scoreInterpretation": "Uncalibrated model score; not a verified probability of mold.",
  "limitations": "Visual prototype only. Suspected Mold requires independent confirmation. This is not food-safety certification or future degradation prediction.",
  "predicted_class": "good_quality",
  "score": 0.8355661034584045,
  "class_scores": {"Suspected Mold": 0.16443395614624023, "good_quality": 0.8355661034584045},
  "source": "manual_upload",
  "analyzedAt": "2026-10-21T01:58:36.109636+00:00"
}
```

`predictedCondition`/`predicted_class` preserve the exact trained labels.
`score` aliases `modelScore`, and `class_scores` aliases `scores`; scores are
finite numbers in [0,1] summing to approximately 1, not calibrated safety
probabilities. Timestamps are ISO-8601 UTC strings. Camera classification adds
`capturedAt` and sets `source: "esp32_cam"`.

Camera status success schema:
`{status:"connected",source:"esp32_cam",checkedAt:<UTC timestamp>,message:<string>}`.
Capture success returns JPEG bytes with `Cache-Control: no-store` and
`X-Captured-At: <UTC timestamp>`. The camera URL comes only from Python
`ESP32_CAM_URL`; no browser-supplied URL is accepted. These three camera routes
are contract-tested with fixtures, but successful physical capture was **not**
verified in Phase 2 because the current camera is unreachable.

Errors generally use `{"detail":{"code":"...","message":"..."}}`:
401 `UNAUTHORIZED`; 503 `AUTH_UNCONFIGURED`/`MODEL_UNAVAILABLE`;
400 `INVALID_IMAGE`; 413 `UPLOAD_TOO_LARGE`; 415 `INVALID_IMAGE` for unsupported
content type. Invalid `X-Image-Source` produces FastAPI's 422 `detail` array.
Unavailable health is a top-level JSON object with `status`, `code`, `reason`
and `message`, HTTP 503. Camera errors include 503 `CAMERA_NOT_CONFIGURED`,
502 `CAMERA_UNREACHABLE`/`CAMERA_INVALID_RESPONSE`/`CAMERA_INVALID_IMAGE`,
413 `CAMERA_IMAGE_TOO_LARGE`, or 504 `CAMERA_TIMEOUT`.

## Model 02: synthetic storage deterioration risk

Base URL: `http://127.0.0.1:8000` (shared with the existing price service).

| Method | Path | Authentication | Request | Success response |
| --- | --- | --- | --- | --- |
| GET | `/risk/health` | `X-Risk-Service-Token` | No body | Risk health JSON below |
| POST | `/predict-risk` | Same token | `application/json`, seven fields below | Risk prediction JSON below |

Token: separate `RISK_SERVICE_TOKEN` in `ml-service/.env`, at least 32 characters.
Do not reuse the Model 01, device or operator token. `/health` on port 8000 checks
the **price model**, not Model 02; use `/risk/health` for risk readiness.

All request fields are required, numbers must be finite, and extra keys are
forbidden. Numeric strings and booleans are rejected. These limits are API
validation bounds, not validated scientific operating ranges.

| Field (in trained feature order) | JSON type | Bounds / unit |
| --- | --- | --- |
| `storage_day` | integer | 0..3650, days |
| `temperature_c` | number | -40..85, Celsius |
| `humidity_percent` | number | 0..100, percent |
| `weight_g` | number | >0 and <=10000, grams |
| `color_r` | number | 0..255 |
| `color_g` | number | 0..255 |
| `color_b` | number | 0..255 |

Example demonstration request:

```json
{"storage_day":5,"temperature_c":30.5,"humidity_percent":76.0,"weight_g":98.2,"color_r":145,"color_g":90,"color_b":50}
```

Exact successful response fields (timestamp illustrative):

```json
{
  "model": "CinnaSense Model 02",
  "title": "Storage Deterioration Risk (Synthetic Demo)",
  "model_version": "random-forest-demo-6ff77e1d306f",
  "predicted_risk": "Medium",
  "prediction_horizon_days": null,
  "prediction_horizon_verified": false,
  "horizon_note": "No prediction horizon metadata is present. This output is not a verified seven-day forecast.",
  "data_origin": "SYNTHETIC_DEMO",
  "validated_for_real_world_use": false,
  "warning": "Demonstration risk prediction based on synthetic training data. Not validated for real-world cinnamon safety or quality assessment.",
  "predicted_at": "2026-10-21T01:58:35.940662+00:00"
}
```

`predicted_risk` is exactly `Low`, `Medium` or `High`; other categories must be
rejected by the future Node adapter. There is no confidence/probability field.
The synthetic label describes the model's training provenance even if real
sensor values are supplied. It must never become a claim of validated safety.

Risk health returns `status:"ready"`, `model`, `title`, `model_version`,
`features` (the seven names in the table's order), `classes:["High","Low","Medium"]`
(trained class order), `prediction_horizon_days:null`,
`prediction_horizon_verified:false`, `data_origin:"SYNTHETIC_DEMO"`,
`validated_for_real_world_use:false` and the same `warning` string.

Errors:

- HTTP 422: `{"error":{"code":"RISK_VALIDATION_ERROR","message":"Provide all seven finite numeric features within the documented ranges."},"detail":[{"loc":["body","humidity_percent"],"type":"less_than_equal","msg":"Input should be less than or equal to 100"}]}`.
  Location/type/message vary by invalid field; raw inputs and credentials are not echoed.
- HTTP 401: `{"detail":{"code":"UNAUTHORIZED","message":"A valid risk service token is required."}}`.
- HTTP 503: `{"detail":{"code":<code>,"message":<string>}}`; codes include
  `RISK_AUTH_UNCONFIGURED`, `RISK_MODEL_UNAVAILABLE`,
  `RISK_MODEL_CHECKSUM_MISMATCH`, `RISK_RUNTIME_INCOMPATIBLE`,
  `RISK_MODEL_METADATA_INVALID`, `RISK_INFERENCE_FAILED`.

The artifact has no horizon metadata, and the named training notebook was not
found in Phase 1's checked locations. Do not add `horizonDays:7`, translate
storage age into forecast duration, or invent missing training evidence.

## Health checks and API examples

PowerShell, using process-local environment variables containing the appropriate
local secrets (do not paste secrets into source files or logs):

```powershell
Invoke-RestMethod http://127.0.0.1:8002/health
$imageHeaders = @{ 'X-Quality-Service-Token' = $env:MODULE02_IMAGE_SERVICE_TOKEN }
Invoke-RestMethod http://127.0.0.1:8002/classify -Method Post -Headers $imageHeaders -ContentType 'image/jpeg' -InFile 'C:\path\to\cinnamon.jpg'

$riskHeaders = @{ 'X-Risk-Service-Token' = $env:RISK_SERVICE_TOKEN }
Invoke-RestMethod http://127.0.0.1:8000/risk/health -Headers $riskHeaders
$body = @{ storage_day=5; temperature_c=30.5; humidity_percent=76.0; weight_g=98.2; color_r=145; color_g=90; color_b=50 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/predict-risk -Method Post -Headers $riskHeaders -ContentType 'application/json' -Body $body
```

Python loads `.env` itself; PowerShell does not automatically export its contents
as `$env:` values. Set those process-local variables privately before these manual
examples, or use the verifier, which reads local `.env` files directly:

```powershell
ml-service/.venv/Scripts/python.exe ml-service/tools/verify_phase2.py --image 'C:\path\to\CIN001_01.jpg'
# Optional read-only physical camera check:
ml-service/.venv/Scripts/python.exe ml-service/tools/verify_phase2.py --image 'C:\path\to\CIN001_01.jpg' --check-camera
```

Use the same baseline image for the comparison, not a different cinnamon photo.
Both apps expose `/docs` and `/openapi.json`. Model 01 uses raw request bodies and
dictionary responses, so its generated OpenAPI does not fully describe the image
body/response fields; the source-verified contract above is needed by Node.

## Existing Node boundaries (inspection only)

`server/src/server.js` mounts `createModule02Router` at `/api` and the independent
image router at `/api/module-02/image-classification`.

- `POST /api/module-02/readings`: device-authenticated ingestion;
  `GET /api/module-02/readings/latest?sampleId=...` and
  `GET /api/module-02/samples/:sampleId/readings`: stored input sources.
- `POST /api/module-02/predict`: operator bearer authentication, currently accepts
  `{sampleId,horizonDays}`, validates sample and integer horizon 1..365, then
  returns HTTP 503 `MODEL_UNAVAILABLE`. It does not call Model 02.
- `GET /api/module-02/samples/:sampleId/predictions`: existing forecast history.
- `server/src/module02/predictionStore.js` requires a real `horizonDays` and
  `riskCategory` in `low/moderate/high`, with same-sample reading/image references.
- `server/src/module02/models.js` also requires a non-null horizon in
  `module02_degradation_predictions`. It cannot store this horizon-free output
  as-is. Do not insert a fabricated horizon to satisfy the schema.
- `server/src/module02-image/service.js` already forwards to Model 01 using its
  own token and validates scores/classes. Leave this working path unchanged.

## Proposed Phase 3 plan (not implemented)

1. Add a separate Node risk client, leaving the price and Model 01 clients intact.
   Proposed configuration: `MODULE02_RISK_SERVICE_URL=http://127.0.0.1:8000` and
   a server-only `MODULE02_RISK_SERVICE_TOKEN` matching Python's
   `RISK_SERVICE_TOKEN`. Use a bounded timeout and sanitize upstream errors.
2. Add an operator-authenticated `POST /api/module-02/risk-predictions` with
   `{sampleId,readingId}`. Load an existing, non-archived sample and an explicit
   same-sample reading; reject missing, invalid, future or stale measurements.
   Do not accept browser-generated predictions, fallback sensor values or a
   requested forecast horizon. Preserve the existing `/predict` contract.
3. Map the stored reading into the seven-feature request using the table below.
   Proposed storage age is completed 24-hour periods between `storageStartDate`
   and the reading's `recordedAt` (UTC), not the time the button is clicked.
   Reject dates before storage and values outside Model 02 bounds, including
   zero weight (currently accepted by sensor ingestion). Day derivation remains
   a documented synthetic-prototype assumption until the training notebook is
   available. Preserve RGB scale; do not normalize it.
4. Validate the complete upstream contract: category, version, timestamp,
   `SYNTHETIC_DEMO`, unvalidated flag, synthetic title/warning, and null/unverified
   horizon. Map `Low -> low`, `Medium -> moderate`, `High -> high` explicitly.
   Never substitute an output after a timeout or invalid response.
5. Proposed persistence: a **separate** `module02_synthetic_risk_predictions`
   collection/schema containing sample/reading reference, exact input snapshot,
   raw and mapped category, model version, upstream and server timestamps,
   synthetic provenance, validation flag, warning and null/unverified horizon.
   Add separate history retrieval. Preserve all existing forecast documents and
   `low/moderate/high` enums; no migration or rewriting of historical records.
   Finalize this storage design during Phase 3 approval before implementation.
6. Add tests using mocked ML responses and a dedicated test database only where
   persistence checks are needed: mapping of all three labels, provenance,
   missing/stale/cross-sample readings, horizon rejection, unavailable ML/DB,
   no fabricated results and Model 01/price regressions. Keep React and firmware
   changes outside this backend step unless separately approved.

| Model 02 feature | Proposed backend source |
| --- | --- |
| `storage_day` | completed UTC 24-hour periods from sample storage start to reading timestamp |
| `temperature_c` | `SensorReading.temperatureC` |
| `humidity_percent` | `SensorReading.relativeHumidityPercent` |
| `weight_g` | `SensorReading.weightGrams` |
| `color_r` / `color_g` / `color_b` | `SensorReading.red` / `green` / `blue` |

Gas resistance, image classifications, weight-change percentages and defect
scores are **not inputs** to the supplied seven-feature Model 02 artifact.
Keep their monitoring functions independent; do not append invented features.

Remaining limitations: synthetic/unvalidated Model 02; unverified forecast
horizon and training-day semantics; unavailable physical camera; Model 01's
existing dependency declaration mismatch. Node-to-Model-02 calls and persistence
are proposed only and have not been implemented or tested end to end.

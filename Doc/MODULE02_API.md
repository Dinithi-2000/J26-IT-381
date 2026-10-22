# Module 02 storage-quality API

Module 02 concerns **stored cinnamon quality degradation**, not drying. React/Vite calls the existing Express/Mongoose server through Vite's `/api` proxy. Module 04 routes, `Prediction` model, price ML client and Python FastAPI service are preserved. No ESP32 firmware or trained degradation model is supplied.

## Local setup (PowerShell, repository root)

```powershell
npm install
Copy-Item server/.env.example server/.env
# Generate a secret; run twice for distinct operator and device secrets.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Edit `server/.env`: set `MONGODB_URI` to your local/Atlas database, `MODULE02_OPERATOR_TOKEN` to one generated secret and `MODULE02_DEVICE_KEYS` to a JSON object mapping device IDs to separate generated secrets, for example `{"ESP32-S3-01":"REPLACE_WITH_RANDOM_SECRET","ESP32-CAM-01":"ANOTHER_RANDOM_SECRET"}`. Keys must be at least 32 characters. Do not use placeholder values. `.env` and local uploaded files are ignored by Git. No credentials go into Vite variables.

Start MongoDB separately, then:

```powershell
npm run dev
```

Open http://localhost:5173/module-02. Express runs on port 5000. Register a sample using the operator token in the form; the form holds it only in memory. Demo mode is explicitly opt-in and uses separate synthetic in-memory samples. Refresh data after device ingestion using **Check availability again** when an error/empty state is visible or the **Refresh records** button in the workspace. Data is read on mount, sample selection and refresh, not via continuous device polling.

Module 04 additionally needs its original Python dependencies/model files:

```powershell
python -m pip install -r ml-service/requirements.txt
Copy-Item ml-service/.env.example ml-service/.env
Push-Location ml-service
python -m uvicorn app.main:app --reload --port 8000
Pop-Location
```

This starts the existing FastAPI service on port 8000. No changes were made to its model or code.

## Authentication and deployment boundary

- Sample POST/PATCH/DELETE and prediction POST: `Authorization: Bearer <MODULE02_OPERATOR_TOKEN>`.
- Telemetry and image POST: `X-Device-Id` plus `X-Device-Key`; the key registry binds each secret to one ID. Telemetry `deviceId` must match the header. Rotate secrets by updating the environment and restarting.
- Missing configuration rejects writes; invalid credentials return 401 (invalid/missing ID can return 400). Key material is compared through fixed-length hashes using constant-time comparison.
- There is **no user-account login, per-user authorization or device enrollment UI**. GET endpoints and image URLs are public to API clients. This is a local research API; put user authorization and HTTPS in front of it before public deployment. CORS restricts browser origins to `CLIENT_URL`, not nonbrowser access.
- Existing Module 04 authentication behavior is unchanged.
- JSON uses Express's 100 KB limit; images accept at most 5 MiB. Image MIME type and binary signature must match JPEG/PNG. This is format screening, not full decoding or malware scanning. No SVG/HTML uploads.
- Images use generated UUID names under `server/storage/module02`, not client filenames or document base64. Only validated MongoDB IDs resolve downloads. Image file URLs have `nosniff` via Helmet. Set `MODULE02_UPLOAD_DIR` to a persistent volume for deployment and back it up together with metadata. Database failure after writing a file triggers file cleanup; a process crash can still leave an orphan file. Local disk is suitable for single-server development, not distributed storage.

## Responses and pagination

Single resources return a JSON object; history/list endpoints return:

```json
{"data":[],"pagination":{"page":1,"limit":50,"total":0,"pages":0}}
```

`page` starts at 1; default `limit=50`, maximum 200. Histories accept ISO `from`/`to` inclusive timestamps. Use explicit timezone offsets or UTC `Z`; a date-only `to` means midnight, not the end of that date. Histories are newest first; reading history additionally accepts `order=asc` for the original baseline. Paging uses stable timestamp and MongoDB ID ordering; concurrent insertions can shift offset pages.

Errors: `{"error":{"code":"VALIDATION_ERROR","message":"..."}}`.
Status codes: 201 created; 200 read/update/archive; 400 invalid input; 401 unauthorized; 403 device mismatch; 404 unknown sample/image; 409 duplicate or archived sample; 413 oversized request; 415 unsupported image; 503 database/model/auth configuration unavailable. Database/server exceptions do not expose credentials.

## Endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/samples` | Register unique immutable `sampleId`; operator token |
| GET | `/api/samples` | Active samples; `batchId`, pagination; `archived=true` includes archived |
| GET | `/api/samples/:sampleId` | Sample including archive state |
| PATCH | `/api/samples/:sampleId` | Update allowed metadata; ID cannot change; operator token |
| DELETE | `/api/samples/:sampleId` | Idempotent archive; retains readings/images/predictions; operator token |
| POST | `/api/module-02/readings` | Authenticated device JSON ingestion |
| GET | `/api/module-02/readings/latest?sampleId=CIN-001` | Latest reading and reading-age device status |
| GET | `/api/module-02/samples/:sampleId/readings` | Paginated reading history with `from`, `to`, `order` |
| POST | `/api/module-02/images` | Authenticated binary JPEG/PNG upload; metadata in query |
| GET | `/api/module-02/samples/:sampleId/images` | Paginated metadata with same-origin image URLs |
| GET | `/api/module-02/images/:imageId/file` | Retrieve stored image bytes |
| GET | `/api/module-02/samples/:sampleId/predictions` | Paginated stored model outputs; no fabricated results |
| POST | `/api/module-02/predict` | Validate sample/horizon, then return 503 `MODEL_UNAVAILABLE`; operator token |

Sample creation body:

```json
{"sampleId":"CIN-001","batchId":"BATCH-A","grade":"Alba quills","storage":"Sealed glass container","storageStartDate":"2026-10-18","initialWeightGrams":250}
```

PATCH accepts any nonempty subset except sampleId. Archived samples cannot be updated or receive new readings/images. IDs use 2?64 ASCII letters, digits, hyphens or underscores and are case-sensitive. Text is trimmed and disallows control characters and angle brackets. Unknown fields and MongoDB operator objects are rejected. Initial weight is 0.01?10000 g.

Telemetry body (use a timestamp on/after sample storage start and no more than five minutes in the future):

```json
{
  "sampleId":"CIN-001",
  "deviceId":"ESP32-S3-01",
  "measurementId":"reading-000001",
  "weightGrams":249.5,
  "red":160,"green":108,"blue":68,
  "temperatureC":28.2,
  "relativeHumidityPercent":64,
  "gasResistanceOhms":128400,
  "recordedAt":"2026-10-18T09:00:00+05:30",
  "calibration":{"protocol":"lab-baseline","version":"v1","calibratedAt":"2026-10-18T08:00:00+05:30"}
}
```

Calibration is optional. Numeric fields must be JSON numbers, not numeric strings. Weight 0?10000 g; RGB 0?255; temperature -40?85 C; humidity 0?100%; gas resistance 0?1e12 ohms. These broad validation bounds are not quality-risk thresholds. A unique `(deviceId, measurementId)` MongoDB index rejects retries with 409, including conflicting payloads. Retain measurement IDs across device retries. Index initialization completes before the server starts accepting requests when MongoDB is connected. All new collections are prefixed `module02_`; existing collections are untouched.

PowerShell request examples (enter your configured secrets into local variables):

```powershell
$operatorToken = Read-Host 'Operator token'
$sample = @{ sampleId='CIN-001'; batchId='BATCH-A'; grade='Alba'; storage='Glass'; storageStartDate='2026-10-18'; initialWeightGrams=250 }
Invoke-RestMethod http://localhost:5000/api/samples -Method Post -Headers @{Authorization="Bearer $operatorToken"} -ContentType application/json -Body ($sample | ConvertTo-Json)

$deviceKey = Read-Host 'ESP32-S3 key'
$reading = @{ sampleId='CIN-001'; deviceId='ESP32-S3-01'; measurementId='reading-000001'; weightGrams=249.5; red=160; green=108; blue=68; temperatureC=28.2; relativeHumidityPercent=64; gasResistanceOhms=128400; recordedAt=(Get-Date).ToUniversalTime().ToString('o') }
Invoke-RestMethod http://localhost:5000/api/module-02/readings -Method Post -Headers @{'X-Device-Id'='ESP32-S3-01'; 'X-Device-Key'=$deviceKey} -ContentType application/json -Body ($reading | ConvertTo-Json)

$cameraKey = Read-Host 'ESP32-CAM key'
$timestamp = [uri]::EscapeDataString((Get-Date).ToUniversalTime().ToString('o'))
Invoke-RestMethod "http://localhost:5000/api/module-02/images?sampleId=CIN-001&recordedAt=$timestamp&role=Baseline" -Method Post -Headers @{'X-Device-Id'='ESP32-CAM-01'; 'X-Device-Key'=$cameraKey} -ContentType image/jpeg -InFile '.\sample.jpg'

Invoke-RestMethod 'http://localhost:5000/api/module-02/samples/CIN-001/readings?page=1&limit=50'
```

No multipart or base64 wrapper is used for images. The upload body is the file itself.

Prediction request: `{"sampleId":"CIN-001","horizonDays":7}` (integer 1?365). With valid authentication and an available database this always returns `MODEL_UNAVAILABLE`. There is no prediction-insertion endpoint exposed to devices/browsers. The internal `saveModelPrediction` service validates future model output, model version, timestamp, horizon, risk category, and reading/image references belonging to the same sample. It is not called by a model in this phase. It stores only actual outputs supplied by a future trusted integration; test fixtures remain in isolated tests.

## Dashboard behavior

The centralized `qualityService` uses `/api` and the existing Vite proxy. Only selected-sample histories are fetched. Charts and tables show the latest 200 readings, with the original first reading fetched separately for RGB baseline comparison. Image and prediction history views load at most the latest 200 records; use API pagination for older records. No data is replaced by synthetic values on failure. Loading, empty, disconnected, API error and explicit demo states remain separate.

`MODULE02_OFFLINE_SECONDS` defaults to 300. A recent timestamp produces a **recent telemetry** status; an older/missing timestamp is **offline**. The browser reevaluates age every 30 seconds. This is a last-reading age indicator, not proof of a continuously connected device. Gas resistance is not VOC/aroma concentration. No risk, confidence, fungal confirmation or calibrated colour-difference value is invented.

## Verification

```powershell
npm test --workspace server
npm run build
```

Default tests use isolated in-memory repository doubles and real HTTP requests, plus Mongoose schema checks. They never connect to the application's database. They cover sample CRUD/archive, unknown IDs, input bounds/injection, credentials, duplicate ingestion, upload type/size/storage, database failures, MODEL_UNAVAILABLE, frontend API mapping/failure handling and Module 04 validation/database/model-info and successful prediction/history contracts. Successful Module 04 contract checks use isolated persistence and ML doubles, not the live model.

For real MongoDB persistence/index checks, start a dedicated **local test instance**, then:

```powershell
$env:MODULE02_TEST_MONGODB_URI='mongodb://127.0.0.1:27017/cinnasense_module02_test'
npm test --workspace server
Remove-Item Env:MODULE02_TEST_MONGODB_URI
```

The integration test refuses remote hosts and names not ending in `module02_test`. It creates uniquely named test records, removes only those records in the new module collections, and never drops a database. Without this variable, this integration test is explicitly skipped. Test output must not be interpreted as verification against a real MongoDB or live ESP32. End-to-end Module 04 predictions require the existing MongoDB and FastAPI/model runtime; its source is preserved.

## Changed files

New: `server/src/module02/{models,validation,auth,routes,predictionStore}.js`, `server/test/*.test.js`, `server/.env.example`, this guide.
Updated: `server/src/server.js`, `server/package.json`, `.gitignore`; frontend quality API service/provider/layout/UI, sample management/details, dashboard, image history and prediction history pages. No new runtime dependencies, firmware changes or Python service changes.

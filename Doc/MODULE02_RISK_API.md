# Phase 3: Model 02 Node.js risk integration

The backend now calls Model 02 independently of the existing image and price
clients. Only registered samples and existing, same-sample sensor readings can
produce a synthetic risk result. No React, firmware or Python changes are included.

## Configuration and startup

Add these values to your local, ignored `server/.env` (examples are in
`server/.env.example`):

```dotenv
MODULE02_RISK_SERVICE_URL=http://127.0.0.1:8000
MODULE02_RISK_SERVICE_TOKEN=<same secret as RISK_SERVICE_TOKEN in ml-service/.env>
MODULE02_RISK_TIMEOUT_MS=10000
MODULE02_RISK_MAX_READING_AGE_SECONDS=300
```

The service token is server-only, separate from the operator, device and image
service tokens. Do not use `VITE_` variables or send it to the browser. This phase
updates the configuration example only; it does not overwrite your actual `.env`.
The risk client fails closed if the token is missing or shorter than 32 characters.
Timeout must be an integer 100..30000 milliseconds; maximum reading age must be
an integer 1..86400 seconds. URL must be HTTP(S), with no credentials, query or
fragment. Redirects are rejected. Responses are limited to 16 KiB and validated
before persistence. Connection failures and upstream errors never expose service
tokens, tracebacks or raw upstream error bodies.

Keep both verified Python services running in separate terminals:

```powershell
# Model 01: repository root, original working interpreter/environment
& 'C:\Program Files\Python313\python.exe' -m uvicorn cinnasense_quality.api:app --app-dir ml-module02/src --host 127.0.0.1 --port 8002

# Model 02 and existing price service: another terminal, ml-service directory
cd ml-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then start/restart the backend from the repository root:

```powershell
npm run dev --workspace server
```

Do not start duplicate processes on occupied ports. Startup initializes the new
collection's unique index before listening when MongoDB is connected. Index
initialization must succeed; do not disable Mongoose index creation for this
collection without provisioning its indexes separately. No migration is run.

## Exact backend endpoints

Both routes require the existing `Authorization: Bearer <MODULE02_OPERATOR_TOKEN>`.
Device credentials alone do not authorize risk prediction or risk history.

### POST `/api/module-02/risk-predictions`

```json
{"sampleId":"CIN001","readingId":"<existing 24-character reading ObjectId>"}
```

Only these two fields are accepted. Sensor values, prediction categories and
forecast horizons supplied by a browser are rejected. The sample must exist and
be unarchived; the reading must exist and belong to the sample. A cross-sample
reading is reported as not found, without revealing the other sample's data.

For new predictions, all timestamps must be valid; storage start and reading
time must not be in the future, and the reading cannot predate storage. Readings
older than the configured maximum age are rejected. All seven values must be
finite numbers within the Python API bounds; weight must be positive even though
the existing ingestion API permits zero. Existing sensor ingestion is unchanged.

| Model input | Stored source / calculation | Allowed bounds |
| --- | --- | --- |
| `storage_day` | `floor((reading.recordedAt - sample.storageStartDate) / 86400000)` | integer 0..3650 |
| `temperature_c` | `temperatureC` | -40..85 Celsius |
| `humidity_percent` | `relativeHumidityPercent` | 0..100 percent |
| `weight_g` | `weightGrams` | >0..10000 grams |
| `color_r` | `red` | 0..255 |
| `color_g` | `green` | 0..255 |
| `color_b` | `blue` | 0..255 |

Storage age means completed UTC 24-hour periods, preserving timezone offsets in
the input timestamps. **This day calculation is a prototype assumption until
training metadata confirms its meaning.** No RGB normalization is introduced.
Gas resistance, images, fungus screening and Model 01 scores are not Model 02
features and are not sent to it.

Node sends the exact seven-feature JSON to Python `POST /predict-risk` with
`X-Risk-Service-Token`. The client validates the full Phase 2 response contract,
including `Low/Medium/High`, synthetic title/warning, model version, timestamp,
`SYNTHETIC_DEMO`, false validation flag and a null/unverified horizon. There is
no fallback prediction or invented confidence value.

First successful persistence returns HTTP **201** and the stored record. A
successful retry returns HTTP **200** and the original stored record, for example:

```json
{
  "_id": "<new risk record ObjectId>",
  "sampleId": "CIN001",
  "sensorReadingId": "<existing reading ObjectId>",
  "inputSnapshot": {"storage_day":5,"temperature_c":30.5,"humidity_percent":76,"weight_g":98.2,"color_r":145,"color_g":90,"color_b":50},
  "predictedRisk": "Medium",
  "riskCategory": "moderate",
  "modelVersion": "random-forest-demo-6ff77e1d306f",
  "predictedAt": "<ML UTC timestamp>",
  "title": "Storage Deterioration Risk (Synthetic Demo)",
  "dataOrigin": "SYNTHETIC_DEMO",
  "validationStatus": "not_scientifically_validated",
  "validatedForRealWorldUse": false,
  "warning": "Demonstration risk prediction based on synthetic training data. Not validated for real-world cinnamon safety or quality assessment.",
  "predictionHorizonDays": null,
  "predictionHorizonVerified": false,
  "horizonNote": "No prediction horizon metadata is present. This output is not a verified seven-day forecast.",
  "createdAt": "<server UTC timestamp>",
  "updatedAt": "<same server UTC timestamp>"
}
```

Mongoose may also include `__v`. The model is trained on synthetic demonstration
data and is not scientifically validated, even when the selected reading is real.
No seven-day forecast or food-safety conclusion is supported.

### GET `/api/module-02/samples/:sampleId/risk-predictions`

Authenticated history for one existing sample. Archived samples retain readable
history. Query parameters follow existing conventions: `page` (default 1), `limit`
(default 50, maximum 200), optional `from` and `to` ISO dates/timestamps filtering
`predictedAt`. Results sort newest first by `predictedAt`, then `_id`.

```json
{"data":["<stored risk records>"],"pagination":{"page":1,"limit":50,"total":1,"pages":1}}
```

Empty results return `data:[]`, `total:0`, `pages:0`.

## Persistence and retry behavior

Records go only to **`module02_synthetic_risk_predictions`**. Explicit mapping:
`Low -> low`, `Medium -> moderate`, `High -> high`.

The compound unique key is `{sampleId, sensorReadingId}`. `$setOnInsert` in an
atomic upsert stores only the first result. Concurrent duplicate-key races fetch
the winning record. Retries never overwrite inputs, category, model version or
timestamps. Multiple concurrent ML calls are possible, but only one record is
persisted. A lost response or database failure can be retried with the same body.

After checking operator authentication, sample eligibility and same-sample reading
existence, a retry can return an existing result even after that reading becomes
stale. This returns historical evidence; it does not generate a new prediction.
Archived samples reject POST, including retries; their history remains available.
An intentional re-evaluation of the same reading with a future model version
requires a new explicit contract; it cannot silently replace the stored result.

The existing `/api/module-02/predict` still returns its original
`MODEL_UNAVAILABLE` behavior for valid requests. Existing
`module02_degradation_predictions` records, horizon rules, image records,
Model 01 routes/client, sensor ingestion and price routes/client are unchanged.

## Error contract

All new route errors use `{"error":{"code":"...","message":"..."}}`.

| HTTP | Typical code |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_READING`, `FUTURE_READING` |
| 401 | `UNAUTHORIZED` |
| 404 | `SAMPLE_NOT_FOUND`, `READING_NOT_FOUND` |
| 409 | `SAMPLE_ARCHIVED`, `STALE_READING` |
| 502 | `INVALID_RISK_RESPONSE` |
| 503 | `AUTH_UNCONFIGURED`, `RISK_SERVICE_UNCONFIGURED`, `RISK_SERVICE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `RISK_PERSISTENCE_FAILED` |
| 504 | `RISK_SERVICE_TIMEOUT` |

Unknown internal failures return a generic HTTP 500. Failed ML requests do not
create prediction records. The existing global Express JSON parser retains its
existing invalid-JSON handling.

## Test with an existing sensor reading

Configure the server-only service token above, ensure a real registered sample
has a recent stored sensor reading, and restart Node. Set your existing operator
token privately in the terminal's `MODULE02_OPERATOR_TOKEN` environment variable.
The PowerShell terminal does not automatically load `.env` values.

```powershell
$api = 'http://localhost:5000/api'
$sampleId = 'CIN001'
$headers = @{ Authorization = "Bearer $env:MODULE02_OPERATOR_TOKEN" }
$latest = Invoke-RestMethod "$api/module-02/readings/latest?sampleId=$sampleId"
if (-not $latest.data._id) { throw 'No existing sensor reading for this sample.' }
$body = @{ sampleId=$sampleId; readingId=$latest.data._id } | ConvertTo-Json
Invoke-RestMethod "$api/module-02/risk-predictions" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
# Repeating the same POST returns the same saved record.
Invoke-RestMethod "$api/module-02/samples/$sampleId/risk-predictions?limit=10" -Headers $headers
```

The POST above is an intentional application write. It is not a test that should
be run against Atlas with fabricated samples. If a stored reading is stale, obtain
a fresh reading through the existing ingestion flow; do not change old timestamps
or inject made-up measurements to bypass validation.

## Automated verification and limitations

From the repository root:

```powershell
npm test --workspace server
npm run test:risk --workspace server
```

Phase 3 results: **37 backend tests passed, 2 optional real MongoDB tests skipped**.
These include Model 01 image integration, price prediction/history, unchanged
legacy prediction behavior, ingestion, new risk mapping, validation, authentication,
history, concurrent/retried writes, sanitized DB failures, invalid ML output and
a real local HTTP timeout. Tests use isolated repository doubles plus actual
Mongoose schema validation. They do **not** prove real MongoDB persistence.

The optional `risk-mongo.integration.test.js` verifies actual MongoDB atomic
upserts/unique indexes when `MODULE02_TEST_MONGODB_URI` explicitly points to a
local MongoDB test database whose name ends with `module02_test`. It refuses
Atlas/nonlocal hosts and normal database names, and cleans only its own records.
No local database was configured for this run; no production Atlas test records
were written.

Additional checks:

- Model 01 Python: 10 tests passed. Real `CIN001_01.jpg` inference still returns
  `good_quality`, score `0.8355661034584045`, exactly matching Phase 1.
- Model 02/price Python contracts: 14 tests passed.
- New Node risk client -> real Model 02: HTTP success, `Medium`,
  `SYNTHETIC_DEMO`, null horizon, using demonstration input and no database writes.
- Existing real price endpoint: HTTP 200; `2026-10-21`, `Galle`, `Alba` returned
  `4668.93310546875` LKR/kg (`xgb-v1`). No price record was persisted by this check.

Limitations carried forward: synthetic/unvalidated risk model; unknown prediction
horizon and unconfirmed training-day semantics; actual MongoDB persistence not
exercised here; actual server `.env` risk settings must be supplied locally.
The physical camera was unreachable in Phase 2; Phase 3 did not alter or retest
hardware capture. The existing Model 01 Pillow declaration mismatch and test-client
deprecation warning are unchanged. Neither React nor firmware uses this API yet.

## Phase 3 changed files

Created:

- `server/src/module02-risk/client.js`
- `server/src/module02-risk/model.js`
- `server/src/module02-risk/routes.js`
- `server/test/risk-client.test.js`
- `server/test/risk-routes.test.js`
- `server/test/risk-mongo.integration.test.js`
- `server/MODULE02_RISK_API.md`

Updated:

- `server/src/server.js`: mount separate risk router; initialize new model index.
- `server/package.json`: include new tests and existing image tests in the full
  suite; add `test:risk`. No dependencies added.
- `server/.env.example`: server-only risk settings and optional local test URI.

Pre-existing uncommitted files are preserved. The local snapshot and checksum
manifest are referenced by `state/local-runtime/phase3-backup-path.txt` and the
uncommitted patch is `state/local-runtime/phase3-uncommitted.patch` (all ignored).
No commit or push is part of this phase. Stop before React or firmware integration.

# Module 02 PP1 presentation — October 23, 2026

## Root cause and verified data path

The existing Atlas connection uses the driver-default `test` database because
the configured URI has no explicit database name. Read-only inspection found
**0 samples and 0 readings** in its Module 02 collections. `cinnasense_ai` had
no Module 02 collections. Both the Node API and Vite proxy returned a valid 200
response with `data: []`, total 0. This was an empty dataset, not authentication,
response mapping, frontend filtering, or an API outage.

The default shared environment correctly continues to show its empty Atlas
dataset. No shared URI, `.env`, proxy, startup, authentication, navigation, or
other member's collection was changed. Use the separate presentation URL below
to see local saved records. The same existing Module 02 routers and client
methods are reused; there are no duplicate collection formats or prediction APIs.

```text
MongoDB: mongodb://127.0.0.1:27018/cinnasense_module02_pp1_dev
Module 02 API: http://127.0.0.1:5002/api
Presentation frontend: http://127.0.0.1:5180/module-02
Model 02 and existing price service: http://127.0.0.1:8000
```

Only the Module 02 quality client honors the optional `VITE_MODULE02_API_URL`.
Other module clients keep the existing shared `/api` proxy. The development
server exposes only Module 02 routes and binds to loopback. Its CORS origins
are limited to the presentation frontend on port 5180.

## Database contents and provenance

Existing collections in the dedicated local development database:

| Collection | Verified presentation records |
| --- | ---: |
| `module02_samples` | 3 |
| `module02_sensor_readings` | 18 (six per sample) |
| `module02_synthetic_risk_predictions` | 1 actual Python response saved during browser verification |

Samples: `CIN-PP1-001`, `CIN-PP1-002`, `CIN-PP1-003`, all with
`dataOrigin: "DEMO_DATA"`. Observation dates are deterministic October 16–21,
2026; values were generated for presentation, not physically measured. No raw
counts, calibration, real photographs or image-model confidence are fabricated.
The third sample deliberately has null temperature and humidity. The first two
contain clearly labeled illustrative environmental values, not manual readings.

The seed only inserts missing identifiers. It never deletes/overwrites existing
records, and it reuses active research samples if any exist in that verified local
database. Conflicting/archived identifiers stop the seed. Two seed runs produced
the same 3/18 counts; an automated check also verified existing documents did not
change. The script refuses SRV/remote hosts, credentials, URI query redirection,
ordinary database names and any port other than local 27018. It ignores the
production `MONGODB_URI` entirely.

Prediction category/timestamp/history are never seeded. The saved Low Risk
result came from an authenticated browser request to the actual Python model.
New requests can return any supported category, and request retries retain the
existing immutable record. Input sources identify these values as illustrative;
model output stays `SYNTHETIC_DEMO`, scientifically unvalidated, with an
unverified/null prediction horizon.

Historical illustrative readings can be predicted only by the dedicated local
presentation runner, which explicitly enables that behavior and verifies the
actual connected database. Production/default freshness checks are unchanged.
Real sensor records still require fresh measurements; future and incomplete
inputs remain rejected in every mode. Do not increase freshness limits or change
capture timestamps to misrepresent old readings as live.

## Start and seed (PowerShell, separate terminals)

All root commands start in `C:\Github Project\J26-IT-381`. Services are already
running after verification; start them again only after stopping those instances
or after restarting the laptop.

1. Start the existing portable local MongoDB. Leave it running while presenting:

```powershell
cd 'C:\Github Project\J26-IT-381'
$runtimeDirectory = Get-Content state/local-runtime/phase45-verification-path.txt
$mongoDirectory = Join-Path $runtimeDirectory 'mongo-portable'
& (Join-Path $mongoDirectory 'mongod.exe') --bind_ip 127.0.0.1 --port 27018 --dbpath (Join-Path $mongoDirectory 'data') --logpath (Join-Path $mongoDirectory 'mongod.log') --logappend
```

Its database files are persistent in the existing ignored local-runtime data
directory. Do not delete that directory. The deterministic samples can be
recreated by reseeding, but prediction history is separate saved data.

2. Seed the verified local database, then start the Module 02-only API:

```powershell
cd 'C:\Github Project\J26-IT-381'
node server/tools/module02-pp1-seed.mjs --uri mongodb://127.0.0.1:27018/cinnasense_module02_pp1_dev
node server/tools/module02-pp1-server.mjs
```

The runner reads existing server-side operator and ML credentials privately from
`server/.env`; it never uses that file's database URI. It does not need device
credentials or sensor hardware. The previously identified malformed device-key
registry is therefore not a blocker for this stored-record presentation and was
not changed.

3. Start the presentation frontend with the Module 02-only API override:

```powershell
cd 'C:\Github Project\J26-IT-381'
$env:VITE_MODULE02_API_URL='http://127.0.0.1:5002/api'
npm run dev --workspace client -- --host 127.0.0.1 --port 5180 --strictPort
```

This variable contains no secret. Do not put operator, device or ML tokens into
any Vite environment variable. Omitting the override restores the existing
Atlas-backed Module 02 path through `/api`.

4. Start Python Model 02 only if port 8000 is not already serving it:

```powershell
cd 'C:\Github Project\J26-IT-381\ml-service'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Use this compatible environment, not the active Model 01 environment. Existing
price prediction remains in that same service; neither model's weights/code were
modified. The original shared backend can still run independently with
`npm run start --workspace server` on port 5000 when other modules need it.

## PP1 demonstration steps

1. Open **http://127.0.0.1:5180/module-02**. Keep the separate in-memory Demo
   data switch **off**. The presentation uses saved MongoDB records automatically.
2. Point out “Stored Sample Records”, the count of 3, and the “Illustrative
   Records” note. Explain that hardware is offline and values are not research
   measurements.
3. Select `CIN-PP1-001`. Its latest weight is 246 g, initial weight 250 g, with
   six timestamped observations. Show weight/RGB history, color preview, recorded
   environment and sample measurement history.
4. Click **Refresh stored records**. Selection and saved history should remain.
5. Enter your existing **MODULE02_OPERATOR_TOKEN** in the risk panel's password
   field; never use the Python service token. Click **Load risk history** to show
   the previously saved actual model result, or **Request risk prediction**.
   This calls the real Python service and persists the response locally.
6. Explain the synthetic-training disclosure and unverified horizon. A Low result
   does not establish real-world food safety or validated deterioration risk.
7. Select `CIN-PP1-003` to demonstrate missing environmental measurements. The
   dashboard says “Not available”; prediction is disabled with the required-input
   explanation. No measurements are substituted.
8. Explain that Model 01 is preserved but no real photograph belongs to these
   illustrative samples. Its panel does not invent an image classification.
9. If the Python service is unavailable, continue presenting stored records and
   history. A new prediction request shows a service error; charts and samples
   remain usable. Existing immutable results can be returned from persistence.

## Verification

106 tests passed, zero skipped: 28 frontend; 39 existing backend; 10 sensor;
4 PP1 seed/API/freshness tests; 1 existing real-ML end-to-end; 14 Python risk/price
tests; 10 Model 01 Python regressions. Frontend production build passed.

Headless Edge verified actual API-backed loading, three sample options, six
observations, sample selection, refresh, authenticated real-ML prediction and
saved history with no UI errors. Desktop (1440px) and mobile (390px) had no
horizontal overflow; the third sample displayed its missing-input message and
disabled prediction button. The temporary verification browser was closed.

Ordinary test fixtures were confined to dedicated local test databases and
cleaned. Presentation records/history are intentionally retained. No Atlas test
writes, model retraining, shared configuration changes, commit or push occurred.

Useful test commands (with local MongoDB and both ML services running):

```powershell
$env:MODULE02_PP1_TEST='1'
$env:MODULE02_TEST_MONGODB_URI='mongodb://127.0.0.1:27018/cinnasense_pp1_module02_test'
$env:MODULE02_E2E='1'
Push-Location server
node --test --test-concurrency=1 test/pp1-dataset.test.js
npm test
node --env-file=.env --test --test-concurrency=1 test/real-sensors.test.js
npm run test:e2e
Pop-Location
npm test --workspace client
npm run build --workspace client
```

## Changed files

Created:

- `server/src/module02/pp1Dataset.js`
- `server/tools/module02-pp1-seed.mjs`
- `server/tools/module02-pp1-server.mjs`
- `server/test/pp1-dataset.test.js`
- `server/MODULE02_PP1_PRESENTATION.md`

Modified:

- `server/src/module02/models.js`
- `server/src/module02-risk/routes.js`
- `client/src/components/QualityProvider.jsx`
- `client/src/components/QualityLayout.jsx` (Module 02 banner text only)
- `client/src/components/ImageClassifierPanel.jsx`
- `client/src/components/Module02SensorPanel.jsx`
- `client/src/pages/QualityDashboard.jsx`
- `client/src/services/qualityService.js`
- `client/src/services/riskPredictionState.js`
- `client/test/risk-render.test.js`
- `client/test/risk-state.test.js`

Shared homepage, navigation, authentication, startup, package files, Vite proxy,
other module source, `.env`, trained weights and Python model implementations
remain unchanged. Archived original research remains untouched. No firmware or
physical-hardware verification is part of this presentation preparation.

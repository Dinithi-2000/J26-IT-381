# Module 02 Atlas-backed presentation

## Active data path

React on port 5173 (or the existing 5180 instance) -> `/api` -> Node on port 5000
-> MongoDB Atlas **CinnaSenseCluster**, database **test**.

The main database connection was already Atlas. Only the presentation instance
previously used local MongoDB on port 27018. Module 02 frontend services now use
the main API unconditionally; the old VITE_MODULE02_API_URL override is ignored.
The obsolete local presentation API on port 5002 has been stopped.

## Existing records transferred on October 21, 2026

| Atlas collection | Count |
| --- | ---: |
| module02_samples | 3 |
| module02_sensor_readings | 18 |
| module02_synthetic_risk_predictions | 1 |
| module02_image_condition_analyses | 0 |

Samples CIN-001, CIN-002 and CIN-003 and all 18 observations retain
DEMO_DATA provenance. They are illustrative values, not real sensor measurements.
The existing Low result retains SYNTHETIC_DEMO, its original timestamp and reading
reference, scientific-validation warning and null/unverified prediction horizon.
Model 01 previews were never persisted, so its empty history is expected.

Transfer used a transaction with collision checks, preserved exact BSON IDs and
dates, and verified every destination document against its source. No records
were deleted or overwritten. Retries of the saved prediction return the same ID.
Local source data remains intact as a fallback, but is not used by the dashboard.

Verified source and destination EJSON snapshots plus SHA-256 manifest:
`C:\Github Project\CinnaSense-backups\module02-atlas-transfer-20261021-01`.
Backup access is restricted to the owner, SYSTEM and administrators. It contains
no connection strings or environment secrets. Do not rerun a seed against Atlas.
`tools/module02-transfer-to-atlas.mjs` is a one-time, guarded existing-data transfer,
not part of application startup. It refuses conflicting IDs or unique keys.

## Startup

From the project root, in separate terminals:

```powershell
npm run start --workspace server
npm run dev --workspace client
```

Open http://localhost:5173/module-02. Start both Python services using the exact
unchanged commands in `ml-module02/MODEL_FILES_GUIDE.md` if not already running.
No local MongoDB or port 5002 presentation API is required.

Keep the in-memory Demo switch off. Select CIN-001 to see stored observations.
Enter the existing operator token in the dashboard password field and load risk
history. The saved Low result is an actual model inference on illustrative inputs.
A separate real photo can be classified with the authenticated preview action;
it is not attached to illustrative samples or saved to image history.

New simulations of historical stored records are permitted only when BOTH sample
and reading have DEMO_DATA provenance. Real/legacy readings retain the normal
freshness limit. Future, incomplete and invalid readings are rejected. All three
samples have illustrative temperature/humidity values and can produce a risk result.

## Verification

```powershell
node server/tools/module02-verify-atlas.mjs
npm test --workspace client
npm run build --workspace client
node --test server/test/pp1-photo-preview.test.js
```

The Atlas verification checks counts, all three API/proxy ports, sample/readings/
history retrieval, retry-safe reuse of the already saved result, the real Model 01
photograph baseline, authenticated Model 02 health and existing price health.
It does not create sensor fixtures or additional risk predictions in Atlas.
The photo preview remains non-persistent. Real hardware connectivity and model
scientific accuracy are not established by these checks.

Cutover results: 101 tests passed (41 backend, 6 photo-preview, 30 frontend,
14 Model 02/price Python and 10 Model 01 Python), and the frontend build passed.
Backend persistence tests used an isolated local test database; no generated
test records were written to Atlas. Both active model artifact checksums and
the Model 01 class mapping checksum remain unchanged.

Backend database integration tests use an isolated local test database only;
never set MODULE02_TEST_MONGODB_URI to Atlas. Historical local tools are retained
for provenance/testing and are not part of the active presentation setup.

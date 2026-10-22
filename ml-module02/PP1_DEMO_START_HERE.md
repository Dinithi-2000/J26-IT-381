# Module 02: start here for October 23, 2026

Open **http://localhost:5173/module-02**. Keep the same laptop network with Atlas
access throughout. Start each service below in its own PowerShell terminal only
if its port is not already running. No training or local presentation database is
needed. Do not run the historical seed or migration scripts.

## 1. Start the existing services

MongoDB is **Atlas / CinnaSenseCluster / test**. There is no local MongoDB startup
command for the application. Node reads the existing private `server/.env`.
Confirm your current public IP is Active in Atlas Network Access.

Backend (5000):

```powershell
cd 'C:\Github Project\J26-IT-381'
npm run start --workspace server
```

Image Model 01 (8002; existing TensorFlow environment):

```powershell
cd 'C:\Github Project\J26-IT-381'
& 'C:\Program Files\Python313\python.exe' -m uvicorn cinnasense_quality.api:app --app-dir ml-module02/src --host 127.0.0.1 --port 8002
```

Risk Model 02 and existing price service (8000; scikit-learn 1.6.1 environment):

```powershell
cd 'C:\Github Project\J26-IT-381\ml-service'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (5173):

```powershell
cd 'C:\Github Project\J26-IT-381'
npm run dev --workspace client -- --host localhost --port 5173 --strictPort
```

Check backend health at http://localhost:5000/api/health: `database` should say
`connected`. Check image health at http://127.0.0.1:8002/health: `status` should
say `ready`. Model 02 health is authenticated; the verification command below
checks it without printing tokens. Never enter Python service tokens into React.

## 2. Show the stored data and charts

1. Open **http://localhost:5173/module-02**.
2. Select **CIN-001** in the Cinnamon ID selector. Wait for readings to load.
3. Show Weight history, RGB change history and the measurement history table.
4. Switch to CIN-002 to demonstrate selection, then return to CIN-001.

Atlas currently contains **3 illustrative records and 18 observations**, six per
record. Their `DEMO_DATA` label is retained: they are not measurements of real
cinnamon. All three records have illustrative temperature and humidity values.

The intended monitored group contains **four quills, approximately four inches
each**. Weight is the combined total. Illustrative weights do not establish the
actual measured weight of your physical group. No hardware connection is claimed.

## 3. Show Model 01

1. Open **Image analysis** (`/module-02/images`).
2. Under **Classify a separate uploaded photograph**, enter your existing operator
   token privately and select an actual cinnamon JPEG/PNG (maximum 5 MiB).
3. Click **Classify photo without saving**. The actual class, model score and
   timestamp appear. The known test photo is:
   `C:\Users\USER\Downloads\OneDrive_1_10-20-2026\Good_quality\CIN001_01.jpg`.

That photo currently returns `good_quality` at about **83.6%**, an uncalibrated
model score. Other photographs may return different results. The preview is not
saved and disappears on refresh. Do not claim it is stored image history.

The existing saved-image workflow works for registered real sample IDs. Actual
inference, image persistence, image bytes and history retrieval were verified in
an isolated test database. Atlas has **0 saved image classifications**. Do not
attach an unrelated photograph to an illustrative sensor record or create new
production records solely for this walkthrough.

## 4. Show Model 02 and refresh

1. Open **AI predictions** (`/module-02/predictions`). Select **CIN-001**.
2. Enter your operator token; click **Load risk history** to show the saved Low
   result, its exact input snapshot, original timestamp and synthetic disclosure.
3. **Request risk prediction** for that same reading returns the same saved
   record. This duplicate-safe action does not rerun inference or add a document.
4. Refresh the browser, select CIN-001 again, and
   load history. The same saved result remains available from Atlas.

Fresh Model 02 inference on that stored input snapshot was separately verified
as Low without a new Atlas write. New inference and persistence on a fresh test
reading were also verified in an isolated database (that test returned Medium).
Output is **SYNTHETIC_DEMO**, not scientifically validated, with no verified
prediction horizon. Do not claim a seven-day forecast.

## 5. Show Atlas and run the quick check

In Atlas Data Explorer choose **CinnaSenseCluster -> test**:

| Collection | Verified count |
| --- | ---: |
| `module02_samples` | 3 |
| `module02_sensor_readings` | 18 |
| `module02_synthetic_risk_predictions` | 1 |
| `module02_image_condition_analyses` | 0 |

The empty image collection is expected because previews are not saved. Read-only
database checks, real inference and retry of the existing result:

```powershell
cd 'C:\Github Project\J26-IT-381'
node server/tools/module02-verify-atlas.mjs
```

## If something stops working

- **Port in use:** use the existing instance; do not start duplicates.
- **Database unavailable:** confirm internet and Atlas IP access, wait for
  reconnection, then click Refresh stored records. If the backend initially
  started without a database connection, restart that backend terminal.
- **Empty list:** check Atlas `test`, not a different database; refresh after
  the backend reports connected. No local presentation API is used.
- **Model unavailable:** check its terminal and restart using its own command
  above. Do not reinstall dependencies, change weights or retrain. Stored
  observations and saved risk history remain useful during an inference outage.
- **401:** re-enter the operator token from your private backend configuration.
  The token is remembered until the browser tab is closed (sessionStorage only).
- **Risk inputs unavailable:** the selected reading is missing temperature or
  humidity; select another sample. Genuine readings must meet the backend freshness rules.
- **"This photo does not look like a cinnamon quill":** the cinnamon check rejected
  the photo (similarity to the 250 known cinnamon photos below 0.55). Use a clear
  cinnamon photo. The check needs `models/cinnamon_reference.npz`; if it is missing
  (`/health` shows `"cinnamonCheck":"off"`), rebuild it from `ml-module02` with
  `python -m cinnasense_quality.reference --data "C:\Users\USER\Downloads\OneDrive_1_10-20-2026"`.
- **Photo result disappears on refresh:** expected for preview. Only an explicitly
  saved image associated with a real registered record has persistent history.

Verification uses a separate local database only for automated tests. The active
dashboard always uses Atlas. No new Atlas records were created during these checks.

Verified October 21: all three Module 02 pages worked in a real Edge browser;
weight/RGB charts and record switching worked; both model results appeared on
the overview; saved risk history remained retrievable after reload. The mobile
viewport had no horizontal overflow. All 102 automated tests and the frontend
build passed. Active model weights, labels and preprocessing remain unchanged.

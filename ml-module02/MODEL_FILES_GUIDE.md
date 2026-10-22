# Module 02 model files — existing paths

Project root: `C:\Github Project\J26-IT-381`.
All paths below are relative to that root. **No model reorganization or rename
has been performed.** Keep these paths unchanged through PP1 on October 23, 2026.

## Model 01 — Cinnamon Image Quality Classification

This is the image classifier inside research **Module 02**, not the group's
Module 01 dehydration component. It classifies an uploaded cinnamon photograph
as `Suspected Mold` or `good_quality`. Scores are uncalibrated model outputs,
not confirmed mold probabilities or food-safety certification.

| What you need | Actual existing file |
| --- | --- |
| Active trained MobileNetV2 model | `ml-module02/models/cinnamon_quality_mobilenetv2.keras` |
| Active class labels, in training order | `ml-module02/models/class_names.json` |
| Original Colab training notebook | `CinnaSense_Image_Model_01.ipynb` |
| Separate reviewed two-class training notebook | `ml-module02/CinnaSense_Model01_Training.ipynb` |
| Reviewed two-class training script | `ml-module02/src/cinnasense_quality/train.py` |
| Saved-model loading and predictions | `ml-module02/src/cinnasense_quality/inference.py` (`Classifier`) |
| Image preprocessing | Same `inference.py`, function `preprocess_image` |
| FastAPI prediction service | `ml-module02/src/cinnasense_quality/api.py` |
| ESP32-CAM capture helper | `ml-module02/src/cinnasense_quality/camera.py` |
| Dataset audit and reviewed splitting | `ml-module02/src/cinnasense_quality/dataset.py` |
| Local audit outputs, not image files | `ml-module02/data/local-audit/` |
| Model/API regression tests | `ml-module02/tests/test_camera_integration.py` |
| Dataset-review tests | `ml-module02/tests/test_dataset_review.py` |
| Existing saved-image Node API | `server/src/module02-image/routes.js` |
| Node-to-Python client | `server/src/module02-image/service.js` |
| Dashboard image component | `client/src/components/ImageClassifierPanel.jsx` |

The active label order is exactly `['Suspected Mold', 'good_quality']`. Never
replace it with an archived label file. Preprocessing converts valid JPEG/PNG
images to RGB, applies EXIF orientation, resizes to 224×224, and passes float32
pixels on the 0–255 scale; normalization is embedded in the saved model.

The original notebook exports the active artifact filenames. The separate
reviewed trainer is another workflow; do not assume it produced identical
weights. Raw photographs are external to the repository. The previously tested
photo is `C:\Users\USER\Downloads\OneDrive_1_10-20-2026\Good_quality\CIN001_01.jpg`.
Keep actual photographs available for your presentation; do not use an invented
image-classification result if that file is missing.

Earlier four-class experiments remain in `ml-module02/src/train.py`,
`evaluate.py`, `common.py`, `build_inventory.py`, `make_splits.py`, and
`ml-module02/notebooks/cinnasense_m02_image_model_colab.ipynb`. They are not the
active two-class service. Preserved historical implementations and model versions
remain untouched in `ml-module02/original-model01/`.

### Run Model 01 (own PowerShell terminal)

```powershell
cd 'C:\Github Project\J26-IT-381'
& 'C:\Program Files\Python313\python.exe' -m uvicorn cinnasense_quality.api:app --app-dir ml-module02/src --host 127.0.0.1 --port 8002
```

Use the existing Python environment with TensorFlow. Do not run this through the
Model 02 `.venv`, reinstall dependencies, or retrain for the presentation.

- Health: `GET http://127.0.0.1:8002/health`.
- Prediction: `POST http://127.0.0.1:8002/classify`, binary JPEG/PNG body,
  `Content-Type: image/jpeg` or `image/png`, server-side
  `X-Quality-Service-Token` authentication.
- Existing saved-image API: `POST /api/module-02/image-classification/images?sampleId=...`,
  using operator authentication and a registered real sample.
- Approved photo preview: `POST http://127.0.0.1:5000/api/module-02/image-classification/preview`,
  operator Bearer authentication and a binary JPEG/PNG. This forwards to the
  existing Model 01 service, returns the actual class/score/time, and saves
  neither the image nor its result. It does not associate the photograph with
  illustrative sensor samples. This route is available through the main Node API.

## Model 02 — Storage Deterioration Risk (Random Forest)

This model predicts `Low`, `Medium`, or `High` from seven inputs: storage day,
temperature, humidity, weight, and display R/G/B. It was trained on synthetic
demonstration data. Its output is `SYNTHETIC_DEMO`, is not scientifically
validated, and has **no verified prediction horizon**.

| What you need | Actual existing file |
| --- | --- |
| Active trained Random Forest artifact | `ml-service/models/cinnasense_model02_demo.joblib` |
| Artifact loader, feature order and metadata validation | `ml-service/app/risk_model_loader.py` |
| Ordered input DataFrame and prediction logic | `ml-service/app/risk_predictor.py` |
| Seven-feature input validation and output schema | `ml-service/app/risk_schemas.py` |
| Model 02 FastAPI routes | `ml-service/app/risk_routes.py` |
| Existing combined service entry point | `ml-service/app/main.py` |
| ML tests | `ml-service/tests/test_risk_api.py`, `test_risk_predictor.py`, `risk_fixtures.py` |
| Node model client | `server/src/module02-risk/client.js` |
| Stored-reading mapping, authentication and persistence | `server/src/module02-risk/routes.js` |
| Synthetic prediction database model | `server/src/module02-risk/model.js` |
| Dashboard risk component | `client/src/components/RiskPredictionPanel.jsx` |
| Training script/notebook | **Not found — not created or fabricated** |
| Supplied dataset candidate (outside repository) | `C:\Users\USER\Downloads\model02__training_dataset.csv` — inspected; connection to the saved model's training run is not yet verified |

The `.joblib` contains an estimator and feature/class/provenance metadata; it is
not a replacement for a training notebook or dataset. Local presentation fixtures
are visualization/test inputs, not recovered training data. Do not confuse this
Random Forest with the group's existing XGBoost price prediction model.

### Supplied Model 02 CSV

The supplied file stays at its original Downloads path; it was not moved,
renamed, imported into MongoDB, or used for retraining.

- 1,380 rows, 60 distinct `sample_id` values; all rows declare `SYNTHETIC_DEMO`.
- All seven current model features are present and within the existing API
  limits, with no missing/nonfinite/nonnumeric feature values. No exact duplicate
  rows were found.
- Other columns are `sample_id`, `quality_score`, `data_origin`,
  `future_quality_score_7d`, and `future_quality_category_7d`. They are not current
  inference inputs.
- The future category column contains **Good: 1,001; Moderate: 374; Poor: 5**.
  These differ from the artifact's `Low/Medium/High` classes. A possible mapping
  must be confirmed from the actual training code; it is not assumed or applied.
- The CSV's column names suggest an intended seven-day target, but the saved
  artifact contains no horizon or training-target metadata. This file alone does
  not establish that the current artifact was trained using that target. Keep
  the existing unverified/null horizon and synthetic disclosure until the
  training notebook/script confirms provenance and label mapping.
- CSV SHA-256:
  `4f164badf3a810128a132f03570959cc4a2beb735492a5cb27f8e086a31169af`.

The original Model 02 training script/notebook is still not available. The guide
records this CSV as a supplied dataset candidate, not as verified training-run
provenance or evidence of real-world validation.

### Run Model 02 (separate PowerShell terminal)

```powershell
cd 'C:\Github Project\J26-IT-381\ml-service'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

This existing environment uses scikit-learn 1.6.1. The service also preserves
the existing price endpoints; do not replace `app/main.py` or its environment.

- Health: `GET /risk/health`, with server-side `X-Risk-Service-Token`.
- Python prediction: `POST /predict-risk`, same authentication and seven numeric
  fields: `storage_day`, `temperature_c`, `humidity_percent`, `weight_g`,
  `color_r`, `color_g`, `color_b`.
- Dashboard prediction: `POST /api/module-02/risk-predictions` with only
  `{sampleId, readingId}` and an operator Bearer token. Node obtains input values
  from the stored reading; the browser never supplies fabricated model results.
- History: `GET /api/module-02/samples/:sampleId/risk-predictions` with operator
  authentication. Stored categories map Low→low, Medium→moderate, High→high.

## Start the Atlas-backed dashboard

All saved Module 02 records now use **CinnaSenseCluster / test** through the main
Node backend on port 5000. The existing 3 illustrative samples, 18 observations
and saved Model 02 Low result were transferred with their original IDs and dates.
They remain demonstration data, not physical measurements. Keep the in-memory
Demo switch off to see these database records.

No local presentation database or port 5002 backend is needed. Start only stopped
services, in separate terminals:

```powershell
cd 'C:\Github Project\J26-IT-381'
npm run start --workspace server
```

```powershell
cd 'C:\Github Project\J26-IT-381'
npm run dev --workspace client
```

Open **http://localhost:5173/module-02** (use Vite's printed port if occupied).
The existing port 5180 dashboard also uses the same main API. Module 02 clients
use `/api`; the old `VITE_MODULE02_API_URL` override is no longer used. Configure
Atlas privately in `server/.env`; never put credentials in React or Vite variables.
Start Python services with the unchanged commands above when needed.

### Demonstrate both outputs

1. Select `CIN-001`. Show the “Illustrative Records” note, saved measurements,
   charts and history; click Refresh stored records.
2. In Model 01, use **Classify a separate uploaded photograph**. Enter your
   existing operator token, choose an actual cinnamon JPEG/PNG, then click
   **Classify photo without saving**. Show the actual returned class,
   uncalibrated score and analysis timestamp. This photograph is unlinked to
   the illustrative sensor dataset; there is no saved preview image history.
3. In Model 02, enter the operator token and choose Load risk history or Request
   risk prediction. Show the actual Python response and its saved Atlas history,
   retaining the synthetic-training and unverified-horizon disclosures.
4. Select `CIN-003` to request a third risk prediction. Its temperature/humidity
   values are illustrative, like those of CIN-001 and CIN-002.

For the longer presentation walkthrough and database safety details, see
`server/MODULE02_PP1_PRESENTATION.md`. Historical illustrative readings are
accepted when both stored sample and reading are labeled DEMO_DATA; real-sensor
freshness rules remain unchanged. Hardware is not required or claimed live.

## Test commands (no retraining)

```powershell
cd 'C:\Github Project\J26-IT-381'
$env:PYTHONPATH='ml-module02/src'
& 'C:\Program Files\Python313\python.exe' -m unittest discover -s ml-module02/tests -p test_camera_integration.py -v
$env:PYTHONPATH='ml-service'
& ml-service/.venv/Scripts/python.exe -m unittest discover -s ml-service/tests -p 'test_risk_*.py' -v
Remove-Item Env:PYTHONPATH
npm test --workspace client
npm run test:images --workspace server
node --test server/test/pp1-photo-preview.test.js
npm run build --workspace client
```

No rename, move, retraining, model-weight change, commit or push is part of this
guide or the approved local photo-preview feature.

Atlas cutover verification: 3 samples, 18 readings, 1 saved synthetic risk result,
and 0 stored image classifications. A separate real-photograph preview returned
`good_quality` with an 83.6% uncalibrated score matching the previous baseline.
Photo preview is intentionally not saved. See the backend presentation guide for
backup locations, verification commands and current results.

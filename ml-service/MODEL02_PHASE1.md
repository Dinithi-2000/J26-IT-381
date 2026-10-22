# Model 02: Phase 1 Python integration

Model 02 runs independently of the image classifier (Model 01). The existing
price service on port 8000 now also exposes authenticated risk routes. Model 01
continues to run from `ml-module02` on port 8002 with its original environment,
artifacts, class labels and image/camera endpoints.

## Scope and interpretation

The supplied RandomForest artifact is trained on **synthetic demonstration data**.
Every successful risk response is titled **Storage Deterioration Risk (Synthetic
Demo)** and states that it is not scientifically validated for real-world cinnamon
safety or quality assessment. It returns a category, not a confidence estimate.

The training notebook `CinnaSense_Model02_Risk_Prediction.ipynb` was not found in
the checked Downloads/project locations. The artifact has no prediction-horizon
metadata, so responses contain `prediction_horizon_days: null` and
`prediction_horizon_verified: false`. This is not a verified seven-day forecast.

This phase does not connect Node.js, MongoDB, React or ESP32 to the new route.
Existing database risk labels are untouched. Model 02 returns its original
`Low`, `Medium`, `High` labels. A later approved backend integration must map
these to `low`, `moderate`, `high`, respectively, without rewriting historical
records.

## Environment and startup

Use the dedicated `ml-service/.venv`, which has **scikit-learn 1.6.1**. Do not
downgrade or reinstall dependencies in the Model 01 environment. From the repository
root, start the service as follows (stop an existing port-8000 process first):

```powershell
cd ml-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

For a new installation only, create this environment within `ml-service`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-test.txt
```

The local ignored `.env` contains these settings:

- `RISK_MODEL_PATH=models/cinnasense_model02_demo.joblib`
- `RISK_MODEL_SHA256=6ff77e1d306fc15b3ec02de6d37925e90f26a24c28b8c59b08d8c8dfdce1a635`
- `RISK_SERVICE_TOKEN`: a separate random secret of at least 32 characters.

A local secret has been configured; it is not included in source control. For a
fresh installation, consult `.env.example` and generate a new secret. Preserve
any existing price settings when editing `.env`; do not overwrite it wholesale.
The trusted user-supplied joblib file is also ignored by Git and must be installed
separately on another machine. Never load an untrusted joblib/pickle artifact.

Risk artifact paths resolve relative to `ml-service`. The loader checks the
configured checksum, runtime version, estimator, feature order, class order and
synthetic-data metadata. It caches a successful load; restart after configuration
or artifact changes. Failure returns an explicit 503, never a fallback category.

## API

Both risk routes require the `X-Risk-Service-Token` header:

- `GET http://127.0.0.1:8000/risk/health`
- `POST http://127.0.0.1:8000/predict-risk`

Example JSON request (demonstration input, not a sensor measurement):

```json
{
  "storage_day": 5,
  "temperature_c": 30.5,
  "humidity_percent": 76.0,
  "weight_g": 98.2,
  "color_r": 145,
  "color_g": 90,
  "color_b": 50
}
```

Use Swagger at `http://127.0.0.1:8000/docs` to test the request, entering the
local secret only into the risk route's header field. Do not embed it in frontend
code or firmware. This request returned HTTP 200 and `predicted_risk: "Medium"`
with the supplied artifact.

All seven fields are required. Storage day is an integer from 0 to 3650;
temperature is -40 to 85 Celsius; humidity is 0 to 100 percent; weight is greater
than 0 and at most 10000 grams; RGB channels are 0 to 255. These are input
validation limits, not scientifically validated model operating ranges. Strings,
booleans, nonfinite values and extra fields are rejected with 422. Invalid or
missing credentials return 401; an unconfigured secret returns 503.

The original price endpoints `/health` and `/predict` retain their contracts.
Risk model failures do not prevent the price routes from working, and price
artifact failures do not prevent risk predictions.

## Verification

From the repository root:

```powershell
$env:PYTHONPATH = 'ml-service'
$env:PYTHONDONTWRITEBYTECODE = '1'
ml-service/.venv/Scripts/python.exe -m unittest discover -s ml-service/tests -p 'test_risk_*.py' -v
```

Results recorded on 2026-10-21:

- 14 Model 02 tests passed: loading/cache, feature and label contracts, synthetic
  provenance, horizon handling, invalid input, authentication, unavailable models
  and existing price API compatibility. Unit tests use temporary test-only
  estimators; they do not retrain either supplied model.
- Real Model 02 artifact: health and prediction endpoints both returned HTTP 200
  under scikit-learn 1.6.1. Existing price health also returned HTTP 200.
- Model 01: 10 Python camera/image tests and 7 Node image API tests passed before
  and after integration. Node tests use mocked persistence.
- Model 01 real-image request returned HTTP 200, `good_quality`, score
  `0.8355661034584045`, identical to baseline for `CIN001_01.jpg`.
- 84 protected source files matched their pre-integration checksums, including
  existing frontend, backend and Model 01 source files and the price predictor,
  schemas and artifact loader.

Artifact SHA-256 values remained unchanged:

| Artifact | SHA-256 |
| --- | --- |
| Model 01 `.keras` | `5ef47ee59f34eb447f0a022c45a453f51b2401ec12c951f7a0150abd38ae6c80` |
| Model 01 `class_names.json` | `ef247f6fa017aed3da4c1514fe0289147d62a69dd0dc3a0f2b17f5530fa2ba92` |
| Model 02 `.joblib` | `6ff77e1d306fc15b3ec02de6d37925e90f26a24c28b8c59b08d8c8dfdce1a635` |

Local ignored backups are under `state/local-runtime/`:

- `model02-phase1-backup-20261021-004539`: original source snapshot, uncommitted
  patch, checksums and baseline results.
- `phase1-resume-backup-20261021-071425`: additional source/artifact ZIP, working
  changes, baseline and `phase1-verification.json`.

## Phase 1 files

Added `app/risk_model_loader.py`, `app/risk_predictor.py`,
`app/risk_schemas.py`, `app/risk_routes.py`, `tests/risk_fixtures.py`,
`tests/test_risk_predictor.py`, `tests/test_risk_api.py`,
`requirements-test.txt` and this guide. Updated `app/main.py` only to mount the
risk router, `requirements.txt` to declare joblib, `.env.example` for risk
configuration, and the root `.gitignore` for the local risk artifact. A local
ignored `.env` and an artifact copy were configured without changing Model 01.

No commits or pushes were made. Phase 2 requires separate approval.

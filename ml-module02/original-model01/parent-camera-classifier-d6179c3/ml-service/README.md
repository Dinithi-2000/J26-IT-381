# Cinnamon ML service

This FastAPI service is the only component that loads the Python models: the Module 04
XGBoost price model and the Module 02 image quality model. The Express server calls it
through `ML_SERVICE_URL`, and the React app never receives the model files. Each model
loads independently, so one being unavailable does not stop the other.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The service returns `503 MODEL_UNAVAILABLE` when the model artifacts cannot be
loaded. It must not return a fabricated or fallback price.

The supplied model files currently need to be re-exported from the original
training environment as valid binary Pickle files before predictions can run.

## Module 02 / Model 01: stored-cinnamon image quality

MobileNetV2 classifier for the visible condition of a cinnamon sample, trained in the
`CinnaSense_Model01_Image_Quality_Training.ipynb` Colab notebook. Files live in
`models/quality_model01/`:

| File | Purpose |
|---|---|
| `cinnasense_model01_mobilenetv2.keras` | trained model (optimizer state removed; identical predictions) |
| `model_metadata.json` | classes, preprocessing, test metrics and data summary from training |
| `labels.json` | class order |

| Endpoint | Description |
|---|---|
| `GET /quality/health` | model version, classes, held-out test metrics, caveats; `503 QUALITY_MODEL_UNAVAILABLE` if not loaded |
| `POST /quality/classify` | multipart form: `image` (JPEG/PNG, ≤ 15 MB) and optional `sample_id`; returns the predicted condition, model score, top predictions, Sri Lanka timestamp and model version |

```powershell
curl.exe -F "image=@quill.jpg" -F "sample_id=CIN-001" http://127.0.0.1:8000/quality/classify
```

Images are processed exactly as in training (EXIF orientation, RGB, downscale to 640 px,
JPEG 95, resize with padding to 224 px), so served predictions match the notebook's
evaluation. To deploy a newly trained model, replace the three files with the new export
(or set `QUALITY_MODEL_DIR`) and restart the service.

Interpretation limits: `modelScore` is the softmax output, not a calibrated probability, and
*Suspected mold* is an image-based indication that needs physical or laboratory confirmation.

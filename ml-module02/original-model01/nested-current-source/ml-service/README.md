# Cinnamon ML service

This FastAPI service is the only component that loads the Python XGBoost model. The
Express server calls it through `ML_SERVICE_URL`, and the React app never receives
the model files.

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

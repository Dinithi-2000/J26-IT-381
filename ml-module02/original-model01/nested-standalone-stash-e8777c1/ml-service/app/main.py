import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Response
from dotenv import load_dotenv

from .model_loader import ModelUnavailableError, load_artifacts
from .predictor import predict
from .schemas import PredictionRequest, PredictionResponse

load_dotenv()
artifacts = {"model": None, "columns": None, "error": None}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        artifacts["model"], artifacts["columns"] = load_artifacts()
    except ModelUnavailableError as error:
        artifacts["error"] = str(error)
        print(f"MODEL_UNAVAILABLE: {error}")
    yield


app = FastAPI(title="Cinnamon Price Prediction Service", lifespan=lifespan)


@app.get("/health")
def health(response: Response):
    if artifacts["model"] is None:
        response.status_code = 503
        response.headers["x-error-code"] = "MODEL_UNAVAILABLE"
        return {"status": "unavailable", "message": artifacts["error"]}
    return {"status": "ok", "modelVersion": os.getenv("MODEL_VERSION", "xgb-v1")}


@app.post("/predict", response_model=PredictionResponse)
def make_prediction(request: PredictionRequest, response: Response):
    if artifacts["model"] is None:
        response.status_code = 503
        response.headers["x-error-code"] = "MODEL_UNAVAILABLE"
        raise HTTPException(status_code=503, detail="Model artifacts are unavailable")
    try:
        value = predict(
            artifacts["model"], artifacts["columns"],
            request.date, request.district, request.grade
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return PredictionResponse(
        prediction=value,
        currency="LKR",
        unit="per_kg",
        modelVersion=os.getenv("MODEL_VERSION", "xgb-v1"),
        input=request,
    )

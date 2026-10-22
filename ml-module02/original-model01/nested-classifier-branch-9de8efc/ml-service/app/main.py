import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from dotenv import load_dotenv

from .model_loader import ModelUnavailableError, load_artifacts
from .predictor import predict
from .quality_classifier import (
    DEFAULT_MODEL_DIR, InvalidImageError, QualityClassifier, QualityModelUnavailableError,
)
from .schemas import PredictionRequest, PredictionResponse

load_dotenv()
artifacts = {"model": None, "columns": None, "error": None}
quality = {"classifier": None, "error": None}

MAX_IMAGE_BYTES = int(os.getenv("QUALITY_MAX_IMAGE_MB", "15")) * 1024 * 1024
SAMPLE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        artifacts["model"], artifacts["columns"] = load_artifacts()
    except ModelUnavailableError as error:
        artifacts["error"] = str(error)
        print(f"MODEL_UNAVAILABLE: {error}")
    # Module 02 image model loads independently, so one model failing never blocks the other.
    try:
        quality["classifier"] = QualityClassifier(os.getenv("QUALITY_MODEL_DIR", DEFAULT_MODEL_DIR))
        print(f"Quality model loaded: {quality['classifier'].version}")
    except QualityModelUnavailableError as error:
        quality["error"] = str(error)
        print(f"QUALITY_MODEL_UNAVAILABLE: {error}")
    yield


app = FastAPI(title="CinnaSense ML Service", lifespan=lifespan)


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


# ---------------------------------------------------------------------------
# Module 02 / Model 01: visible quality condition of stored cinnamon images
# ---------------------------------------------------------------------------
def _quality_unavailable():
    return HTTPException(
        status_code=503,
        detail=quality["error"] or "The quality model is unavailable",
        headers={"x-error-code": "QUALITY_MODEL_UNAVAILABLE"},
    )


@app.get("/quality/health")
def quality_health(response: Response):
    if quality["classifier"] is None:
        response.status_code = 503
        response.headers["x-error-code"] = "QUALITY_MODEL_UNAVAILABLE"
        return {"status": "unavailable", "message": quality["error"]}
    return quality["classifier"].info()


@app.post("/quality/classify")
def classify_quality_image(
    image: UploadFile = File(..., description="Photo of one cinnamon sample (JPEG or PNG)"),
    sample_id: str | None = Form(None, description="Sample identifier, e.g. CIN-001"),
):
    if quality["classifier"] is None:
        raise _quality_unavailable()
    if sample_id is not None:
        sample_id = sample_id.strip() or None
    if sample_id is not None and not SAMPLE_ID_PATTERN.match(sample_id):
        raise HTTPException(
            status_code=422,
            detail="sample_id may contain letters, numbers, spaces, '.', '_' and '-' (max 64 characters)",
            headers={"x-error-code": "INVALID_SAMPLE_ID"},
        )
    data = image.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=422, detail="The image file is empty",
                            headers={"x-error-code": "INVALID_IMAGE"})
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Images must be {MAX_IMAGE_BYTES // (1024 * 1024)} MB or smaller",
                            headers={"x-error-code": "IMAGE_TOO_LARGE"})
    try:
        return quality["classifier"].classify(data, sample_id=sample_id)
    except InvalidImageError as error:
        raise HTTPException(status_code=422, detail=str(error),
                            headers={"x-error-code": "INVALID_IMAGE"}) from error

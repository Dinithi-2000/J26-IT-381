import os
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from .risk_model_loader import RiskModelError, get_risk_artifact
from .risk_predictor import predict_risk
from .risk_schemas import DEMO_WARNING, RiskRequest, RiskResponse

class RiskValidationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request: Request):
            try:
                return await original(request)
            except RequestValidationError as error:
                # Do not echo input, NaN/Infinity or credentials into error JSON.
                details = [{"loc":list(item["loc"]), "type":item["type"], "msg":item["msg"]} for item in error.errors()]
                return JSONResponse(status_code=422, content={"error":{"code":"RISK_VALIDATION_ERROR","message":"Provide all seven finite numeric features within the documented ranges."},"detail":details})
        return handler

router = APIRouter(tags=["Module 02 synthetic risk"], route_class=RiskValidationRoute)

def risk_auth(x_risk_service_token: str = Header(default="")):
    expected = os.getenv("RISK_SERVICE_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, detail={"code":"RISK_AUTH_UNCONFIGURED","message":"Configure a separate RISK_SERVICE_TOKEN of at least 32 characters."})
    if not secrets.compare_digest(x_risk_service_token.encode(), expected.encode()):
        raise HTTPException(401, detail={"code":"UNAUTHORIZED","message":"A valid risk service token is required."})

def unavailable(error: RiskModelError):
    return HTTPException(503, detail={"code":error.code,"message":str(error)})

@router.get("/risk/health", dependencies=[Depends(risk_auth)])
def risk_health():
    try:
        artifact = get_risk_artifact()
    except RiskModelError as error:
        raise unavailable(error) from None
    return {"status":"ready","model":"CinnaSense Model 02","title":"Storage Deterioration Risk (Synthetic Demo)",
        "model_version":artifact.version,"features":list(artifact.features),"classes":list(artifact.classes),
        "prediction_horizon_days":artifact.horizon_days,"prediction_horizon_verified":artifact.horizon_days is not None,
        "data_origin":"SYNTHETIC_DEMO","validated_for_real_world_use":False,"warning":DEMO_WARNING}

@router.post("/predict-risk", response_model=RiskResponse, dependencies=[Depends(risk_auth)])
def risk_prediction(request: RiskRequest):
    try:
        return predict_risk(request)
    except RiskModelError as error:
        raise unavailable(error) from None

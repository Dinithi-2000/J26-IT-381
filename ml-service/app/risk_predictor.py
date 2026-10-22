from datetime import datetime, timezone
from .risk_model_loader import RiskModelError, get_risk_artifact
from .risk_schemas import RiskRequest, RiskResponse

def predict_risk(request: RiskRequest) -> RiskResponse:
    artifact = get_risk_artifact()
    import pandas as pd
    values = request.model_dump()
    frame = pd.DataFrame([[values[name] for name in artifact.features]], columns=list(artifact.features))
    try:
        predictions = artifact.model.predict(frame)
        if len(predictions) != 1 or str(predictions[0]) not in artifact.classes:
            raise ValueError("Unexpected class output")
        category = str(predictions[0])
    except Exception as error:
        raise RiskModelError("RISK_INFERENCE_FAILED", "Model 02 could not produce a valid demonstration category.") from error
    return RiskResponse(
        model_version=artifact.version, predicted_risk=category,
        prediction_horizon_days=artifact.horizon_days,
        prediction_horizon_verified=artifact.horizon_days is not None,
        horizon_note="Horizon supplied by artifact metadata; not scientifically validated." if artifact.horizon_days is not None else "No prediction horizon metadata is present. This output is not a verified seven-day forecast.",
        predicted_at=datetime.now(timezone.utc).isoformat(),
    )

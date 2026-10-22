from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

DEMO_WARNING = "Demonstration risk prediction based on synthetic training data. Not validated for real-world cinnamon safety or quality assessment."

class RiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    storage_day: int = Field(ge=0, le=3650)
    temperature_c: float = Field(ge=-40, le=85)
    humidity_percent: float = Field(ge=0, le=100)
    weight_g: float = Field(gt=0, le=10000)
    color_r: float = Field(ge=0, le=255)
    color_g: float = Field(ge=0, le=255)
    color_b: float = Field(ge=0, le=255)

class RiskResponse(BaseModel):
    model: Literal["CinnaSense Model 02"] = "CinnaSense Model 02"
    title: Literal["Storage Deterioration Risk (Synthetic Demo)"] = "Storage Deterioration Risk (Synthetic Demo)"
    model_version: str
    predicted_risk: Literal["Low", "Medium", "High"]
    prediction_horizon_days: int | None = None
    prediction_horizon_verified: bool = False
    horizon_note: str
    data_origin: Literal["SYNTHETIC_DEMO"] = "SYNTHETIC_DEMO"
    validated_for_real_world_use: Literal[False] = False
    warning: str = DEMO_WARNING
    predicted_at: str

from datetime import date
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    date: date
    district: str = Field(min_length=1, max_length=100)
    grade: str = Field(min_length=1, max_length=100)


class PredictionResponse(BaseModel):
    prediction: float
    currency: str
    unit: str
    modelVersion: str
    input: PredictionRequest

from datetime import date
import pandas as pd


def build_features(request_date: date, district: str, grade: str, columns: list[str]):
    frame = pd.DataFrame([{
        "Year": request_date.year,
        "Month": request_date.month,
        "Day": request_date.day,
        "District": district,
        "Grade": grade,
    }])
    frame = pd.get_dummies(frame, columns=["District", "Grade"], prefix=["District", "Grade"])
    return frame.reindex(columns=columns, fill_value=0)


def predict(model, columns, request_date: date, district: str, grade: str) -> float:
    value = float(model.predict(build_features(
        request_date, district, grade, columns
    ))[0])
    if value < 0:
        raise ValueError("Model returned an invalid negative price")
    return value

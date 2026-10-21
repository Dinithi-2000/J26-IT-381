import os
import pickle
from pathlib import Path


class ModelUnavailableError(RuntimeError):
    pass


def load_artifacts():
    project_root = Path(__file__).resolve().parents[2]
    model_path = Path(os.getenv(
        "MODEL_PATH",
        project_root / "server" / "ml" / "cinnamon_price_xgb_model.pkl",
    ))
    columns_path = Path(os.getenv(
        "COLUMNS_PATH",
        project_root / "server" / "ml" / "model_columns.pkl",
    ))
    try:
        with model_path.open("rb") as model_file:
            model = pickle.load(model_file)
        with columns_path.open("rb") as columns_file:
            columns = pickle.load(columns_file)
    except (OSError, pickle.PickleError, EOFError, MemoryError, ValueError) as error:
        raise ModelUnavailableError(
            f"Unable to load model artifacts from {model_path} and {columns_path}: {error}"
        ) from error

    if not hasattr(model, "predict") or not isinstance(columns, (list, tuple)):
        raise ModelUnavailableError("Model artifacts do not contain a predictor and feature columns")
    return model, list(columns)

"""Load only a locally configured, trusted joblib artifact in its compatible runtime.

joblib/pickle can execute code: no upload or client-supplied model path is accepted.
"""
from dataclasses import dataclass
from functools import lru_cache
import hashlib
import os
from pathlib import Path
import threading

FEATURES = ("storage_day", "temperature_c", "humidity_percent", "weight_g", "color_r", "color_g", "color_b")
RISK_CLASSES = frozenset({"Low", "Medium", "High"})
ROOT = Path(__file__).resolve().parents[1]
_lock = threading.Lock()

class RiskModelError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

@dataclass(frozen=True)
class RiskArtifact:
    model: object
    features: tuple
    classes: tuple
    version: str
    sha256: str
    horizon_days: int | None

@lru_cache(maxsize=1)
def _load_artifact():
    configured = Path(os.getenv("RISK_MODEL_PATH", "models/cinnasense_model02_demo.joblib")).expanduser()
    path = configured if configured.is_absolute() else ROOT / configured
    if path.suffix.lower() != ".joblib" or not path.is_file():
        raise RiskModelError("RISK_MODEL_UNAVAILABLE", "Place the trusted Model 02 joblib artifact at RISK_MODEL_PATH.")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    expected = os.getenv("RISK_MODEL_SHA256", "").strip().lower()
    if expected and expected != digest:
        raise RiskModelError("RISK_MODEL_CHECKSUM_MISMATCH", "Model 02 checksum does not match its configured provenance.")
    try:
        import sklearn
        if sklearn.__version__ != "1.6.1":
            raise RiskModelError("RISK_RUNTIME_INCOMPATIBLE", "Run Model 02 using ml-service/.venv with scikit-learn 1.6.1; do not change the Model 01 environment.")
        import joblib
        from sklearn.ensemble import RandomForestClassifier
        artifact = joblib.load(path)
    except RiskModelError:
        raise
    except Exception as error:
        raise RiskModelError("RISK_MODEL_UNAVAILABLE", "Cannot load the trusted Model 02 artifact. Check its file and compatible runtime.") from error
    if not isinstance(artifact, dict) or not all(key in artifact for key in ["model", "features", "classes", "data_origin"]):
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "Model 02 must contain model, features, classes and data_origin metadata.")
    model = artifact["model"]
    try:
        features = tuple(artifact["features"])
        classes = tuple(artifact["classes"])
        feature_names = tuple(getattr(model, "feature_names_in_", FEATURES))
        estimator_classes = tuple(model.classes_)
    except (TypeError, AttributeError) as error:
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "Model 02 feature/class metadata is invalid.") from error
    if not isinstance(model, RandomForestClassifier) or features != FEATURES or feature_names != features or getattr(model,"n_features_in_",None) != len(FEATURES):
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "Model 02 feature order or estimator type does not match the inspected seven-feature model.")
    if len(classes) != 3 or frozenset(classes) != RISK_CLASSES or classes != estimator_classes:
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "Model 02 class order must match its trained estimator: Low, Medium and High labels.")
    if artifact["data_origin"] != "SYNTHETIC_DEMO":
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "This endpoint accepts only the explicitly identified SYNTHETIC_DEMO model.")
    # Missing provenance never becomes an assumed seven-day forecast.
    horizons = [artifact[key] for key in ("prediction_horizon_days", "horizon_days") if key in artifact]
    if horizons and (any(type(value) is not int or not 1 <= value <= 365 for value in horizons) or len(set(horizons)) != 1):
        raise RiskModelError("RISK_MODEL_METADATA_INVALID", "Prediction horizon metadata is invalid or inconsistent.")
    return RiskArtifact(model=model, features=features, classes=classes, version=f"random-forest-demo-{digest[:12]}", sha256=digest, horizon_days=horizons[0] if horizons else None)

def get_risk_artifact():
    # lru_cache alone may execute simultaneous first loads; serialize the cache access.
    with _lock:
        return _load_artifact()

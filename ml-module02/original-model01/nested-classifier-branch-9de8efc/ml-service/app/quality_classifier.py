"""Module 02 / Model 01: visible quality condition of stored cinnamon (MobileNetV2).

Images must be processed exactly as in the training notebook, otherwise the reported
test accuracy no longer describes what the service does. The steps are recorded in
models/quality_model01/model_metadata.json:

    EXIF orientation -> RGB -> downscale to max side 640 (Lanczos) -> JPEG quality 95
    -> TensorFlow JPEG decode -> resize with padding to 224 x 224 (antialias)
    -> model (scaling to [-1, 1] happens inside the model)
"""
import io
import json
import threading
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

SRI_LANKA_TIME = ZoneInfo("Asia/Colombo")
DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "quality_model01"
MOLD_WORDS = ("mold", "mould", "fung")


class QualityModelUnavailableError(RuntimeError):
    pass


class InvalidImageError(ValueError):
    pass


def display_label(class_name: str) -> str:
    """'Suspected_Mold' -> 'Suspected mold'."""
    text = class_name.replace("_", " ").strip()
    return text[:1].upper() + text[1:].lower()


class QualityClassifier:
    def __init__(self, model_dir: Path = DEFAULT_MODEL_DIR):
        model_dir = Path(model_dir)
        if not model_dir.is_absolute():  # relative to ml-service/, whatever the working directory
            model_dir = Path(__file__).resolve().parents[1] / model_dir
        try:
            self.meta = json.loads((model_dir / "model_metadata.json").read_text(encoding="utf-8"))
            import tensorflow as tf  # heavy import, only needed when the model is used

            self._tf = tf
            self.model = tf.keras.models.load_model(model_dir / self.meta["model_file"], compile=False)
        except Exception as error:  # any failure means the model cannot be served
            raise QualityModelUnavailableError(
                f"Unable to load the quality model from {model_dir}: {type(error).__name__}: {error}"
            ) from error

        self.classes = list(self.meta["classes"])
        self.image_size = int(self.meta["image_size"])
        self.preprocessing = self.meta["preprocessing"]
        self.version = self.meta["model_version"]
        if self.model.output_shape[-1] != len(self.classes):
            raise QualityModelUnavailableError(
                f"Model has {self.model.output_shape[-1]} outputs but metadata lists {len(self.classes)} classes"
            )
        self._lock = threading.Lock()
        self._predict(np.zeros((1, self.image_size, self.image_size, 3), dtype="float32"))  # warm-up

    # ------------------------------------------------------------------ preprocessing
    def prepare_image(self, data: bytes) -> tuple[np.ndarray, tuple[int, int]]:
        """Raw image bytes -> (uint8 array image_size x image_size x 3, original (width, height))."""
        try:
            image = Image.open(io.BytesIO(data))
            image = ImageOps.exif_transpose(image).convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
            raise InvalidImageError("The uploaded file is not a readable image.") from error
        original_size = image.size
        max_side = int(self.preprocessing["max_side_before_resize"])
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=int(self.preprocessing["jpeg_quality"]))

        tf = self._tf
        pixels = tf.io.decode_jpeg(buffer.getvalue(), channels=3)
        size, antialias = self.image_size, bool(self.preprocessing["antialias"])
        if self.preprocessing["resize_mode"] == "pad":
            pixels = tf.image.resize_with_pad(pixels, size, size, antialias=antialias)
        else:
            pixels = tf.image.resize(pixels, [size, size], antialias=antialias)
        pixels = tf.cast(tf.clip_by_value(tf.round(pixels), 0, 255), tf.uint8)
        return pixels.numpy(), original_size

    def _predict(self, batch: np.ndarray) -> np.ndarray:
        with self._lock:
            return self.model(batch, training=False).numpy()

    # ------------------------------------------------------------------ public API
    def classify(self, data: bytes, sample_id: str | None = None, top_k: int = 3) -> dict:
        pixels, (width, height) = self.prepare_image(data)
        probabilities = self._predict(pixels[None].astype("float32"))[0]
        order = np.argsort(probabilities)[::-1]
        best = self.classes[int(order[0])]
        suspected_mold = any(word in best.lower() for word in MOLD_WORDS)
        result = {
            "sampleId": sample_id,
            "predictedCondition": best,
            "predictedLabel": display_label(best),
            "modelScore": round(float(probabilities[order[0]]), 4),
            "topPredictions": [
                {
                    "condition": self.classes[int(i)],
                    "label": display_label(self.classes[int(i)]),
                    "score": round(float(probabilities[int(i)]), 4),
                }
                for i in order[:top_k]
            ],
            "suspectedMold": suspected_mold,
            "analysedAt": datetime.now(SRI_LANKA_TIME).isoformat(timespec="seconds"),
            "analysisStatus": "Completed",
            "modelVersion": self.version,
            "image": {"width": width, "height": height},
        }
        if suspected_mold:
            result["note"] = "Image-based indication only. Confirm mould physically or in a laboratory."
        return result

    def info(self) -> dict:
        metrics = self.meta.get("test_metrics", {})
        return {
            "status": "ok",
            "modelVersion": self.version,
            "architecture": self.meta.get("architecture"),
            "classes": [{"condition": c, "label": display_label(c)} for c in self.classes],
            "imageSize": self.image_size,
            "trainedAt": self.meta.get("created_at"),
            "testMetrics": {
                "testImages": metrics.get("test_images"),
                "accuracy": metrics.get("accuracy"),
                "accuracy95ci": metrics.get("accuracy_95ci"),
                "macroF1": metrics.get("macro_f1"),
                "macroF1_95ci": metrics.get("macro_f1_95ci"),
                "majorityBaselineAccuracy": metrics.get("majority_class_baseline_accuracy"),
                "perClass": metrics.get("per_class"),
            },
            "imagesPerSplit": self.meta.get("data", {}).get("images_per_split"),
            "caveats": [c.replace("'model_score'", "The model score") for c in self.meta.get("caveats", [])],
        }

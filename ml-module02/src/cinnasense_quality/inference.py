import hashlib
import io
import json
import threading
from pathlib import Path
from .dataset import LABELS

class ModelUnavailable(RuntimeError): pass
class InvalidImage(ValueError): pass

class Classifier:
    def __init__(self, directory):
        self.directory=Path(directory);self.model=None;self.metadata=None;self.lock=threading.Lock()
    def load(self):
        model_file=self.directory/"model.keras"
        try:
            metadata=json.loads((self.directory/"metadata.json").read_text(encoding="utf-8"))
            if metadata.get("classes") != sorted(LABELS.values()) or metadata.get("preprocessing") != "embedded_mobilenet_v2_minus1_to1": raise ValueError("Invalid class/preprocessing contract")
            if hashlib.sha256(model_file.read_bytes()).hexdigest()!=metadata["model_sha256"]: raise ValueError("Artifact hash mismatch")
            if not metadata.get("model_version") or not metadata.get("trained_at"): raise ValueError("Missing provenance")
            evaluation=json.loads((self.directory/"evaluation.json").read_text(encoding="utf-8"))
            if evaluation.get("classes") != metadata["classes"]: raise ValueError("Evaluation class mismatch")
            import tensorflow as tf
            self.model=tf.keras.models.load_model(model_file,compile=False,safe_mode=True)
            if self.model.input_shape[1:]!=(224,224,3) or self.model.output_shape[-1]!=len(metadata["classes"]): raise ValueError("Invalid model shape")
            self.metadata=metadata
        except Exception as error:
            self.model=None;self.metadata=None
            raise ModelUnavailable("A compatible trained artifact and evaluation report are not available.") from error
    def predict(self, data):
        if self.model is None: raise ModelUnavailable("No trained image-condition model is loaded.")
        import numpy as np
        from PIL import Image, ImageOps, UnidentifiedImageError
        try:
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG","PNG"} or image.width*image.height > 20000000: raise InvalidImage("JPEG/PNG image exceeds format or pixel limits.")
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                pixels=np.asarray(ImageOps.exif_transpose(image).convert("RGB").resize((224,224),Image.Resampling.BILINEAR),dtype=np.float32)[None,...]
        except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError) as error:
            raise InvalidImage("Cannot decode a valid JPEG/PNG image within the pixel limit.") from error
        with self.lock:
            scores=np.asarray(self.model(pixels,training=False))[0]
        if not np.isfinite(scores).all() or (scores<0).any() or (scores>1).any() or not np.isclose(scores.sum(),1,atol=1e-4): raise ModelUnavailable("Model returned invalid classification scores.")
        winner=int(scores.argmax())
        return {"predictedCondition":self.metadata["classes"][winner],"modelScore":float(scores[winner]),"scores":{label:float(score) for label,score in zip(self.metadata["classes"],scores)},"modelVersion":self.metadata["model_version"],"prototype":True,"scoreInterpretation":"Uncalibrated classification score; not confidence or probability of confirmed mold.","limitations":"Two-class visual prototype. Does not assess discoloration, physical damage, future degradation, or confirm fungal contamination. Non-cinnamon inputs and ESP32-CAM domain shifts are not validated."}

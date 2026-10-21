"""Inference for the existing reviewed pipeline and externally trained Colab model."""
import hashlib
import io
import json
import threading
from pathlib import Path
from .dataset import LABELS

COLAB_CLASSES = ["Suspected Mold", "good_quality"]
class ModelUnavailable(RuntimeError): pass
class InvalidImage(ValueError): pass

def preprocess_image(data):
    """RGB float32 [0,255]. Normalization belongs to the saved model."""
    import numpy as np
    from PIL import Image, ImageOps, UnidentifiedImageError
    if not data or len(data) > 5 * 1024 * 1024:
        raise InvalidImage("Supply a JPEG/PNG image no larger than 5 MiB.")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG"} or image.width * image.height > 20000000:
                raise InvalidImage("JPEG/PNG image exceeds format or pixel limits.")
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB").resize((224,224), Image.Resampling.BILINEAR)
            return np.asarray(image, dtype=np.float32)[None,...]
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, EOFError, Image.DecompressionBombError) as error:
        raise InvalidImage("Cannot decode a valid JPEG/PNG image within the pixel limit.") from error

class Classifier:
    def __init__(self, directory=None, *, model_path=None, class_names_path=None, model_version=None, loader=None):
        self.directory = Path(directory) if directory is not None else None
        self.model_path = Path(model_path) if model_path else None
        self.class_names_path = Path(class_names_path) if class_names_path else None
        self.model_version = model_version
        self.loader = loader
        self.model = None
        self.metadata = None
        self.lock = threading.Lock()
        self.failure_code = 'MODEL_UNAVAILABLE'
    def load(self):
        try:
            if self.model_path is not None:
                model_file = self.model_path
                if not self.class_names_path or not model_file.is_file() or model_file.suffix != '.keras':
                    raise ModelUnavailable('Place the .keras model and class_names.json at the configured paths.')
                classes = json.loads(self.class_names_path.read_text(encoding='utf-8-sig'))
                if classes != COLAB_CLASSES:
                    self.failure_code = 'MODEL_LABELS_INVALID'
                    raise ValueError('Colab class_names.json must retain the documented training order.')
                fingerprint = hashlib.sha256(model_file.read_bytes()).hexdigest()[:12]
                metadata = {'classes': classes, 'model_version': self.model_version or f'mobilenetv2-{fingerprint}', 'prototype':True}
            else:
                if self.directory is None: raise ModelUnavailable('Configure a model path.')
                model_file = self.directory / 'model.keras'
                metadata = json.loads((self.directory/'metadata.json').read_text(encoding='utf-8'))
                if metadata.get('classes') != sorted(LABELS.values()) or metadata.get('preprocessing') != 'embedded_mobilenet_v2_minus1_to1':
                    raise ValueError('Invalid legacy class/preprocessing contract')
                if hashlib.sha256(model_file.read_bytes()).hexdigest() != metadata['model_sha256']: raise ValueError('Artifact hash mismatch')
                if not metadata.get('model_version') or not metadata.get('trained_at'): raise ValueError('Missing provenance')
                evaluation = json.loads((self.directory/'evaluation.json').read_text(encoding='utf-8'))
                if evaluation.get('classes') != metadata['classes']: raise ValueError('Evaluation class mismatch')
            loader = self.loader
            if loader is None:
                import tensorflow as tf
                loader = tf.keras.models.load_model
            model = loader(model_file, compile=False, safe_mode=True)
            if tuple(model.input_shape[1:]) != (224,224,3) or model.output_shape[-1] != len(metadata['classes']):
                self.failure_code = 'MODEL_SHAPE_INVALID'
                raise ValueError('Invalid model shape')
            self.model, self.metadata = model, metadata
            self.failure_code = None
        except Exception as error:
            self.model = None; self.metadata = None
            self.failure_code = self.failure_code or 'MODEL_UNAVAILABLE'
            raise ModelUnavailable('Cannot load the configured model/class labels. Check file paths, class order and TensorFlow/Keras compatibility.') from error
    def predict(self, data):
        if self.model is None: raise ModelUnavailable('No trained image-condition model is loaded.')
        import numpy as np
        pixels = preprocess_image(data)
        try:
            with self.lock: scores = np.asarray(self.model(pixels, training=False))
        except Exception as error:
            raise ModelUnavailable('The configured model could not process this image. Check its preprocessing and runtime compatibility.') from error
        classes = self.metadata['classes']
        if scores.shape != (1,len(classes)) or not np.isfinite(scores).all() or (scores<0).any() or (scores>1).any() or not np.isclose(scores.sum(),1,atol=1e-4):
            raise ModelUnavailable('Model returned invalid classification scores.')
        scores = scores[0]; winner = int(scores.argmax())
        return {'predictedCondition':classes[winner], 'modelScore':float(scores[winner]), 'scores':{label:float(score) for label,score in zip(classes,scores)},
            'modelVersion':self.metadata['model_version'], 'prototype':True,
            'scoreInterpretation':'Uncalibrated model score; not a verified probability of mold.',
            'limitations':'Visual prototype only. Suspected Mold requires independent confirmation. This is not food-safety certification or future degradation prediction.'}

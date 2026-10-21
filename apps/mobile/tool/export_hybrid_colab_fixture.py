"""Run in Colab to export real Hybrid V2 reference inputs and all probabilities.
No expected prediction is assumed. Requires numpy, Pillow and TensorFlow.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import numpy as np
from PIL import Image, ImageOps, __version__ as pillow_version
import tensorflow as tf

parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
parser.add_argument('--config', required=True)
parser.add_argument('--side', required=True)
parser.add_argument('--end', required=True)
parser.add_argument('--diameter-mm', required=True, type=float)
parser.add_argument('--output', required=True)
args = parser.parse_args()
config = json.loads(Path(args.config).read_text())
destination = Path(args.output)
destination.mkdir(parents=True, exist_ok=True)

def preprocess(path):
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image = ImageOps.pad(image, (224,224), method=Image.Resampling.BILINEAR, color=(255,255,255))
        return np.asarray(image, dtype=np.float32)[None, ...]

side = preprocess(args.side)
end = preprocess(args.end)
diameter = np.asarray([[(args.diameter_mm - config['diameter_mean']) / config['diameter_std']]], dtype=np.float32)
interpreter = tf.lite.Interpreter(model_path=args.model, num_threads=2)
interpreter.allocate_tensors()
values = {'serving_default_side_image:0': side,
          'serving_default_diameter:0': diameter,
          'serving_default_end_image:0': end}
for tensor in interpreter.get_input_details():
    assert tensor['name'] in values, tensor
    value = values[tensor['name']]
    assert tensor['dtype'] == np.float32 and list(tensor['shape']) == list(value.shape), tensor
    interpreter.set_tensor(tensor['index'], value)
interpreter.invoke()
outputs = interpreter.get_output_details()
assert len(outputs) == 1 and list(outputs[0]['shape']) == [1,7]
probabilities = interpreter.get_tensor(outputs[0]['index'])[0]
side_name = 'side' + Path(args.side).suffix
end_name = 'end' + Path(args.end).suffix
shutil.copyfile(args.side, destination / side_name)
shutil.copyfile(args.end, destination / end_name)
side.astype('<f4').tofile(destination / 'side.f32')
end.astype('<f4').tofile(destination / 'end.f32')
manifest = {
    'model_sha256': hashlib.sha256(Path(args.model).read_bytes()).hexdigest(),
    'pillow_version': pillow_version, 'tensorflow_version': tf.__version__,
    'class_names': config['class_names'],
    'diameter_mean': config['diameter_mean'], 'diameter_std': config['diameter_std'],
    'diameter_mm': args.diameter_mm,
    'normalized_diameter': float(diameter[0,0]),
    'side': side_name, 'end': end_name,
    'side_tensor': 'side.f32', 'end_tensor': 'end.f32',
    'probabilities': [float(value) for value in probabilities],
}
(destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Exported real input tensors and seven probabilities to', destination)

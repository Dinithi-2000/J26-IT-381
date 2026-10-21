"""Generate synthetic preprocessing goldens with the exact supplied Colab PIL code.
These are NOT model probability fixtures and do not measure grading accuracy.
Usage: python tool/generate_hybrid_preprocessing_fixtures.py
Requires Pillow; alternatively uses the workspace-local .tools/pillow install.
"""
from pathlib import Path
import json
import sys
root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / '.tools/pillow'))
from PIL import Image, ImageOps, __version__

destination = Path(__file__).resolve().parents[1] / 'test/fixtures/hybrid_preprocessing'
destination.mkdir(parents=True, exist_ok=True)
manifest = {'pillow_version': __version__, 'preprocessing': 'exif_transpose -> RGB -> ImageOps.pad BILINEAR white 224x224', 'cases': []}

def pattern(width, height, mode='RGB'):
    image = Image.new(mode, (width, height))
    for y in range(height):
        for x in range(width):
            value = ((x * 7 + y * 3) % 256, (x * 2 + y * 5) % 256, (x * 11 + y) % 256)
            if mode == 'RGBA':
                value += ((x + y) % 256,)
            image.putpixel((x, y), value)
    return image

def record(name, image, orientation=None, png_exif=False):
    filename = name + ('.jpg' if orientation and not png_exif else '.png')
    if orientation:
        exif = Image.Exif()
        exif[274] = orientation
        image.save(destination / filename, quality=95, subsampling=0, exif=exif)
    else:
        image.save(destination / filename)
    with Image.open(destination / filename) as source:
        source = ImageOps.exif_transpose(source).convert('RGB')
        expected = ImageOps.pad(source, (224, 224), method=Image.Resampling.BILINEAR, color=(255,255,255))
        expected.save(destination / (name + '_expected.png'))
    manifest['cases'].append({'input': filename, 'expected': name + '_expected.png',
        'max_channel_error': 3 if orientation and not png_exif else 0,
        'note': 'JPEG decoder rounding tolerance; all orientations tested' if orientation and not png_exif else 'Exact PIL RGB bytes'})

for name, width, height, mode in [
    ('wide_downsample', 479, 131, 'RGB'),
    ('tall_downsample', 83, 311, 'RGB'),
    ('small_upsample', 13, 7, 'RGB'),
    ('alpha_discard', 225, 130, 'RGBA'),
    ('square', 224, 224, 'RGB'),
]:
    record(name, pattern(width, height, mode))
for orientation in range(1, 9):
    record('orientation_' + str(orientation), pattern(120, 80), orientation)
    record('orientation_png_' + str(orientation), pattern(120, 80), orientation, png_exif=True)
(destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Generated', len(manifest['cases']), 'PIL preprocessing cases, Pillow', __version__)

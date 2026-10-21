import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

import 'hybrid_config.dart';

/// PIL ImageOps.exif_transpose(...).convert("RGB"), followed by
/// ImageOps.pad((224,224), BILINEAR, color=(255,255,255)).
/// Uses the separable, antialiased PIL bilinear kernel, including per-pass
/// 8-bit rounding, rather than a non-antialiased four-neighbour resize.
class HybridImagePreprocessor {
  static const size = 224;
  static const _precision = 1 << 22;

  static int _roundEven(double value) {
    final lower = value.floor();
    final fraction = value - lower;
    if (fraction == 0.5) return lower.isEven ? lower : lower + 1;
    return value.round();
  }

  static Float32List preprocess(Uint8List bytes) {
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded == null) throw const FormatException();
      _readPngOrientation(bytes, decoded);
      final oriented = img.bakeOrientation(decoded);
      // PIL convert("RGB") discards alpha, without compositing over white.
      final rgb = oriented.convert(format: img.Format.uint8, numChannels: 3);
      var width = size;
      var height = size;
      if (rgb.width > rgb.height) {
        height = math.max(1, _roundEven(rgb.height / rgb.width * size));
      } else if (rgb.height > rgb.width) {
        width = math.max(1, _roundEven(rgb.width / rgb.height * size));
      }
      // Avoid a boxed integer list for full-resolution camera images.
      var pixels = Uint8List(rgb.width * rgb.height * 3);
      var offset = 0;
      for (final pixel in rgb) {
        pixels[offset++] = pixel.r.toInt();
        pixels[offset++] = pixel.g.toInt();
        pixels[offset++] = pixel.b.toInt();
      }
      // Pillow 13 chooses the smaller intermediate when vertical reduction
      // dominates. Per-pass uint8 rounding makes pass order observable.
      final verticalReduction = rgb.height - height;
      if (verticalReduction > 0 &&
          verticalReduction > 2 * (rgb.width - width)) {
        pixels = _resizeAxis(pixels, rgb.width, rgb.height, height, false);
        pixels = _resizeAxis(pixels, rgb.width, height, width, true);
      } else {
        pixels = _resizeAxis(pixels, rgb.width, rgb.height, width, true);
        pixels = _resizeAxis(pixels, width, rgb.height, height, false);
      }
      final output = Float32List(size * size * 3)
        ..fillRange(0, size * size * 3, 255);
      final left = _roundEven((size - width) / 2);
      final top = _roundEven((size - height) / 2);
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width * 3; x++) {
          output[((y + top) * size + left) * 3 + x] = pixels[y * width * 3 + x]
              .toDouble();
        }
      }
      return output;
    } catch (_) {
      throw const HybridException(
        'Could not read or preprocess a photo. Retake clear side and end photos.',
      );
    }
  }

  static void _readPngOrientation(Uint8List bytes, img.Image image) {
    // image 4.12 does not yet decode the PNG eXIf chunk itself.
    if (bytes.length < 8 ||
        bytes[0] != 137 ||
        String.fromCharCodes(bytes.sublist(1, 4)) != 'PNG') {
      return;
    }
    final data = ByteData.sublistView(bytes);
    var offset = 8;
    while (offset + 12 <= bytes.length) {
      final length = data.getUint32(offset);
      if (offset + length + 12 > bytes.length) throw const FormatException();
      if (String.fromCharCodes(bytes.sublist(offset + 4, offset + 8)) ==
          'eXIf') {
        image.exif = img.ExifData.fromInputBuffer(
          img.InputBuffer(bytes.sublist(offset + 8, offset + 8 + length)),
        );
        return;
      }
      offset += length + 12;
    }
  }

  static Uint8List _resizeAxis(
    Uint8List pixels,
    int width,
    int height,
    int target,
    bool horizontal,
  ) {
    final inputSize = horizontal ? width : height;
    if (inputSize == target) return pixels;
    final outputWidth = horizontal ? target : width;
    final outputHeight = horizontal ? height : target;
    final output = Uint8List(outputWidth * outputHeight * 3);
    final scale = inputSize / target;
    final support = math.max(1.0, scale);
    final inverseScale = 1.0 / support;
    for (var pos = 0; pos < target; pos++) {
      final center = (pos + 0.5) * scale;
      final start = math.max(0, (center - support + 0.5).toInt());
      final end = math.min(inputSize, (center + support + 0.5).toInt());
      final weights = <double>[
        for (var i = start; i < end; i++)
          math.max(0.0, 1 - ((i - center + 0.5) * inverseScale).abs()),
      ];
      final sum = weights.fold<double>(0, (a, b) => a + b);
      final fixed = weights
          .map((v) => (v / sum * _precision + 0.5).toInt())
          .toList();
      final lines = horizontal ? height : width;
      for (var line = 0; line < lines; line++) {
        for (var channel = 0; channel < 3; channel++) {
          var total = _precision ~/ 2;
          for (var i = start; i < end; i++) {
            final source = horizontal
                ? (line * width + i) * 3
                : (i * width + line) * 3;
            total += pixels[source + channel] * fixed[i - start];
          }
          final destination = horizontal
              ? (line * outputWidth + pos) * 3
              : (pos * width + line) * 3;
          output[destination + channel] = (total >> 22).clamp(0, 255);
        }
      }
    }
    return output;
  }
}

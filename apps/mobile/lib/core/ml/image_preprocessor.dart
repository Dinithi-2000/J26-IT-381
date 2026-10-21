import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import 'model_config.dart';

class PreprocessedImage {
  final List<List<List<List<double>>>> tensor;
  final int width;
  final int height;
  const PreprocessedImage({
    required this.tensor,
    required this.width,
    required this.height,
  });
}

/// Decode, center-crop and resize RGB to the Teachable Machine input contract.
class ImagePreprocessor {
  final int targetWidth;
  final int targetHeight;
  final double normalisationDivisor;
  final double normalisationOffset;
  const ImagePreprocessor({
    this.targetWidth = ModelInputConfig.defaultWidth,
    this.targetHeight = ModelInputConfig.defaultHeight,
    this.normalisationDivisor = ModelInputConfig.normalisationDivisor,
    this.normalisationOffset = ModelInputConfig.normalisationOffset,
  });

  Future<PreprocessedImage> preprocess(Uint8List imageBytes) async {
    final codec = await ui.instantiateImageCodec(imageBytes);
    ui.Image? decoded;
    ui.Image? resized;
    ui.Picture? picture;
    try {
      decoded = (await codec.getNextFrame()).image;
      final aspect = targetWidth / targetHeight;
      final cropWidth = decoded.width / decoded.height > aspect
          ? decoded.height * aspect
          : decoded.width.toDouble();
      final cropHeight = cropWidth / aspect;
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      canvas.drawImageRect(
        decoded,
        ui.Rect.fromLTWH(
          (decoded.width - cropWidth) / 2,
          (decoded.height - cropHeight) / 2,
          cropWidth,
          cropHeight,
        ),
        ui.Rect.fromLTWH(0, 0, targetWidth.toDouble(), targetHeight.toDouble()),
        ui.Paint()..filterQuality = ui.FilterQuality.high,
      );
      picture = recorder.endRecording();
      resized = await picture.toImage(targetWidth, targetHeight);
      final data = await resized.toByteData(format: ui.ImageByteFormat.rawRgba);
      if (data == null ||
          data.lengthInBytes != targetWidth * targetHeight * 4) {
        throw StateError('Unexpected decoded image dimensions.');
      }
      final pixels = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );
      final tensor = [
        List.generate(
          targetHeight,
          (y) => List.generate(targetWidth, (x) {
            final offset = (y * targetWidth + x) * 4;
            return List.generate(
              3,
              (channel) =>
                  pixels[offset + channel] / normalisationDivisor -
                  normalisationOffset,
            );
          }),
        ),
      ];
      return PreprocessedImage(
        tensor: tensor,
        width: targetWidth,
        height: targetHeight,
      );
    } finally {
      resized?.dispose();
      picture?.dispose();
      decoded?.dispose();
      codec.dispose();
    }
  }
}

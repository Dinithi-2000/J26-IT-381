import 'dart:convert';

import 'hybrid_config.dart';

class DiameterException implements Exception {
  final String message;
  const DiameterException(this.message);
  @override
  String toString() => message;
}

enum DiameterSource { aiEstimated, caliperMeasured }

extension DiameterSourceValue on DiameterSource {
  String get databaseValue => switch (this) {
    DiameterSource.aiEstimated => 'ai_estimated',
    DiameterSource.caliperMeasured => 'caliper_measured',
  };
}

class DiameterEstimate {
  final double diameterMm;
  final String modelVersion;
  const DiameterEstimate({
    required this.diameterMm,
    required this.modelVersion,
  });
}

class DiameterConfig {
  static const modelAsset = 'assets/models/quillgrade_diameter_v1.tflite';
  static const configAsset = 'assets/models/diameter_config_v1.json';
  final String version;
  final double targetMean;
  final double targetStd;
  const DiameterConfig._(this.version, this.targetMean, this.targetStd);

  factory DiameterConfig.parse(String source) {
    try {
      final json = jsonDecode(source) as Map<String, dynamic>;
      final mean = (json['target_mean'] as num).toDouble();
      final std = (json['target_std'] as num).toDouble();
      final size = json['image_size'];
      if (json['model_version'] != 'diameter_v1' ||
          size is! List ||
          size.length != 2 ||
          size[0] != 224 ||
          size[1] != 224 ||
          json['image_pixel_range'] != '0-255' ||
          json['target_unit'] != 'mm' ||
          json['output'] != 'normalized_diameter' ||
          json['preprocessing'] !=
              'EXIF transpose, RGB, PIL ImageOps.pad BILINEAR white' ||
          json['experimental'] != true ||
          !mean.isFinite ||
          !std.isFinite ||
          std <= 0) {
        throw const FormatException('Incompatible diameter configuration');
      }
      return DiameterConfig._(json['model_version'] as String, mean, std);
    } catch (_) {
      throw const DiameterException(
        'Diameter model configuration is invalid. Please reinstall the model or use a caliper.',
      );
    }
  }

  DiameterEstimate decodeOutput(List<double> output) {
    if (output.length != 1 || !output.single.isFinite) {
      throw const DiameterException(
        'Diameter model returned an invalid estimate. Please retry or use a caliper.',
      );
    }
    // A negative normalized output can represent a valid, below-mean diameter.
    final mm = output.single * targetStd + targetMean;
    if (HybridConfig.diameterError(mm) != null) {
      throw const DiameterException(
        'Diameter estimate is not a valid positive millimeter value. Please retake the photo or use a caliper.',
      );
    }
    return DiameterEstimate(diameterMm: mm, modelVersion: version);
  }
}

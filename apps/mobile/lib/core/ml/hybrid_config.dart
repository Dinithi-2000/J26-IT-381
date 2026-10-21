import 'dart:convert';

import 'package:flutter/foundation.dart';

class HybridException implements Exception {
  final String message;
  const HybridException(this.message);
  @override
  String toString() => message;
}

class HybridConfig {
  static const modelAsset = 'assets/models/quillgrade_hybrid_v2.tflite';
  static const configAsset = 'assets/models/hybrid_config_v2.json';
  static const expectedClasses = [
    'ALBA',
    'C4',
    'C5',
    'EXTRA',
    'H1',
    'H2',
    'M4',
  ];
  final List<String> classes;
  final double diameterMean;
  final double diameterStd;
  final String version;
  const HybridConfig._(
    this.classes,
    this.diameterMean,
    this.diameterStd,
    this.version,
  );

  factory HybridConfig.parse(String text) {
    try {
      final json = jsonDecode(text) as Map<String, dynamic>;
      final classes = List<String>.from(json['class_names'] as List);
      final mean = (json['diameter_mean'] as num).toDouble();
      final std = (json['diameter_std'] as num).toDouble();
      if (!listEquals(classes, expectedClasses) ||
          !listEquals(List<int>.from(json['image_size'] as List), [224, 224]) ||
          json['image_pixel_range'] != '0-255' ||
          json['model_version'] != 'v2' ||
          !mean.isFinite ||
          !std.isFinite ||
          std <= 0) {
        throw const FormatException();
      }
      return HybridConfig._(
        List.unmodifiable(classes),
        mean,
        std,
        json['model_version'] as String,
      );
    } catch (_) {
      throw const HybridException(
        'Hybrid V2 configuration is missing or incompatible. Please reinstall the model and configuration together.',
      );
    }
  }

  static String? diameterError(double? value) {
    // Positive finite millimeters are valid inputs. No unsupported training
    // range is invented; actual model applicability still requires evaluation.
    if (value == null ||
        !value.isFinite ||
        value <= 0 ||
        value > 3.402823466e38) {
      return 'Enter a finite diameter greater than 0 in millimeters.';
    }
    return null;
  }

  double normalizeDiameter(double value) {
    final error = diameterError(value);
    if (error != null) throw HybridException(error);
    final normalized = (value - diameterMean) / diameterStd;
    if (!normalized.isFinite || normalized.abs() > 3.402823466e38) {
      throw const HybridException(
        'Diameter cannot be represented by the model. Check the millimeter measurement.',
      );
    }
    return normalized;
  }
}

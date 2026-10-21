import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'quill_validator_service_stub.dart'
    if (dart.library.ffi) 'quill_validator_service_native.dart'
    as impl;

final quillValidatorServiceProvider = Provider<QuillValidatorService>((ref) {
  final service = QuillValidatorService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// Output of the quill pre-validation classifier
class QuillValidationResult {
  final String label;
  final double confidence;
  final bool isValidQuill;
  final String? rejectionReason;

  const QuillValidationResult({
    required this.label,
    required this.confidence,
    required this.isValidQuill,
    this.rejectionReason,
  });

  @override
  String toString() =>
      'QuillValidationResult(label: $label, confidence: ${(confidence * 100).toStringAsFixed(1)}%, isValid: $isValidQuill, reason: $rejectionReason)';
}

class QuillValidatorService {
  late final impl.QuillValidatorServiceImpl _impl;

  QuillValidatorService() {
    _impl = impl.QuillValidatorServiceImpl();
  }

  bool get isInitialized => _impl.isInitialized;

  /// Loads the model or initializes platform delegate
  Future<void> initialize() => _impl.initialize();

  /// Classifies raw captured image bytes before writing to persistent storage
  Future<QuillValidationResult> validateImageBuffer(
    Uint8List imageBytes, {
    bool isEndCut = false,
    String? forcedSpecimenType,
  }) =>
      _impl.validateImageBuffer(
        imageBytes,
        isEndCut: isEndCut,
        forcedSpecimenType: forcedSpecimenType,
      );

  void dispose() => _impl.dispose();
}

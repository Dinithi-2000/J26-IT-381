/// Contract for the bundled Teachable Machine image classifier.
library;

class ModelAssetPaths {
  ModelAssetPaths._();
  static const cinnamonValidator = 'assets/models/cinnamon_validator.tflite';
  static const validatorLabels = 'assets/models/validator_labels.txt';
}

class ModelInputConfig {
  ModelInputConfig._();
  static const defaultWidth = 224;
  static const defaultHeight = 224;
  static const channels = 3;

  /// Teachable Machine export convention: RGB / 127.5 - 1.
  /// See assets/models/README.md for provenance and verification limitations.
  static const normalisationDivisor = 127.5;
  static const normalisationOffset = 1.0;
}

class ValidationConfig {
  ValidationConfig._();
  static const acceptedLabel = 'valid_cinnamon';
  static const labels = {
    'valid_cinnamon',
    'cinnamon_with_hand',
    'other_objects',
  };

  /// Provisional score cutoff; not a calibrated probability of correctness.
  /// Override at construction or with the service's runtime setter.
  static const defaultConfidenceThreshold = 0.80;
}

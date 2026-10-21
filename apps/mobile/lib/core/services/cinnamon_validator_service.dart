import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../ml/image_preprocessor.dart';
import '../ml/model_config.dart';

final cinnamonValidatorServiceProvider = Provider<CinnamonValidatorService>((
  ref,
) {
  final service = CinnamonValidatorService();
  ref.onDispose(service.dispose);
  return service;
});

enum ValidatorState { unloaded, loading, ready, error }

/// The four validation outcomes: VALID, INVALID, UNCERTAIN, MODEL_ERROR.
enum CinnamonValidationStatus { valid, invalid, uncertain, modelError }

class CinnamonValidationResult {
  final CinnamonValidationStatus status;
  final String? label;

  /// Raw model score, not a calibrated probability of correctness.
  final double? confidence;
  final Map<String, double> probabilities;

  const CinnamonValidationResult._(
    this.status, {
    this.label,
    this.confidence,
    this.probabilities = const {},
  });

  const CinnamonValidationResult.modelError()
    : this._(CinnamonValidationStatus.modelError);

  bool get accepted => status == CinnamonValidationStatus.valid;

  String? get rejectionReason => switch (status) {
    CinnamonValidationStatus.valid => null,
    CinnamonValidationStatus.invalid =>
      label == 'cinnamon_with_hand'
          ? 'Please place the cinnamon on a flat surface and keep your hands out of the frame.'
          : 'Please place a cinnamon quill clearly inside the camera frame and try again.',
    CinnamonValidationStatus.uncertain =>
      'Unable to confirm cinnamon. Please capture a clearer photo.',
    CinnamonValidationStatus.modelError =>
      'Cinnamon validation is temporarily unavailable. Please retry.',
  };

  /// Shared decision policy used only after completed model inference.
  factory CinnamonValidationResult.fromScores(
    List<String> labels,
    List<double> scores,
    double threshold,
  ) {
    _checkThreshold(threshold);
    if (labels.length != 3 ||
        labels.toSet().length != 3 ||
        !labels.toSet().containsAll(ValidationConfig.labels) ||
        scores.length != labels.length ||
        scores.any((v) => !v.isFinite || v < 0 || v > 1) ||
        (scores.fold<double>(0, (a, b) => a + b) - 1).abs() > 0.01) {
      return const CinnamonValidationResult.modelError();
    }
    var best = 0;
    for (var i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
    final tied = scores.where((score) => score == scores[best]).length > 1;
    final status = scores[best] < threshold || tied
        ? CinnamonValidationStatus.uncertain
        : labels[best] == ValidationConfig.acceptedLabel
        ? CinnamonValidationStatus.valid
        : CinnamonValidationStatus.invalid;
    return CinnamonValidationResult._(
      status,
      label: labels[best],
      confidence: scores[best],
      probabilities: Map.unmodifiable(Map.fromIterables(labels, scores)),
    );
  }
}

void _checkThreshold(double value) {
  if (!value.isFinite || value <= 0 || value > 1) {
    throw ArgumentError.value(
      value,
      'confidenceThreshold',
      'Must be in (0, 1].',
    );
  }
}

/// Native boundary, injectable for unit tests without pretending to run TFLite.
abstract interface class CinnamonModel {
  List<int> get inputShape;
  List<int> get outputShape;
  TensorType get inputType;
  TensorType get outputType;
  List<double> run(PreprocessedImage image);
  void close();
}

class _TfliteCinnamonModel implements CinnamonModel {
  final Interpreter interpreter;
  _TfliteCinnamonModel(this.interpreter);

  static Future<CinnamonModel> load(String path) async {
    // CPU inference works offline and avoids optional delegate dependencies.
    final options = InterpreterOptions()..threads = 2;
    try {
      final interpreter = await Interpreter.fromAsset(path, options: options);
      if (interpreter.getInputTensors().length != 1 ||
          interpreter.getOutputTensors().length != 1) {
        interpreter.close();
        throw StateError('Expected a single input and output tensor.');
      }
      return _TfliteCinnamonModel(interpreter);
    } finally {
      options.delete();
    }
  }

  @override
  List<int> get inputShape => interpreter.getInputTensor(0).shape;
  @override
  List<int> get outputShape => interpreter.getOutputTensor(0).shape;
  @override
  TensorType get inputType => interpreter.getInputTensor(0).type;
  @override
  TensorType get outputType => interpreter.getOutputTensor(0).type;
  @override
  List<double> run(PreprocessedImage image) {
    final output = [List<double>.filled(outputShape[1], 0)];
    interpreter.run(image.tensor, output);
    return output.single;
  }

  @override
  void close() => interpreter.close();
}

class CinnamonValidatorService {
  CinnamonValidatorService({
    double confidenceThreshold = ValidationConfig.defaultConfidenceThreshold,
    this.modelAssetPath = ModelAssetPaths.cinnamonValidator,
    this.labelsAssetPath = ModelAssetPaths.validatorLabels,
    AssetBundle? assetBundle,
    Future<CinnamonModel> Function(String)? modelLoader,
  }) : _confidenceThreshold = confidenceThreshold,
       _assets = assetBundle ?? rootBundle,
       _modelLoader = modelLoader ?? _TfliteCinnamonModel.load {
    _checkThreshold(confidenceThreshold);
  }

  final String modelAssetPath;
  final String labelsAssetPath;
  final AssetBundle _assets;
  final Future<CinnamonModel> Function(String) _modelLoader;
  double _confidenceThreshold;
  double get confidenceThreshold => _confidenceThreshold;
  set confidenceThreshold(double value) {
    _checkThreshold(value);
    _confidenceThreshold = value;
  }

  CinnamonModel? _model;
  ImagePreprocessor? _preprocessor;
  List<String> _labels = [];
  ValidatorState _state = ValidatorState.unloaded;
  String? _lastError;
  Future<void>? _loading;
  int _generation = 0;
  bool _classifying = false;
  ValidatorState get state => _state;
  bool get isReady => state == ValidatorState.ready;
  String? get lastError => _lastError;
  List<String> get labels => List.unmodifiable(_labels);
  int get inputWidth =>
      _preprocessor?.targetWidth ?? ModelInputConfig.defaultWidth;
  int get inputHeight =>
      _preprocessor?.targetHeight ?? ModelInputConfig.defaultHeight;

  Future<void> initialize() async {
    if (isReady) return;
    if (_loading != null) return _loading;
    final loading = _initialize(_generation);
    _loading = loading;
    try {
      await loading;
    } finally {
      if (identical(_loading, loading)) _loading = null;
    }
  }

  Future<void> _initialize(int generation) async {
    _state = ValidatorState.loading;
    _lastError = null;
    CinnamonModel? candidate;
    try {
      final labels = parseLabels(await _assets.loadString(labelsAssetPath));
      candidate = await _modelLoader(modelAssetPath);
      final input = candidate.inputShape;
      if (candidate.inputType != TensorType.float32 ||
          !listEquals(input, [
            1,
            ModelInputConfig.defaultHeight,
            ModelInputConfig.defaultWidth,
            3,
          ]) ||
          candidate.outputType != TensorType.float32 ||
          !listEquals(candidate.outputShape, [1, labels.length])) {
        throw StateError('Unsupported cinnamon model tensor contract.');
      }
      if (generation != _generation) return;
      _model = candidate;
      candidate = null;
      _labels = labels;
      _preprocessor = ImagePreprocessor(
        targetHeight: input[1],
        targetWidth: input[2],
      );
      _state = ValidatorState.ready;
    } catch (e) {
      if (generation == _generation) _fail(e);
    } finally {
      candidate?.close();
    }
  }

  /// Index prefixes must match line positions; duplicates/unknown labels fail.
  @visibleForTesting
  static List<String> parseLabels(String raw) {
    final lines = raw
        .split('\n')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    final labels = <String>[];
    for (var i = 0; i < lines.length; i++) {
      final match = RegExp(r'^(\d+)\s+(.+)$').firstMatch(lines[i]);
      if (match != null && int.parse(match[1]!) != i) {
        throw FormatException('Label index does not match output position.');
      }
      labels.add(match?[2] ?? lines[i]);
    }
    if (labels.length != 3 ||
        labels.toSet().length != 3 ||
        !labels.toSet().containsAll(ValidationConfig.labels)) {
      throw FormatException('Expected the three cinnamon validation labels.');
    }
    return labels;
  }

  Future<CinnamonValidationResult> classify(Uint8List imageBytes) async {
    if (_classifying) return const CinnamonValidationResult.modelError();
    _classifying = true;
    final generation = _generation;
    try {
      await initialize();
      if (generation != _generation || !isReady) {
        return const CinnamonValidationResult.modelError();
      }
      final input = await _preprocessor!.preprocess(imageBytes);
      if (generation != _generation) {
        return const CinnamonValidationResult.modelError();
      }
      final scores = _model!.run(input);
      final result = CinnamonValidationResult.fromScores(
        _labels,
        scores,
        confidenceThreshold,
      );
      if (result.status == CinnamonValidationStatus.modelError) {
        _fail(StateError('Malformed model output.'));
      }
      return result;
    } catch (e) {
      if (generation == _generation) _fail(e);
      return const CinnamonValidationResult.modelError();
    } finally {
      _classifying = false;
    }
  }

  void _fail(Object error) {
    _lastError = error.toString();
    _state = ValidatorState.error;
    _model?.close();
    _model = null;
    _preprocessor = null;
    debugPrint('[CinnamonValidator] $error');
  }

  void dispose() {
    _generation++;
    _model?.close();
    _model = null;
    _preprocessor = null;
    _loading = null;
    _state = ValidatorState.unloaded;
  }
}

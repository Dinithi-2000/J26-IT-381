import 'dart:io';
import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../ml/hybrid_config.dart';
import '../ml/hybrid_image_preprocessor.dart';

final mlServiceProvider = Provider<MLService>((ref) {
  final service = MLService();
  ref.onDispose(service.dispose);
  return service;
});

class MLGradeResult {
  final String predictedGrade;

  /// Softmax score only; not calibrated or certified correctness.
  final double modelProbability;
  final double diameterMm;
  final String modelVersion;
  final Map<String, double> probabilities;
  const MLGradeResult({
    required this.predictedGrade,
    required this.modelProbability,
    required this.diameterMm,
    required this.modelVersion,
    required this.probabilities,
  });

  factory MLGradeResult.fromOutput(
    List<double> scores,
    HybridConfig config,
    double diameterMm,
  ) {
    config.normalizeDiameter(diameterMm);
    if (scores.length != config.classes.length ||
        scores.any((v) => !v.isFinite || v < 0 || v > 1) ||
        (scores.fold<double>(0, (a, b) => a + b) - 1).abs() > 0.01) {
      throw const HybridException(
        'Hybrid model returned invalid probabilities. Please retry.',
      );
    }
    var best = 0;
    for (var i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
    return MLGradeResult(
      predictedGrade: config.classes[best],
      modelProbability: scores[best],
      diameterMm: diameterMm,
      modelVersion: 'hybrid_${config.version}',
      probabilities: Map.unmodifiable(
        Map.fromIterables(config.classes, scores),
      ),
    );
  }
}

class HybridTensor {
  final String name;
  final List<int> shape;
  final TensorType type;
  const HybridTensor(this.name, this.shape, this.type);
}

/// Map semantic names to interpreter input-list positions, not graph tensor IDs.
List<String> validateHybridTensors(
  List<HybridTensor> inputs,
  List<HybridTensor> outputs,
) {
  const names = {
    'serving_default_side_image:0': 'side',
    'serving_default_diameter:0': 'diameter',
    'serving_default_end_image:0': 'end',
  };
  final roles = inputs.map((input) => names[input.name] ?? '').toList();
  if (roles.length != 3 ||
      roles.toSet().length != 3 ||
      roles.contains('') ||
      outputs.length != 1 ||
      outputs.single.type != TensorType.float32 ||
      !listEquals(outputs.single.shape, [1, 7])) {
    throw const HybridException(
      'Hybrid model tensor names or output are incompatible with V2.',
    );
  }
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].type != TensorType.float32 ||
        !listEquals(
          inputs[i].shape,
          roles[i] == 'diameter' ? [1, 1] : [1, 224, 224, 3],
        )) {
      throw const HybridException(
        'Hybrid model requires float32 RGB images and one float32 diameter.',
      );
    }
  }
  return roles;
}

class HybridRequest {
  final Uint8List modelBytes;
  final Uint8List sideBytes;
  final Uint8List endBytes;
  final double normalizedDiameter;
  const HybridRequest(
    this.modelBytes,
    this.sideBytes,
    this.endBytes,
    this.normalizedDiameter,
  );
}

/// Model creation, preprocessing, invocation, and disposal share an isolate.
/// Native exceptions propagate through Isolate.run, with no guessed output.
Future<List<double>> runHybridModel(HybridRequest request) =>
    Isolate.run(() => _inferHybrid(request));

List<double> _inferHybrid(HybridRequest request) {
  Interpreter? interpreter;
  InterpreterOptions? options;
  try {
    options = InterpreterOptions()..threads = 2;
    interpreter = Interpreter.fromBuffer(request.modelBytes, options: options);
    HybridTensor descriptor(Tensor t) => HybridTensor(t.name, t.shape, t.type);
    final roles = validateHybridTensors(
      interpreter.getInputTensors().map(descriptor).toList(),
      interpreter.getOutputTensors().map(descriptor).toList(),
    );
    final side = HybridImagePreprocessor.preprocess(request.sideBytes);
    final end = HybridImagePreprocessor.preprocess(request.endBytes);
    final diameter = Float32List.fromList([request.normalizedDiameter]);
    final buffers = {'side': side, 'end': end, 'diameter': diameter};
    // ByteBuffers preserve the verified native tensor shapes (no implicit resize).
    final inputs = [for (final role in roles) buffers[role]!.buffer];
    final output = Float32List(7);
    interpreter.runForMultipleInputs(inputs, {0: output.buffer});
    return output.toList();
  } on HybridException {
    rethrow;
  } catch (_) {
    throw const HybridException(
      'Hybrid V2 inference is unavailable. The model may be damaged or unsupported. Please retry.',
    );
  } finally {
    interpreter?.close();
    options?.delete();
  }
}

class MLService {
  final AssetBundle _assets;
  final Future<List<double>> Function(HybridRequest) _runner;
  final String modelAssetPath;
  final String configAssetPath;
  HybridConfig? _config;
  Uint8List? _modelBytes;
  bool _busy = false;
  bool _disposed = false;
  Future<void>? _loading;

  MLService({
    AssetBundle? assets,
    Future<List<double>> Function(HybridRequest)? runner,
    this.modelAssetPath = HybridConfig.modelAsset,
    this.configAssetPath = HybridConfig.configAsset,
  }) : _assets = assets ?? rootBundle,
       _runner = runner ?? runHybridModel;

  bool get isModelLoaded =>
      _modelBytes != null && _config != null && !_disposed;

  Future<void> initializeModel() async {
    if (_disposed) {
      throw const HybridException(
        'Grading session has ended. Please start a new scan.',
      );
    }
    if (isModelLoaded) return;
    if (_loading != null) return _loading;
    _loading = _load();
    try {
      await _loading;
    } finally {
      _loading = null;
    }
  }

  Future<void> _load() async {
    try {
      final config = HybridConfig.parse(
        await _assets.loadString(configAssetPath),
      );
      final data = await _assets.load(modelAssetPath);
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );
      if (bytes.length < 8 ||
          !listEquals(bytes.sublist(4, 8), 'TFL3'.codeUnits)) {
        throw const HybridException(
          'Hybrid V2 model is damaged. Please reinstall the model.',
        );
      }
      if (_disposed) throw const HybridException('Grading session has ended.');
      _config = config;
      _modelBytes = bytes;
    } on HybridException {
      rethrow;
    } catch (_) {
      throw const HybridException(
        'Hybrid V2 model or configuration could not be loaded. Please retry.',
      );
    }
  }

  Future<MLGradeResult> analyzeSample({
    required String sideImage,
    required String endImage,
    required double diameterMm,
  }) async {
    final measurementError = HybridConfig.diameterError(diameterMm);
    if (measurementError != null) throw HybridException(measurementError);
    if (_busy) {
      throw const HybridException('Grading is already running. Please wait.');
    }
    _busy = true;
    try {
      await initializeModel();
      Uint8List side;
      Uint8List end;
      try {
        side = await File(sideImage).readAsBytes();
        end = await File(endImage).readAsBytes();
      } catch (_) {
        throw const HybridException(
          'A captured photo is unavailable. Please retake both photos.',
        );
      }
      final config = _config!;
      final scores = await _runner(
        HybridRequest(
          _modelBytes!,
          side,
          end,
          config.normalizeDiameter(diameterMm),
        ),
      );
      if (_disposed) throw const HybridException('Grading session has ended.');
      return MLGradeResult.fromOutput(scores, config, diameterMm);
    } on HybridException {
      rethrow;
    } catch (_) {
      throw const HybridException(
        'Hybrid grading failed. Please retry or retake the photos.',
      );
    } finally {
      _busy = false;
    }
  }

  void dispose() {
    _disposed = true;
    _config = null;
    _modelBytes = null;
  }
}

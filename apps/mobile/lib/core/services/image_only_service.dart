import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../ml/hybrid_image_preprocessor.dart';
import '../ml/image_only_config.dart';

// Intentionally not consumed by the production scanning workflow.
final imageOnlyServiceProvider = Provider<ImageOnlyService>((ref) {
  final service = ImageOnlyService();
  ref.onDispose(service.dispose);
  return service;
});

class ImageOnlyGradeResult {
  final String predictedGrade;

  /// The winning softmax probability, not calibrated correctness.
  final double confidence;
  final Map<String, double> probabilities;
  String get modelVersion => ImageOnlyConfig.modelVersion;

  const ImageOnlyGradeResult._({
    required this.predictedGrade,
    required this.confidence,
    required this.probabilities,
  });

  factory ImageOnlyGradeResult.fromOutput(List<double> scores) {
    // Allow float32 accumulation noise; do not renormalize or apply softmax again.
    if (scores.length != ImageOnlyConfig.classes.length ||
        scores.any((v) => !v.isFinite || v < 0 || v > 1) ||
        (scores.fold<double>(0, (a, b) => a + b) - 1).abs() > 0.001) {
      throw const ImageOnlyException(
        'Image-only model returned invalid probabilities.',
      );
    }
    var best = 0;
    for (var i = 1; i < scores.length; i++) {
      // Ties select the first class in the model's fixed label order.
      if (scores[i] > scores[best]) best = i;
    }
    return ImageOnlyGradeResult._(
      predictedGrade: ImageOnlyConfig.classes[best],
      confidence: scores[best],
      probabilities: Map.unmodifiable(
        Map.fromIterables(ImageOnlyConfig.classes, scores),
      ),
    );
  }
}

class ImageOnlyTensor {
  final String name;
  final List<int> shape;
  final TensorType type;
  const ImageOnlyTensor(this.name, this.shape, this.type);
}

/// Returns semantic roles in interpreter input-list order, not graph tensor IDs.
List<String> validateImageOnlyTensors(
  List<ImageOnlyTensor> inputs,
  List<ImageOnlyTensor> outputs,
) {
  const names = {
    ImageOnlyConfig.sideInputName: 'side',
    ImageOnlyConfig.endInputName: 'end',
  };
  final roles = inputs.map((t) => names[t.name] ?? '').toList();
  if (roles.length != 2 ||
      roles.toSet().length != 2 ||
      roles.contains('') ||
      inputs.any(
        (t) =>
            t.type != TensorType.float32 ||
            !listEquals(t.shape, ImageOnlyConfig.inputShape),
      ) ||
      outputs.length != 1 ||
      outputs.single.name != ImageOnlyConfig.outputName ||
      outputs.single.type != TensorType.float32 ||
      !listEquals(outputs.single.shape, ImageOnlyConfig.outputShape)) {
    throw const ImageOnlyException(
      'Image-only model tensor names, shapes or types are incompatible with V1.',
    );
  }
  return roles;
}

/// Preprocesses each image once and maps its raw 0–255 buffer by tensor name.
/// ByteBuffers preserve the validated native shapes without implicit resizing.
List<ByteBuffer> prepareImageOnlyInputs({
  required List<ImageOnlyTensor> inputs,
  required List<ImageOnlyTensor> outputs,
  required Uint8List sideBytes,
  required Uint8List endBytes,
}) {
  final roles = validateImageOnlyTensors(inputs, outputs);
  try {
    final buffers = {
      'side': HybridImagePreprocessor.preprocess(sideBytes),
      'end': HybridImagePreprocessor.preprocess(endBytes),
    };
    return [for (final role in roles) buffers[role]!.buffer];
  } catch (_) {
    throw const ImageOnlyException(
      'An image could not be decoded or preprocessed. Please retake both photos.',
    );
  }
}

class ImageOnlyRequest {
  final Uint8List modelBytes;
  final Uint8List sideBytes;
  final Uint8List endBytes;
  const ImageOnlyRequest(this.modelBytes, this.sideBytes, this.endBytes);
}

/// Native resources are created, used and disposed within the same isolate.
Future<List<double>> runImageOnlyModel(ImageOnlyRequest request) =>
    Isolate.run(() => _inferImageOnly(request));

List<double> _inferImageOnly(ImageOnlyRequest request) {
  Interpreter? interpreter;
  InterpreterOptions? options;
  try {
    options = InterpreterOptions()..threads = 2;
    interpreter = Interpreter.fromBuffer(request.modelBytes, options: options);
    ImageOnlyTensor descriptor(Tensor t) =>
        ImageOnlyTensor(t.name, t.shape, t.type);
    final inputs = prepareImageOnlyInputs(
      inputs: interpreter.getInputTensors().map(descriptor).toList(),
      outputs: interpreter.getOutputTensors().map(descriptor).toList(),
      sideBytes: request.sideBytes,
      endBytes: request.endBytes,
    );
    final output = Float32List(ImageOnlyConfig.classes.length);
    interpreter.runForMultipleInputs(inputs, {0: output.buffer});
    final scores = output.toList();
    ImageOnlyGradeResult.fromOutput(scores);
    return scores;
  } on ImageOnlyException {
    rethrow;
  } catch (_) {
    throw const ImageOnlyException(
      'Image-only inference failed. The model may be damaged or unsupported.',
    );
  } finally {
    try {
      interpreter?.close();
    } finally {
      options?.delete();
    }
  }
}

class ImageOnlyService {
  final AssetBundle _assets;
  final Future<List<double>> Function(ImageOnlyRequest) _runner;
  Uint8List? _modelBytes;
  Future<void>? _loading;
  bool _busy = false;
  bool _disposed = false;

  ImageOnlyService({
    AssetBundle? assets,
    Future<List<double>> Function(ImageOnlyRequest)? runner,
  }) : _assets = assets ?? rootBundle,
       _runner = runner ?? runImageOnlyModel;

  /// Asset bytes are cached; native tensor validation occurs during inference.
  bool get isModelLoaded => _modelBytes != null && !_disposed;

  void _ensureActive() {
    if (_disposed) {
      throw const ImageOnlyException('Image-only grading session has ended.');
    }
  }

  Future<void> initializeModel() async {
    _ensureActive();
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
      final data = await _assets.load(ImageOnlyConfig.modelAsset);
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );
      if (bytes.length < 8 ||
          !listEquals(bytes.sublist(4, 8), 'TFL3'.codeUnits)) {
        throw const ImageOnlyException('Image-only model asset is damaged.');
      }
      _ensureActive();
      _modelBytes = bytes;
    } on ImageOnlyException {
      rethrow;
    } catch (_) {
      throw const ImageOnlyException(
        'Image-only model asset could not be loaded.',
      );
    }
  }

  Future<ImageOnlyGradeResult> analyzeSample({
    required String sideImage,
    required String endImage,
  }) async {
    _ensureActive();
    if (_busy) {
      throw const ImageOnlyException('Image-only grading is already running.');
    }
    if (sideImage.trim().isEmpty || endImage.trim().isEmpty) {
      throw const ImageOnlyException('Both side and end photos are required.');
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
        throw const ImageOnlyException('A captured photo is unavailable.');
      }
      if (side.isEmpty || end.isEmpty) {
        throw const ImageOnlyException('A captured photo is empty.');
      }
      _ensureActive();
      final scores = await _runner(ImageOnlyRequest(_modelBytes!, side, end));
      _ensureActive();
      return ImageOnlyGradeResult.fromOutput(scores);
    } on ImageOnlyException {
      rethrow;
    } catch (_) {
      throw const ImageOnlyException(
        'Image-only grading failed. Please retry.',
      );
    } finally {
      _busy = false;
    }
  }

  void dispose() {
    _disposed = true;
    _modelBytes = null;
  }
}

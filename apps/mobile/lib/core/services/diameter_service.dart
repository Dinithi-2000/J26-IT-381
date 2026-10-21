import 'dart:io';
import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../ml/diameter_config.dart';
import '../ml/hybrid_image_preprocessor.dart';

final diameterServiceProvider = Provider<DiameterService>((ref) {
  final service = DiameterService();
  ref.onDispose(service.dispose);
  return service;
});

class DiameterTensor {
  final String name;
  final List<int> shape;
  final TensorType type;
  const DiameterTensor(this.name, this.shape, this.type);
}

/// These names/shapes were inspected in the supplied V1 FlatBuffer.
/// Interpreter list positions are distinct from graph tensor IDs (0 and 220).
void validateDiameterTensors(
  List<DiameterTensor> inputs,
  List<DiameterTensor> outputs,
) {
  if (inputs.length != 1 ||
      outputs.length != 1 ||
      inputs.single.name != 'serving_default_end_image:0' ||
      inputs.single.type != TensorType.float32 ||
      !listEquals(inputs.single.shape, [1, 224, 224, 3]) ||
      outputs.single.name != 'StatefulPartitionedCall_1:0' ||
      outputs.single.type != TensorType.float32 ||
      !listEquals(outputs.single.shape, [1, 1])) {
    throw const DiameterException(
      'Diameter model tensors are incompatible with V1. Please use a caliper.',
    );
  }
}

class DiameterRequest {
  final Uint8List modelBytes;
  final Uint8List endBytes;
  const DiameterRequest(this.modelBytes, this.endBytes);
}

Future<List<double>> runDiameterModel(DiameterRequest request) =>
    Isolate.run(() {
      Interpreter? interpreter;
      InterpreterOptions? options;
      try {
        options = InterpreterOptions()..threads = 2;
        interpreter = Interpreter.fromBuffer(
          request.modelBytes,
          options: options,
        );
        DiameterTensor descriptor(Tensor t) =>
            DiameterTensor(t.name, t.shape, t.type);
        validateDiameterTensors(
          interpreter.getInputTensors().map(descriptor).toList(),
          interpreter.getOutputTensors().map(descriptor).toList(),
        );
        Float32List pixels;
        try {
          pixels = HybridImagePreprocessor.preprocess(request.endBytes);
        } catch (_) {
          throw const DiameterException(
            'The end-view photo could not be processed. Please retake it.',
          );
        }
        final output = Float32List(1);
        interpreter.runForMultipleInputs([pixels.buffer], {0: output.buffer});
        return output.toList();
      } on DiameterException {
        rethrow;
      } catch (_) {
        throw const DiameterException(
          'Diameter inference is unavailable. Please retry or enter an actual caliper measurement.',
        );
      } finally {
        interpreter?.close();
        options?.delete();
      }
    });

class DiameterService {
  final AssetBundle _assets;
  final Future<List<double>> Function(DiameterRequest) _runner;
  DiameterConfig? _config;
  Uint8List? _model;
  Future<void>? _loading;
  bool _busy = false;
  bool _disposed = false;

  DiameterService({
    AssetBundle? assets,
    Future<List<double>> Function(DiameterRequest)? runner,
  }) : _assets = assets ?? rootBundle,
       _runner = runner ?? runDiameterModel;

  Future<void> initializeModel() async {
    if (_disposed) throw const DiameterException('Diameter session has ended.');
    if (_config != null && _model != null) return;
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
      final config = DiameterConfig.parse(
        await _assets.loadString(DiameterConfig.configAsset, cache: false),
      );
      final data = await _assets.load(DiameterConfig.modelAsset);
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );
      if (bytes.length < 8 ||
          !listEquals(bytes.sublist(4, 8), 'TFL3'.codeUnits)) {
        throw const DiameterException(
          'Diameter model is damaged. Please reinstall the model or use a caliper.',
        );
      }
      if (_disposed) {
        throw const DiameterException('Diameter session has ended.');
      }
      _config = config;
      _model = bytes;
    } on DiameterException {
      rethrow;
    } catch (_) {
      throw const DiameterException(
        'Diameter model or configuration could not be loaded. Please retry or use a caliper.',
      );
    }
  }

  Future<DiameterEstimate> estimate(String endImage) async {
    if (_busy) {
      throw const DiameterException(
        'Diameter estimation is already running. Please wait.',
      );
    }
    _busy = true;
    try {
      await initializeModel();
      Uint8List image;
      try {
        image = await File(endImage).readAsBytes();
      } catch (_) {
        throw const DiameterException(
          'The end-view photo is unavailable. Please retake it.',
        );
      }
      final config = _config!;
      final output = await _runner(DiameterRequest(_model!, image));
      if (_disposed) {
        throw const DiameterException('Diameter session has ended.');
      }
      return config.decodeOutput(output);
    } on DiameterException {
      rethrow;
    } catch (_) {
      throw const DiameterException(
        'Diameter estimation failed. Please retry or use a caliper.',
      );
    } finally {
      _busy = false;
    }
  }

  void dispose() {
    _disposed = true;
    _model = null;
    _config = null;
  }
}

import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:integration_test/integration_test.dart';
import 'package:quill_grade/core/ml/hybrid_image_preprocessor.dart';
import 'package:quill_grade/core/ml/image_only_config.dart';
import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

// Run on Android:
// flutter test integration_test/image_only_model_device_test.dart -d DEVICE_ID
//
// Default images are artwork and a synthetic PNG, ONLY runtime smoke inputs.
// For a genuine photographed pair, supply two already bundled asset paths:
// --dart-define=IMAGE_ONLY_SIDE_ASSET=assets/images/side.jpg
// --dart-define=IMAGE_ONLY_END_ASSET=assets/images/end.jpg
// No reference photos or predictions are created by this test.
//
// Optional Python parity also requires:
// --dart-define=IMAGE_ONLY_REFERENCE_ASSET=assets/images/image_only_reference.json
// The JSON must contain model_sha256, model_version, class_names, side_sha256,
// end_sha256, tensorflow_version, and probabilities (four Python FP32 TFLite
// outputs in exact model order). Export using this model and the SAME images,
// EXIF correction, RGB, bilinear white padding, and raw 0-255 float32 inputs.
// Missing assets or malformed supplied references fail; absent references skip.
const _sideAsset = String.fromEnvironment('IMAGE_ONLY_SIDE_ASSET');
const _endAsset = String.fromEnvironment('IMAGE_ONLY_END_ASSET');
const _referenceAsset = String.fromEnvironment('IMAGE_ONLY_REFERENCE_ASSET');
const _modelSha256 =
    'c8cd6a647945c56e8db2f5bd4bb1792b0db771ed52e51f428e31181b6488f865';

// Same model, bytes and CPU runtime: allow small float32 accumulation drift
// across interpreter instances/thread scheduling, not changes in preprocessing.
const _repeatTolerance = 1e-5;

// A strict absolute acceptance bound (0.01 percentage points per class) for
// FP32 CPU kernel differences across Python/Android. This is not a measured
// equivalence claim. Decoder/preprocessing discrepancies can exceed it and must
// be investigated, not hidden by relaxing the tolerance or comparing labels only.
const _pythonTolerance = 1e-4;

Future<Uint8List> _assetBytes(String path) async {
  final data = await rootBundle.load(path);
  return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
}

Future<ImageOnlyRequest> _smokeRequest() async {
  final synthetic = img.Image(width: 32, height: 16);
  img.fill(synthetic, color: img.ColorRgb8(20, 80, 200));
  return ImageOnlyRequest(
    await _assetBytes(ImageOnlyConfig.modelAsset),
    await _assetBytes('assets/images/cinnamon_bg.jpg'),
    Uint8List.fromList(img.encodePng(synthetic)),
  );
}

Future<ImageOnlyRequest> _photographedRequest() async {
  expect(
    _sideAsset,
    isNotEmpty,
    reason: 'Supply the genuine side photo asset.',
  );
  expect(_endAsset, isNotEmpty, reason: 'Supply the genuine end photo asset.');
  final request = ImageOnlyRequest(
    await _assetBytes(ImageOnlyConfig.modelAsset),
    await _assetBytes(_sideAsset),
    await _assetBytes(_endAsset),
  );
  expect(
    listEquals(request.sideBytes, request.endBytes),
    isFalse,
    reason:
        'A side/end pair requires distinct photographs, not a reused image.',
  );
  return request;
}

class _NativeObservation {
  final List<ImageOnlyTensor> inputs;
  final List<ImageOnlyTensor> outputs;
  final bool buffersMatchNames;
  final bool rawRgbRange;
  final List<double> scores;
  final List<double> reorderedScores;

  const _NativeObservation(
    this.inputs,
    this.outputs,
    this.buffersMatchNames,
    this.rawRgbRange,
    this.scores,
    this.reorderedScores,
  );
}

// Keep the isolate closure outside the widget test's captured framework state.
Future<_NativeObservation> _inspectInIsolate(ImageOnlyRequest request) =>
    Isolate.run(() => _inspectAndInvoke(request));

// All interpreter operations, including inspection and disposal, stay in the
// worker isolate, matching the service lifecycle. Nothing here mocks inference.
_NativeObservation _inspectAndInvoke(ImageOnlyRequest request) {
  Interpreter? interpreter;
  InterpreterOptions? options;
  try {
    options = InterpreterOptions()..threads = 2;
    interpreter = Interpreter.fromBuffer(request.modelBytes, options: options);
    ImageOnlyTensor describe(Tensor t) =>
        ImageOnlyTensor(t.name, t.shape, t.type);
    final inputs = interpreter.getInputTensors().map(describe).toList();
    final outputs = interpreter.getOutputTensors().map(describe).toList();
    final buffers = prepareImageOnlyInputs(
      inputs: inputs,
      outputs: outputs,
      sideBytes: request.sideBytes,
      endBytes: request.endBytes,
    );
    final expected = {
      ImageOnlyConfig.sideInputName: HybridImagePreprocessor.preprocess(
        request.sideBytes,
      ),
      ImageOnlyConfig.endInputName: HybridImagePreprocessor.preprocess(
        request.endBytes,
      ),
    };
    // Independently associate every complete RGB buffer with its native name.
    var buffersMatchNames = true;
    for (var i = 0; i < inputs.length; i++) {
      buffersMatchNames &= listEquals(
        buffers[i].asFloat32List(),
        expected[inputs[i].name],
      );
    }
    final rawRgbRange = buffers.every((buffer) {
      final values = buffer.asFloat32List();
      return values.length == 224 * 224 * 3 &&
          values.every((v) => v.isFinite && v >= 0 && v <= 255) &&
          values.any((v) => v > 1);
    });
    final output = Float32List(4);
    interpreter.runForMultipleInputs(buffers, {0: output.buffer});
    final scores = output.toList();

    // Reverse descriptor order, prepare by name, then route those buffers back
    // to native slots by name. A positional side/end assumption fails this check.
    final reversed = inputs.reversed.toList();
    final reverseBuffers = prepareImageOnlyInputs(
      inputs: reversed,
      outputs: outputs,
      sideBytes: request.sideBytes,
      endBytes: request.endBytes,
    );
    final byName = {
      for (var i = 0; i < reversed.length; i++)
        reversed[i].name: reverseBuffers[i],
    };
    for (final input in inputs) {
      buffersMatchNames &= listEquals(
        byName[input.name]!.asFloat32List(),
        expected[input.name],
      );
    }
    final reorderedOutput = Float32List(4);
    interpreter.runForMultipleInputs(
      [for (final input in inputs) byName[input.name]!],
      {0: reorderedOutput.buffer},
    );
    return _NativeObservation(
      inputs,
      interpreter.getOutputTensors().map(describe).toList(),
      buffersMatchNames,
      rawRgbRange,
      scores,
      reorderedOutput.toList(),
    );
  } finally {
    try {
      interpreter?.close();
    } finally {
      options?.delete();
    }
  }
}

void _expectProbabilities(List<double> scores) {
  expect(scores, hasLength(4));
  for (final score in scores) {
    expect(score.isFinite, isTrue);
    expect(score, inInclusiveRange(0, 1));
  }
  expect(scores.reduce((a, b) => a + b), closeTo(1, 0.001));
  final result = ImageOnlyGradeResult.fromOutput(scores);
  expect(result.probabilities.keys, ['ALBA', 'C4', 'C5', 'Special']);
  expect(result.probabilities.values, scores);
  expect(result.predictedGrade, isIn(ImageOnlyConfig.classes));
  expect(result.confidence, scores.reduce((a, b) => a > b ? a : b));
  expect(result.probabilities[result.predictedGrade], result.confidence);
  expect(result.modelVersion, 'image_only_4class_v1');
}

void _expectClose(
  List<double> actual,
  List<double> expected,
  double tolerance,
) {
  expect(actual, hasLength(4));
  expect(expected, hasLength(4));
  for (var i = 0; i < 4; i++) {
    expect(
      actual[i],
      closeTo(expected[i], tolerance),
      reason: 'Probability for ${ImageOnlyConfig.classes[i]} differs.',
    );
  }
}

Future<ImageOnlyGradeResult> _runService(ImageOnlyRequest request) async {
  // Only files created in this unique test-owned directory are removed. The
  // app's database, preferences, saved photos and Firebase are never opened.
  final directory = await Directory.systemTemp.createTemp('image_only_native_');
  final service = ImageOnlyService(); // Default, REAL isolate runner.
  try {
    await service.initializeModel();
    expect(service.isModelLoaded, isTrue);
    final side = await File('${directory.path}/side.img')
        .writeAsBytes(request.sideBytes);
    final end = await File('${directory.path}/end.img')
        .writeAsBytes(request.endBytes);
    final result = await service.analyzeSample(
      sideImage: side.path,
      endImage: end.path,
    ); // No diameter parameter exists.
    _expectProbabilities(result.probabilities.values.toList());
    return result;
  } finally {
    service.dispose();
    try {
      expect(service.isModelLoaded, isFalse);
    } finally {
      await directory.delete(recursive: true);
    }
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final report = <String, dynamic>{
    'model_version': ImageOnlyConfig.modelVersion,
    'model_sha256': _modelSha256,
    'android': Platform.isAndroid,
    'genuine_pair_verified': false,
    'python_parity_verified': false,
  };
  binding.reportData = report;

  testWidgets('real native tensor contract, named RGB buffers and softmax', (
    tester,
  ) async {
    expect(
      Platform.isAndroid,
      isTrue,
      reason: 'Run this verification on Android.',
    );
    final request = await _smokeRequest();
    expect(sha256.convert(request.modelBytes).toString(), _modelSha256);
    final observed = await _inspectInIsolate(request);
    expect(observed.inputs, hasLength(2));
    expect(
      observed.inputs.map((t) => t.name),
      unorderedEquals([
        'serving_default_side_image:0',
        'serving_default_end_image:0',
      ]),
    );
    for (final input in observed.inputs) {
      expect(input.type, TensorType.float32);
      expect(input.shape, [1, 224, 224, 3]);
    }
    expect(observed.outputs, hasLength(1));
    expect(observed.outputs.single.name, 'StatefulPartitionedCall_1:0');
    expect(observed.outputs.single.type, TensorType.float32);
    expect(observed.outputs.single.shape, [1, 4]);
    expect(observed.buffersMatchNames, isTrue);
    expect(observed.rawRgbRange, isTrue);
    _expectProbabilities(observed.scores);
    _expectProbabilities(observed.reorderedScores);
    _expectClose(observed.reorderedScores, observed.scores, _repeatTolerance);
    final serviceScores = await runImageOnlyModel(request);
    _expectProbabilities(serviceScores);
    _expectClose(serviceScores, observed.scores, _repeatTolerance);
    report['native_inputs'] = [
      for (final t in observed.inputs)
        {'name': t.name, 'shape': t.shape, 'type': t.type.toString()},
    ];
    report['smoke_probabilities'] = serviceScores;
  });

  testWidgets(
    'real service initializes, infers without diameter and disposes',
    (tester) async {
      expect(Platform.isAndroid, isTrue);
      final request = await _smokeRequest();
      final first = await _runService(request);
      final second = await _runService(request);
      _expectClose(
        second.probabilities.values.toList(),
        first.probabilities.values.toList(),
        _repeatTolerance,
      );
      report['service_native_smoke_passed'] = true;
    },
  );

  testWidgets('genuine photographed side/end pair needs no diameter', (
    tester,
  ) async {
    expect(Platform.isAndroid, isTrue);
    final result = await _runService(await _photographedRequest());
    report['genuine_pair_verified'] = true;
    report['genuine_pair_probabilities'] = result.probabilities;
  }, skip: _sideAsset.isEmpty && _endAsset.isEmpty);

  testWidgets(
    'all four probabilities match an exported Python FP32 reference',
    (tester) async {
      expect(Platform.isAndroid, isTrue);
      final request = await _photographedRequest();
      final manifest = jsonDecode(
        await rootBundle.loadString(_referenceAsset),
      ) as Map<String, dynamic>;
      expect(
        manifest['model_sha256'],
        sha256.convert(request.modelBytes).toString(),
      );
      expect(manifest['model_sha256'], _modelSha256);
      expect(manifest['model_version'], ImageOnlyConfig.modelVersion);
      expect(manifest['class_names'], ['ALBA', 'C4', 'C5', 'Special']);
      expect(
        manifest['side_sha256'],
        sha256.convert(request.sideBytes).toString(),
      );
      expect(
        manifest['end_sha256'],
        sha256.convert(request.endBytes).toString(),
      );
      expect(
        manifest['tensorflow_version'],
        isA<String>().having((v) => v.isNotEmpty, 'not empty', isTrue),
      );
      final expected = (manifest['probabilities'] as List)
          .map((value) => (value as num).toDouble())
          .toList();
      _expectProbabilities(expected);
      final actual = await runImageOnlyModel(request);
      _expectProbabilities(actual);
      _expectClose(actual, expected, _pythonTolerance);
      report['python_parity_verified'] = true;
      report['python_absolute_tolerance'] = _pythonTolerance;
      report['python_reference_probabilities'] = expected;
      report['android_probabilities'] = actual;
    },
    skip: _referenceAsset.isEmpty,
  );
}

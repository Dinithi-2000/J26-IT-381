import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:quill_grade/core/ml/image_only_config.dart';
import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

const sideTensor = ImageOnlyTensor(ImageOnlyConfig.sideInputName, [
  1,
  224,
  224,
  3,
], TensorType.float32);
const endTensor = ImageOnlyTensor(ImageOnlyConfig.endInputName, [
  1,
  224,
  224,
  3,
], TensorType.float32);
const outputTensor = ImageOnlyTensor(ImageOnlyConfig.outputName, [
  1,
  4,
], TensorType.float32);

class ImageOnlyAssets extends CachingAssetBundle {
  Uint8List model = Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]);
  bool missing = false;
  int loads = 0;
  Completer<void>? gate;

  @override
  Future<ByteData> load(String key) async {
    expect(key, ImageOnlyConfig.modelAsset);
    loads++;
    if (gate != null) await gate!.future;
    if (missing) throw StateError('Missing asset');
    // Exercise nonzero ByteData offsets and an unrelated trailing byte.
    final padded = Uint8List.fromList([99, ...model, 88]);
    return ByteData.sublistView(padded, 1, padded.length - 1);
  }
}

Uint8List photo(int red, int green, int blue) {
  final image = img.Image(width: 4, height: 2);
  img.fill(image, color: img.ColorRgb8(red, green, blue));
  return Uint8List.fromList(img.encodePng(image));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final imageOnlyError = isA<ImageOnlyException>();

  test('bundled model loads with the preserved SHA256', () async {
    final data = await rootBundle.load(ImageOnlyConfig.modelAsset);
    final bytes = data.buffer.asUint8List(
      data.offsetInBytes,
      data.lengthInBytes,
    );
    expect(bytes.sublist(4, 8), 'TFL3'.codeUnits);
    expect(
      sha256.convert(bytes).toString(),
      'c8cd6a647945c56e8db2f5bd4bb1792b0db771ed52e51f428e31181b6488f865',
    );
  });

  group('tensor contract', () {
    test('maps semantic names in either input-list order', () {
      expect(
        validateImageOnlyTensors([sideTensor, endTensor], [outputTensor]),
        ['side', 'end'],
      );
      expect(
        validateImageOnlyTensors([endTensor, sideTensor], [outputTensor]),
        ['end', 'side'],
      );
    });

    final badInputs = <String, List<ImageOnlyTensor>>{
      'missing': [sideTensor],
      'extra diameter': [
        sideTensor,
        endTensor,
        const ImageOnlyTensor('serving_default_diameter:0', [
          1,
          1,
        ], TensorType.float32),
      ],
      'duplicate': [sideTensor, sideTensor],
      'unknown name': [
        sideTensor,
        const ImageOnlyTensor('end_image', [
          1,
          224,
          224,
          3,
        ], TensorType.float32),
      ],
      'wrong size': [
        sideTensor,
        const ImageOnlyTensor(ImageOnlyConfig.endInputName, [
          1,
          256,
          224,
          3,
        ], TensorType.float32),
      ],
      'wrong batch': [
        const ImageOnlyTensor(ImageOnlyConfig.sideInputName, [
          2,
          224,
          224,
          3,
        ], TensorType.float32),
        endTensor,
      ],
      'wrong channels': [
        sideTensor,
        const ImageOnlyTensor(ImageOnlyConfig.endInputName, [
          1,
          224,
          224,
          1,
        ], TensorType.float32),
      ],
      'wrong rank': [
        sideTensor,
        const ImageOnlyTensor(ImageOnlyConfig.endInputName, [
          224,
          224,
          3,
        ], TensorType.float32),
      ],
      'wrong type': [
        const ImageOnlyTensor(ImageOnlyConfig.sideInputName, [
          1,
          224,
          224,
          3,
        ], TensorType.uint8),
        endTensor,
      ],
    };
    for (final entry in badInputs.entries) {
      test('rejects input ${entry.key}', () {
        expect(
          () => validateImageOnlyTensors(entry.value, [outputTensor]),
          throwsA(imageOnlyError),
        );
      });
    }

    final badOutputs = <String, List<ImageOnlyTensor>>{
      'missing': [],
      'multiple': [outputTensor, outputTensor],
      'name': [
        const ImageOnlyTensor('unknown:0', [1, 4], TensorType.float32),
      ],
      'seven classes': [
        const ImageOnlyTensor(ImageOnlyConfig.outputName, [
          1,
          7,
        ], TensorType.float32),
      ],
      'rank': [
        const ImageOnlyTensor(ImageOnlyConfig.outputName, [
          4,
        ], TensorType.float32),
      ],
      'type': [
        const ImageOnlyTensor(ImageOnlyConfig.outputName, [
          1,
          4,
        ], TensorType.uint8),
      ],
    };
    for (final entry in badOutputs.entries) {
      test('rejects output ${entry.key}', () {
        expect(
          () => validateImageOnlyTensors([sideTensor, endTensor], entry.value),
          throwsA(imageOnlyError),
        );
      });
    }
  });

  group('image buffers', () {
    test(
      'reversed slots contain the correct raw RGB images and white padding',
      () {
        final buffers = prepareImageOnlyInputs(
          inputs: [endTensor, sideTensor],
          outputs: [outputTensor],
          sideBytes: photo(255, 0, 0),
          endBytes: photo(0, 0, 255),
        );
        final end = buffers[0].asFloat32List();
        final side = buffers[1].asFloat32List();
        expect(end.length, 224 * 224 * 3);
        expect(side.length, 224 * 224 * 3);
        expect(end.take(3), [255.0, 255.0, 255.0]);
        expect(side.take(3), [255.0, 255.0, 255.0]);
        const center = (112 * 224 + 112) * 3;
        expect(end.sublist(center, center + 3), [0.0, 0.0, 255.0]);
        expect(side.sublist(center, center + 3), [255.0, 0.0, 0.0]);
      },
    );

    for (final badSide in [true, false]) {
      test('rejects malformed ${badSide ? 'side' : 'end'} image', () {
        expect(
          () => prepareImageOnlyInputs(
            inputs: [sideTensor, endTensor],
            outputs: [outputTensor],
            sideBytes: badSide ? Uint8List(0) : photo(255, 0, 0),
            endBytes: badSide
                ? photo(0, 0, 255)
                : Uint8List.fromList([1, 2, 3]),
          ),
          throwsA(imageOnlyError),
        );
      });
    }
  });

  group('result parsing', () {
    test('exact class order, case and model version', () {
      expect(ImageOnlyConfig.classes, ['ALBA', 'C4', 'C5', 'Special']);
      for (var winner = 0; winner < 4; winner++) {
        final scores = List<double>.filled(4, 0.1)..[winner] = 0.7;
        final result = ImageOnlyGradeResult.fromOutput(scores);
        expect(result.predictedGrade, ['ALBA', 'C4', 'C5', 'Special'][winner]);
        expect(result.confidence, 0.7);
        expect(result.modelVersion, 'image_only_4class_v1');
        expect(result.probabilities.keys, ['ALBA', 'C4', 'C5', 'Special']);
        expect(result.probabilities.values, scores);
      }
    });

    test('copies probabilities into an immutable map', () {
      final scores = [0.1, 0.2, 0.3, 0.4];
      final result = ImageOnlyGradeResult.fromOutput(scores);
      scores[3] = 0;
      expect(result.probabilities['Special'], 0.4);
      expect(() => result.probabilities['Special'] = 0, throwsUnsupportedError);
    });

    test('ties select the first label', () {
      expect(
        ImageOnlyGradeResult.fromOutput([0.25, 0.25, 0.25, 0.25])
            .predictedGrade,
        'ALBA',
      );
    });

    test('accepts float32 sum noise without changing scores', () {
      final scores = [0.1, 0.2, 0.3, 0.40000002];
      expect(
        ImageOnlyGradeResult.fromOutput(scores).probabilities.values,
        scores,
      );
    });

    final badScores = <String, List<double>>{
      'empty': [],
      'three classes': [0.2, 0.3, 0.5],
      'seven classes': [1, 0, 0, 0, 0, 0, 0],
      'NaN': [double.nan, 0, 0, 1],
      'infinity': [double.infinity, 0, 0, 0],
      'negative': [-0.1, 0.2, 0.4, 0.5],
      'greater than one': [1.1, 0, 0, 0],
      'zero sum': [0, 0, 0, 0],
      'incorrect sum': [0.2, 0.2, 0.2, 0.2],
    };
    for (final entry in badScores.entries) {
      test('rejects ${entry.key}', () {
        expect(
          () => ImageOnlyGradeResult.fromOutput(entry.value),
          throwsA(imageOnlyError),
        );
      });
    }
  });

  group('service lifecycle', () {
    late Directory directory;
    late File side;
    late File end;
    late ImageOnlyAssets assets;
    late ImageOnlyService service;
    late int calls;
    late Future<List<double>> Function(ImageOnlyRequest) runner;

    Future<ImageOnlyGradeResult> analyze() =>
        service.analyzeSample(sideImage: side.path, endImage: end.path);

    setUp(() {
      directory = Directory.systemTemp.createTempSync('image_only_test_');
      side = File('${directory.path}/side.png')
        ..writeAsBytesSync(photo(255, 0, 0));
      end = File('${directory.path}/end.png')
        ..writeAsBytesSync(photo(0, 0, 255));
      assets = ImageOnlyAssets();
      calls = 0;
      runner = (_) async => [0.1, 0.2, 0.3, 0.4];
      service = ImageOnlyService(
        assets: assets,
        runner: (request) {
          calls++;
          return runner(request);
        },
      );
    });
    tearDown(() {
      service.dispose();
      directory.deleteSync(recursive: true);
    });

    test(
      'passes both original images and exact model slice; caches asset',
      () async {
        runner = (request) async {
          expect(request.modelBytes, assets.model);
          expect(request.sideBytes, side.readAsBytesSync());
          expect(request.endBytes, end.readAsBytesSync());
          return [0.1, 0.2, 0.3, 0.4];
        };
        final result = await analyze();
        expect(result.predictedGrade, 'Special');
        expect(result.confidence, 0.4);
        await analyze();
        expect(calls, 2);
        expect(assets.loads, 1);
        expect(service.isModelLoaded, isTrue);
      },
    );

    test('shares concurrent initialization', () async {
      assets.gate = Completer<void>();
      final first = service.initializeModel();
      final second = service.initializeModel();
      expect(assets.loads, 1);
      assets.gate!.complete();
      await Future.wait([first, second]);
      expect(service.isModelLoaded, isTrue);
    });

    test('missing asset fails before inference and can retry', () async {
      assets.missing = true;
      await expectLater(analyze(), throwsA(imageOnlyError));
      expect(calls, 0);
      expect(service.isModelLoaded, isFalse);
      assets.missing = false;
      await analyze();
      expect(calls, 1);
    });

    test('corrupt model header fails before inference', () async {
      assets.model = Uint8List(16);
      await expectLater(analyze(), throwsA(imageOnlyError));
      expect(calls, 0);
      expect(service.isModelLoaded, isFalse);
    });

    test('blank paths are rejected before loading', () async {
      for (final blankSide in [true, false]) {
        await expectLater(
          service.analyzeSample(
            sideImage: blankSide ? ' ' : side.path,
            endImage: blankSide ? end.path : '',
          ),
          throwsA(imageOnlyError),
        );
      }
      expect(assets.loads, 0);
      expect(calls, 0);
    });

    test('missing photo fails before inference', () async {
      await expectLater(
        service.analyzeSample(
          sideImage: side.path,
          endImage: '${directory.path}/missing.png',
        ),
        throwsA(imageOnlyError),
      );
      expect(calls, 0);
    });

    test('empty photo fails before inference', () async {
      end.writeAsBytesSync([]);
      await expectLater(analyze(), throwsA(imageOnlyError));
      expect(calls, 0);
    });

    test('runner failure releases busy state and permits retry', () async {
      runner = (_) async => throw StateError('Native failure');
      await expectLater(analyze(), throwsA(imageOnlyError));
      runner = (_) async => [1, 0, 0, 0];
      expect((await analyze()).predictedGrade, 'ALBA');
    });

    test('rejects invalid runner output', () async {
      runner = (_) async => [0, 0, 0, 0];
      await expectLater(analyze(), throwsA(imageOnlyError));
    });

    test('rejects overlapping inference', () async {
      final started = Completer<void>();
      final finish = Completer<List<double>>();
      runner = (_) {
        started.complete();
        return finish.future;
      };
      final first = analyze();
      await started.future;
      await expectLater(analyze(), throwsA(imageOnlyError));
      expect(calls, 1);
      finish.complete([1, 0, 0, 0]);
      await first;
      runner = (_) async => [1, 0, 0, 0];
      await analyze();
      expect(calls, 2);
    });

    test('dispose rejects late inference results and future work', () async {
      final started = Completer<void>();
      final finish = Completer<List<double>>();
      runner = (_) {
        started.complete();
        return finish.future;
      };
      final pending = analyze();
      await started.future;
      service.dispose();
      final rejected = expectLater(pending, throwsA(imageOnlyError));
      finish.complete([1, 0, 0, 0]);
      await rejected;
      expect(service.isModelLoaded, isFalse);
      await expectLater(service.initializeModel(), throwsA(imageOnlyError));
      await expectLater(analyze(), throwsA(imageOnlyError));
      expect(calls, 1);
    });

    test('dispose during asset load cannot resurrect the service', () async {
      assets.gate = Completer<void>();
      final pending = service.initializeModel();
      service.dispose();
      final rejected = expectLater(pending, throwsA(imageOnlyError));
      assets.gate!.complete();
      await rejected;
      expect(service.isModelLoaded, isFalse);
      expect(calls, 0);
    });
  });
}

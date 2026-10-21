import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:quill_grade/core/ml/hybrid_config.dart';
import 'package:quill_grade/core/ml/hybrid_image_preprocessor.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

class HybridAssets extends CachingAssetBundle {
  String config = File('assets/models/hybrid_config_v2.json')
      .readAsStringSync();
  Uint8List model = Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]);
  String? missing;
  @override
  Future<ByteData> load(String key) async {
    if (key == missing) throw StateError('Missing asset');
    return ByteData.sublistView(
      key.endsWith('.json') ? Uint8List.fromList(utf8.encode(config)) : model,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final config = HybridConfig.parse(
    File('assets/models/hybrid_config_v2.json').readAsStringSync(),
  );

  test('actual bundled model and config load offline', () async {
    final model = await rootBundle.load(HybridConfig.modelAsset);
    expect(
      model.buffer.asUint8List(model.offsetInBytes + 4, 4),
      'TFL3'.codeUnits,
    );
    final loaded = HybridConfig.parse(
      await rootBundle.loadString(HybridConfig.configAsset),
    );
    expect(loaded.classes, ['ALBA', 'C4', 'C5', 'EXTRA', 'H1', 'H2', 'M4']);
    expect(loaded.diameterMean, 14.438356399536133);
    expect(loaded.diameterStd, 6.741237163543701);
  });

  test(
    'diameter uses JSON mean and standard deviation; rejects invalid values',
    () {
      expect(config.normalizeDiameter(config.diameterMean), 0);
      expect(
        config.normalizeDiameter(config.diameterMean + config.diameterStd),
        closeTo(1, 1e-12),
      );
      expect(
        config.normalizeDiameter(6.8),
        closeTo((6.8 - 14.438356399536133) / 6.741237163543701, 1e-12),
      );
      for (final value in [0.0, -1.0, double.nan, double.infinity, 1e300]) {
        expect(
          () => config.normalizeDiameter(value),
          throwsA(isA<HybridException>()),
        );
      }
    },
  );

  test(
    'malformed config, wrong classes, normalization, and image contract fail',
    () {
      final source = jsonDecode(
        File('assets/models/hybrid_config_v2.json').readAsStringSync(),
      ) as Map<String, dynamic>;
      for (final entry in <String, Object>{
        'diameter_std': 0,
        'class_names': ['ALBA'],
        'image_size': [224, 224, 3],
        'image_pixel_range': '0-1',
        'model_version': 'v1',
      }.entries) {
        expect(
          () => HybridConfig.parse(
            jsonEncode({...source, entry.key: entry.value}),
          ),
          throwsA(isA<HybridException>()),
        );
      }
      expect(
        () => HybridConfig.parse('{broken'),
        throwsA(isA<HybridException>()),
      );
    },
  );

  const inputs = [
    HybridTensor('serving_default_side_image:0', [
      1,
      224,
      224,
      3,
    ], TensorType.float32),
    HybridTensor('serving_default_diameter:0', [1, 1], TensorType.float32),
    HybridTensor('serving_default_end_image:0', [
      1,
      224,
      224,
      3,
    ], TensorType.float32),
  ];
  const outputs = [
    HybridTensor('StatefulPartitionedCall_1:0', [1, 7], TensorType.float32),
  ];
  test('runtime names map image roles even if input order changes', () {
    expect(validateHybridTensors(inputs, outputs), ['side', 'diameter', 'end']);
    expect(validateHybridTensors([inputs[2], inputs[0], inputs[1]], outputs), [
      'end',
      'side',
      'diameter',
    ]);
  });
  test(
    'wrong tensor names, types, batch, channel count and output shape fail',
    () {
      for (final input in [
        const HybridTensor('unknown', [1, 224, 224, 3], TensorType.float32),
        const HybridTensor('serving_default_side_image:0', [
          1,
          224,
          224,
          3,
        ], TensorType.uint8),
        const HybridTensor('serving_default_side_image:0', [
          2,
          224,
          224,
          3,
        ], TensorType.float32),
        const HybridTensor('serving_default_side_image:0', [
          1,
          224,
          224,
          4,
        ], TensorType.float32),
      ]) {
        expect(
          () => validateHybridTensors([input, inputs[1], inputs[2]], outputs),
          throwsA(isA<HybridException>()),
        );
      }
      expect(
        () => validateHybridTensors(inputs, [
          const HybridTensor('out', [1, 6], TensorType.float32),
        ]),
        throwsA(isA<HybridException>()),
      );
    },
  );
  test(
    'all seven classes follow configured order and preserve model probability',
    () {
      for (var i = 0; i < 7; i++) {
        final scores = List<double>.filled(7, 0.025)..[i] = 0.85;
        final result = MLGradeResult.fromOutput(scores, config, 6.8);
        expect(result.predictedGrade, config.classes[i]);
        expect(result.modelProbability, 0.85);
        expect(result.probabilities.length, 7);
      }
      for (final scores in <List<double>>[
        <double>[],
        List<double>.filled(7, 0),
        [double.nan, 1, 0, 0, 0, 0, 0],
        [2.0, 0, 0, 0, 0, 0, 0],
      ]) {
        expect(
          () => MLGradeResult.fromOutput(scores, config, 6.8),
          throwsA(isA<HybridException>()),
        );
      }
    },
  );

  final fixtureDirectory = Directory('test/fixtures/hybrid_preprocessing');
  final manifest = jsonDecode(
    File('${fixtureDirectory.path}/manifest.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  for (final item in manifest['cases'] as List) {
    test('PIL BILINEAR padding golden: ${item['input']}', () {
      final actual = HybridImagePreprocessor.preprocess(
        File('${fixtureDirectory.path}/${item['input']}').readAsBytesSync(),
      );
      final expected = img.decodePng(
        File('${fixtureDirectory.path}/${item['expected']}').readAsBytesSync(),
      )!;
      expect(actual.length, 224 * 224 * 3);
      var maxError = 0.0;
      var totalError = 0.0;
      var offset = 0;
      for (final pixel in expected) {
        for (final channel in [pixel.r, pixel.g, pixel.b]) {
          final error = (actual[offset++] - channel).abs();
          if (error > maxError) maxError = error;
          totalError += error;
        }
      }
      expect(
        maxError,
        lessThanOrEqualTo(item['max_channel_error'] as num),
        reason: 'mean channel error ${totalError / actual.length}',
      );
      expect(
        actual.every((v) => v >= 0 && v <= 255 && v == v.roundToDouble()),
        isTrue,
      );
      // Raw white padding stays 255; no /255 or MobileNet transform.
      if (item['input'] != 'square.png') expect(actual.first, 255);
    });
  }
  test('unreadable image is an error, never a fabricated tensor', () {
    expect(
      () => HybridImagePreprocessor.preprocess(Uint8List(0)),
      throwsA(isA<HybridException>()),
    );
  });

  group('service orchestration with fake inference runner', () {
    late Directory directory;
    late File side;
    late File end;
    late HybridAssets assets;
    setUp(() {
      directory = Directory.systemTemp.createTempSync('hybrid_test_');
      side = File('${directory.path}/side.png')..writeAsBytesSync([1, 2, 3]);
      end = File('${directory.path}/end.png')..writeAsBytesSync([4, 5, 6]);
      assets = HybridAssets();
    });
    tearDown(() => directory.deleteSync(recursive: true));

    test(
      'three inputs preserve side/end identity and normalized diameter',
      () async {
        final service = MLService(
          assets: assets,
          runner: (request) async {
            expect(request.sideBytes, [1, 2, 3]);
            expect(request.endBytes, [4, 5, 6]);
            expect(request.normalizedDiameter, config.normalizeDiameter(6.8));
            return [0.85, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025];
          },
        );
        final result = await service.analyzeSample(
          sideImage: side.path,
          endImage: end.path,
          diameterMm: 6.8,
        );
        expect(result.predictedGrade, 'ALBA');
        expect(result.diameterMm, 6.8);
        service.dispose();
      },
    );
    for (final path in [HybridConfig.modelAsset, HybridConfig.configAsset]) {
      test('missing asset $path produces an error', () async {
        assets.missing = path;
        final service = MLService(
          assets: assets,
          runner: (_) async => throw StateError('Must not run'),
        );
        await expectLater(
          service.analyzeSample(
            sideImage: side.path,
            endImage: end.path,
            diameterMm: 6.8,
          ),
          throwsA(isA<HybridException>()),
        );
        service.dispose();
      });
    }
    test('corrupt model header fails loading', () async {
      assets.model = Uint8List(8);
      final service = MLService(assets: assets);
      await expectLater(
        service.initializeModel(),
        throwsA(isA<HybridException>()),
      );
      expect(service.isModelLoaded, isFalse);
    });
    test(
      'inference exception never invents a prediction and retry can recover',
      () async {
        var calls = 0;
        final service = MLService(
          assets: assets,
          runner: (_) async {
            if (++calls == 1) throw StateError('Native failure');
            return [1, 0, 0, 0, 0, 0, 0];
          },
        );
        await expectLater(
          service.analyzeSample(
            sideImage: side.path,
            endImage: end.path,
            diameterMm: 6.8,
          ),
          throwsA(isA<HybridException>()),
        );
        expect(
          (await service.analyzeSample(
            sideImage: side.path,
            endImage: end.path,
            diameterMm: 6.8,
          )).predictedGrade,
          'ALBA',
        );
        service.dispose();
      },
    );
    test('missing photos fail without invoking model', () async {
      final service = MLService(
        assets: assets,
        runner: (_) async => fail('Must not infer'),
      );
      await expectLater(
        service.analyzeSample(
          sideImage: 'missing.jpg',
          endImage: end.path,
          diameterMm: 6.8,
        ),
        throwsA(isA<HybridException>()),
      );
      service.dispose();
    });
    test(
      'duplicate calls are rejected and disposal ignores in-flight output',
      () async {
        final pending = Completer<List<double>>();
        final started = Completer<void>();
        final service = MLService(
          assets: assets,
          runner: (_) {
            started.complete();
            return pending.future;
          },
        );
        final first = service.analyzeSample(
          sideImage: side.path,
          endImage: end.path,
          diameterMm: 6.8,
        );
        await started.future;
        await expectLater(
          service.analyzeSample(
            sideImage: side.path,
            endImage: end.path,
            diameterMm: 6.8,
          ),
          throwsA(isA<HybridException>()),
        );
        service.dispose();
        final expectation = expectLater(first, throwsA(isA<HybridException>()));
        pending.complete([1, 0, 0, 0, 0, 0, 0]);
        await expectation;
      },
    );
  });
}

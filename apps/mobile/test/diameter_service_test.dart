import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/core/ml/hybrid_config.dart';
import 'package:quill_grade/core/ml/hybrid_image_preprocessor.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

class DiameterAssets extends CachingAssetBundle {
  String config = File(DiameterConfig.configAsset).readAsStringSync();
  Uint8List model = Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]);
  String? missing;
  int loads = 0;
  @override
  Future<ByteData> load(String key) async {
    loads++;
    if (key == missing) throw StateError('Missing asset');
    return ByteData.sublistView(
      key.endsWith('.json') ? Uint8List.fromList(utf8.encode(config)) : model,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final config = DiameterConfig.parse(
    File(DiameterConfig.configAsset).readAsStringSync(),
  );
  final hybrid = HybridConfig.parse(
    File(HybridConfig.configAsset).readAsStringSync(),
  );
  test(
    'installed model and JSON assets are available without network',
    () async {
      await HttpOverrides.runZoned(() async {
        final model = await rootBundle.load(DiameterConfig.modelAsset);
        expect(
          model.buffer.asUint8List(model.offsetInBytes + 4, 4),
          'TFL3'.codeUnits,
        );
        final actual = DiameterConfig.parse(
          await rootBundle.loadString(DiameterConfig.configAsset),
        );
        expect(actual.version, 'diameter_v1');
        expect(actual.targetMean, 14.438356399536133);
        expect(actual.targetStd, 6.741237163543701);
      }, createHttpClient: (_) => throw StateError('Network prohibited'));
    },
  );

  test('JSON denormalization then Hybrid normalization uses millimeters', () {
    expect(config.decodeOutput([0]).diameterMm, config.targetMean);
    expect(
      config.decodeOutput([1]).diameterMm,
      config.targetMean + config.targetStd,
    );
    final estimate = config.decodeOutput([-1]);
    expect(estimate.diameterMm, closeTo(7.697119235992432, 1e-10));
    expect(hybrid.normalizeDiameter(estimate.diameterMm), closeTo(-1, 1e-12));
    final changed = DiameterConfig.parse(
      jsonEncode({
        ...jsonDecode(File(DiameterConfig.configAsset).readAsStringSync())
            as Map<String, dynamic>,
        'target_mean': 20,
        'target_std': 3,
      }),
    );
    expect(changed.decodeOutput([2]).diameterMm, 26);
  });

  test('invalid numeric or wrong-length regression output never returns a diameter', () {
    for (final output in <List<double>>[
      [],
      [1, 2],
      [double.nan],
      [double.infinity],
      [double.negativeInfinity],
      [-10],
      [1e300],
    ]) {
      expect(
        () => config.decodeOutput(output),
        throwsA(isA<DiameterException>()),
      );
    }
    // Use exactly representable values to test zero, rather than a rounded
    // mean/std quotient that reconstructs a tiny positive value in float64.
    final exact = DiameterConfig.parse(
      jsonEncode({
        ...jsonDecode(File(DiameterConfig.configAsset).readAsStringSync())
            as Map<String, dynamic>,
        'target_mean': 10,
        'target_std': 2,
      }),
    );
    expect(() => exact.decodeOutput([-5]), throwsA(isA<DiameterException>()));
  });

  test(
    'configuration must match inspected V1 preprocessing and numeric contract',
    () {
      final json = jsonDecode(
        File(DiameterConfig.configAsset).readAsStringSync(),
      ) as Map<String, dynamic>;
      for (final entry in <String, Object>{
        'target_std': 0,
        'target_mean': 'NaN',
        'image_size': [224],
        'image_pixel_range': '0-1',
        'target_unit': 'cm',
        'model_version': 'v2',
        'output': 'diameter_mm',
        'preprocessing': 'crop',
        'experimental': false,
      }.entries) {
        expect(
          () => DiameterConfig.parse(
            jsonEncode({...json, entry.key: entry.value}),
          ),
          throwsA(isA<DiameterException>()),
        );
      }
      expect(
        () => DiameterConfig.parse('{broken'),
        throwsA(isA<DiameterException>()),
      );
    },
  );

  const input = DiameterTensor('serving_default_end_image:0', [
    1,
    224,
    224,
    3,
  ], TensorType.float32);
  const output = DiameterTensor('StatefulPartitionedCall_1:0', [
    1,
    1,
  ], TensorType.float32);
  test(
    'runtime tensor names shapes dtypes and counts must match inspected model',
    () {
      validateDiameterTensors([input], [output]);
      for (final bad in [
        const DiameterTensor('other', [1, 224, 224, 3], TensorType.float32),
        DiameterTensor(input.name, [1, 224, 224, 3], TensorType.uint8),
        DiameterTensor(input.name, [2, 224, 224, 3], TensorType.float32),
        DiameterTensor(input.name, [1, 224, 224, 4], TensorType.float32),
      ]) {
        expect(
          () => validateDiameterTensors([bad], [output]),
          throwsA(isA<DiameterException>()),
        );
      }
      for (final bad in [
        const DiameterTensor('unknown', [1, 1], TensorType.float32),
        DiameterTensor(output.name, [1, 7], TensorType.float32),
        DiameterTensor(output.name, [1, 1], TensorType.int8),
      ]) {
        expect(
          () => validateDiameterTensors([input], [bad]),
          throwsA(isA<DiameterException>()),
        );
      }
      expect(
        () => validateDiameterTensors([], [output]),
        throwsA(isA<DiameterException>()),
      );
      expect(
        () => validateDiameterTensors([input], []),
        throwsA(isA<DiameterException>()),
      );
      expect(
        () => validateDiameterTensors([input, input], [output]),
        throwsA(isA<DiameterException>()),
      );
    },
  );

  group('service with fake native runner (not physical inference)', () {
    late DiameterAssets assets;
    late Directory temp;
    late File photo;
    setUp(() async {
      assets = DiameterAssets();
      temp = await Directory.systemTemp.createTemp('diameter-test-');
      photo = await File('assets/images/cinnamon_bg.jpg')
          .copy('${temp.path}/end.jpg');
    });
    tearDown(() => temp.delete(recursive: true));

    test('initialization shares loads and native runner receives only the end image', () async {
      var calls = 0;
      final service = DiameterService(
        assets: assets,
        runner: (request) async {
          calls++;
          expect(request.endBytes, await photo.readAsBytes());
          // Same preprocessing exercised by the 21 Pillow fixtures in hybrid_service_test.
          final pixels = HybridImagePreprocessor.preprocess(request.endBytes);
          expect(pixels.length, 224 * 224 * 3);
          expect(pixels.any((v) => v > 1), isTrue);
          expect(pixels.every((v) => v.isFinite && v >= 0 && v <= 255), isTrue);
          return [-1];
        },
      );
      addTearDown(service.dispose);
      await Future.wait([service.initializeModel(), service.initializeModel()]);
      expect(assets.loads, 2);
      final estimate = await service.estimate(photo.path);
      expect(estimate.diameterMm, config.decodeOutput([-1]).diameterMm);
      expect(calls, 1);
    });

    for (final asset in [
      DiameterConfig.modelAsset,
      DiameterConfig.configAsset,
    ]) {
      test('missing $asset fails closed and can retry', () async {
        assets.missing = asset;
        final service = DiameterService(
          assets: assets,
          runner: (_) async => [0],
        );
        addTearDown(service.dispose);
        await expectLater(
          service.estimate(photo.path),
          throwsA(isA<DiameterException>()),
        );
        assets.missing = null;
        expect(
          (await service.estimate(photo.path)).diameterMm,
          config.targetMean,
        );
      });
    }
    test(
      'corrupt model and malformed config fail before native runner',
      () async {
        var calls = 0;
        final service = DiameterService(
          assets: assets,
          runner: (_) async {
            calls++;
            return [0];
          },
        );
        addTearDown(service.dispose);
        assets.model = Uint8List(8);
        await expectLater(
          service.estimate(photo.path),
          throwsA(isA<DiameterException>()),
        );
        expect(calls, 0);
        assets.model = Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]);
        assets.config = '{broken';
        await expectLater(
          service.estimate(photo.path),
          throwsA(isA<DiameterException>()),
        );
        expect(calls, 0);
      },
    );
    test(
      'missing image or native error yields meaningful error and no guess',
      () async {
        final service = DiameterService(
          assets: assets,
          runner: (_) async => throw StateError('native failed'),
        );
        addTearDown(service.dispose);
        await expectLater(
          service.estimate('${temp.path}/missing.jpg'),
          throwsA(isA<DiameterException>()),
        );
        await expectLater(
          service.estimate(photo.path),
          throwsA(isA<DiameterException>()),
        );
      },
    );
    test(
      'duplicate inference is blocked and disposal ignores late output',
      () async {
        final pending = Completer<List<double>>();
        final started = Completer<void>();
        var calls = 0;
        final service = DiameterService(
          assets: assets,
          runner: (_) {
            calls++;
            started.complete();
            return pending.future;
          },
        );
        final first = service.estimate(photo.path);
        final assertion = expectLater(first, throwsA(isA<DiameterException>()));
        await started.future;
        await expectLater(
          service.estimate(photo.path),
          throwsA(isA<DiameterException>()),
        );
        expect(calls, 1);
        service.dispose();
        pending.complete([0]);
        await assertion;
        await expectLater(
          service.initializeModel(),
          throwsA(isA<DiameterException>()),
        );
      },
    );
    test('native exception permits a later explicit retry', () async {
      var calls = 0;
      final service = DiameterService(
        assets: assets,
        runner: (_) async {
          if (++calls == 1) throw StateError('Unavailable');
          return [0];
        },
      );
      addTearDown(service.dispose);
      await expectLater(
        service.estimate(photo.path),
        throwsA(isA<DiameterException>()),
      );
      expect(
        (await service.estimate(photo.path)).diameterMm,
        config.targetMean,
      );
    });
  });
}

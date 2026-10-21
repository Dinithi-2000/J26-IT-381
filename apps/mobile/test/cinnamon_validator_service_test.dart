import 'dart:async';

import 'package:flutter/services.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/ml/image_preprocessor.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import 'support/validation_fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'actual model and indexed labels are bundled at configured asset paths',
    () async {
      final model = await rootBundle.load(
        'assets/models/cinnamon_validator.tflite',
      );
      expect(model.lengthInBytes, 2090732);
      expect(
        model.buffer.asUint8List(model.offsetInBytes + 4, 4),
        'TFL3'.codeUnits,
      );
      final labels = await rootBundle.loadString(
        'assets/models/validator_labels.txt',
      );
      expect(CinnamonValidatorService.parseLabels(labels), testLabels);
    },
  );

  group('Decision policy', () {
    test('only valid cinnamon at or above the threshold is accepted', () {
      expect(
        prediction([0.9, 0.05, 0.05]).status,
        CinnamonValidationStatus.valid,
      );
      expect(prediction([0.8, 0.1, 0.1]).accepted, isTrue);
      expect(prediction([0.799, 0.101, 0.1]).accepted, isFalse);
      expect(
        CinnamonValidationResult.fromScores(testLabels, [
          0.85,
          0.1,
          0.05,
        ], 0.9).accepted,
        isFalse,
      );
    });
    test('hand and other objects are invalid', () {
      for (final scores in [
        [0.05, 0.9, 0.05],
        [0.05, 0.05, 0.9],
      ]) {
        final result = prediction(scores);
        expect(result.status, CinnamonValidationStatus.invalid);
        expect(result.accepted, isFalse);
      }
    });
    test('low confidence in every class is uncertain', () {
      for (final scores in [
        [0.6, 0.2, 0.2],
        [0.2, 0.6, 0.2],
        [0.2, 0.2, 0.6],
      ]) {
        expect(prediction(scores).status, CinnamonValidationStatus.uncertain);
      }
      expect(
        CinnamonValidationResult.fromScores(testLabels, [
          0.5,
          0.5,
          0,
        ], 0.4).status,
        CinnamonValidationStatus.uncertain,
      );
    });
    test('malformed scores and labels fail closed', () {
      for (final scores in <List<double>>[
        [],
        [double.nan, 0, 0],
        [double.infinity, 0, 0],
        [-0.1, 0.1, 1],
        [1.1, 0, 0],
        [0, 0, 0],
        [0.9, 0.9, 0.9],
      ]) {
        expect(prediction(scores).status, CinnamonValidationStatus.modelError);
      }
      expect(
        CinnamonValidationResult.fromScores(
          ['unknown', 'a', 'b'],
          [1, 0, 0],
          0.8,
        ).accepted,
        isFalse,
      );
    });
    test('threshold is configurable and checked without assertions', () {
      final service = CinnamonValidatorService(confidenceThreshold: 0.9);
      expect(service.confidenceThreshold, 0.9);
      service.confidenceThreshold = 0.85;
      expect(service.confidenceThreshold, 0.85);
      for (final value in [0.0, -1.0, 1.1, double.nan, double.infinity]) {
        expect(() => service.confidenceThreshold = value, throwsArgumentError);
        expect(
          () => CinnamonValidatorService(confidenceThreshold: value),
          throwsArgumentError,
        );
      }
    });
  });

  group('Service with fake native model (no real inference)', () {
    late FakeModel model;
    late LabelBundle assets;
    late CinnamonValidatorService service;
    setUp(() {
      model = FakeModel();
      assets = LabelBundle();
      service = CinnamonValidatorService(
        assetBundle: assets,
        modelLoader: (_) async => model,
      );
    });
    tearDown(() => service.dispose());

    test(
      'loads, preprocesses and applies policy to completed inference',
      () async {
        final result = await service.classify(await testPng());
        expect(result.accepted, isTrue);
        expect(model.runs, 1);
        expect(service.isReady, isTrue);
        expect(model.input!.tensor.single.length, 224);
        expect(model.input!.tensor[0][0][0], [1, -1, -1]);
      },
    );
    test('missing model returns MODEL_ERROR', () async {
      final missing = CinnamonValidatorService(
        assetBundle: assets,
        modelLoader: (_) async => throw StateError('Asset missing'),
      );
      final result = await missing.classify(Uint8List(0));
      expect(result.status, CinnamonValidationStatus.modelError);
      expect(missing.state, ValidatorState.error);
      missing.dispose();
    });
    test('native loading failure returns MODEL_ERROR', () async {
      final broken = CinnamonValidatorService(
        assetBundle: assets,
        modelLoader: (_) async => throw ArgumentError('Corrupt FlatBuffer'),
      );
      expect(
        (await broken.classify(Uint8List(0))).status,
        CinnamonValidationStatus.modelError,
      );
      broken.dispose();
    });
    test(
      'inference exception invalidates model and returns MODEL_ERROR',
      () async {
        model.error = StateError('Invoke failed');
        expect(
          (await service.classify(await testPng())).status,
          CinnamonValidationStatus.modelError,
        );
        expect(model.closed, isTrue);
        expect(service.isReady, isFalse);
      },
    );
    test('corrupt image never runs inference', () async {
      expect(
        (await service.classify(Uint8List(0))).status,
        CinnamonValidationStatus.modelError,
      );
      expect(model.runs, 0);
    });
    test('label index mismatch fails before loading model', () async {
      assets.content =
          '1 valid_cinnamon\n0 cinnamon_with_hand\n2 other_objects';
      await service.initialize();
      expect(service.state, ValidatorState.error);
      expect(model.runs, 0);
    });
    test('output label count mismatch fails loading', () async {
      model.outputShape = [1, 4];
      await service.initialize();
      expect(service.state, ValidatorState.error);
      expect(model.closed, isTrue);
    });
    test('unsupported input dimensions fail loading', () async {
      model.inputShape = [1, 224, 224, 1];
      await service.initialize();
      expect(service.state, ValidatorState.error);
    });
    test('quantized input is rejected rather than fed float32', () async {
      model.inputType = TensorType.uint8;
      await service.initialize();
      expect(service.state, ValidatorState.error);
    });
    test('malformed runtime output invalidates model', () async {
      model.scores = [double.nan, 0, 0];
      expect(
        (await service.classify(await testPng())).status,
        CinnamonValidationStatus.modelError,
      );
      expect(service.isReady, isFalse);
    });
    test('failed loading can be retried successfully', () async {
      var attempts = 0;
      final retry = CinnamonValidatorService(
        assetBundle: assets,
        modelLoader: (_) async {
          if (++attempts == 1) throw StateError('Unavailable');
          return model;
        },
      );
      final png = await testPng();
      expect(
        (await retry.classify(png)).status,
        CinnamonValidationStatus.modelError,
      );
      expect((await retry.classify(png)).accepted, isTrue);
      expect(attempts, 2);
      retry.dispose();
    });
    test(
      'concurrent initialization loads once and disposal closes late model',
      () async {
        final pending = Completer<CinnamonModel>();
        var loads = 0;
        final lateService = CinnamonValidatorService(
          assetBundle: assets,
          modelLoader: (_) {
            loads++;
            return pending.future;
          },
        );
        final first = lateService.initialize();
        final second = lateService.initialize();
        await Future<void>.delayed(Duration.zero);
        lateService.dispose();
        pending.complete(model);
        await Future.wait([first, second]);
        expect(loads, 1);
        expect(lateService.isReady, isFalse);
        expect(model.closed, isTrue);
      },
    );
  });

  test(
    'label order follows explicit indices, never hardcoded winner index',
    () {
      final labels = CinnamonValidatorService.parseLabels(
        '0 other_objects\n1 valid_cinnamon\n2 cinnamon_with_hand',
      );
      expect(
        CinnamonValidationResult.fromScores(labels, [
          0.9,
          0.05,
          0.05,
        ], 0.8).accepted,
        isFalse,
      );
      expect(
        CinnamonValidationResult.fromScores(labels, [
          0.05,
          0.9,
          0.05,
        ], 0.8).accepted,
        isTrue,
      );
    },
  );

  test(
    'preprocessor handles non-square images and exact RGB normalization',
    () async {
      final image = await const ImagePreprocessor(
        targetWidth: 4,
        targetHeight: 4,
      ).preprocess(await testPng(width: 8, height: 2));
      expect(image.width, 4);
      expect(image.height, 4);
      expect(image.tensor[0][3][3], [1, -1, -1]);
    },
  );
}

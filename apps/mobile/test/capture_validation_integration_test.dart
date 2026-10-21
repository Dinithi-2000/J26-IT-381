import 'dart:async';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/core/sync/sync_manager.dart';
import 'package:quill_grade/core/services/quill_validator_service.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';

import 'support/validation_fakes.dart';
import 'support/hybrid_capture_fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late AppDatabase db;
  late SampleRepository repository;
  late FakeValidator validator;
  late MemoryPhotos photos;
  late TestAnalysis analysis;
  late TestDiameter diameter;
  late ProviderContainer container;
  late CaptureValidationController controller;
  int cameraCalls = 0;
  int heuristicReads = 0;

  CaptureValidationState current() =>
      container.read(captureValidationControllerProvider);
  // Capture returns while automatic estimation may still be running. Allow
  // immediate fake estimates to settle; pending estimates remain in progress.
  Future<bool> capture() async {
    final result = await controller.processCapture(null);
    await Future<void>.delayed(Duration.zero);
    return result;
  }

  Future<void> expectNoRecords() async {
    expect(await repository.getAllSamples(), isEmpty);
    expect(await db.select(db.syncJobs).get(), isEmpty);
  }

  setUp(() {
    cameraCalls = 0;
    heuristicReads = 0;
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = SampleRepository(db);
    validator = FakeValidator();
    photos = MemoryPhotos();
    analysis = TestAnalysis();
    diameter = TestDiameter();
    container = ProviderContainer(
      overrides: [
        cinnamonValidatorServiceProvider.overrideWithValue(validator),
        capturePhotoStorageProvider.overrideWithValue(photos),
        sampleRepositoryProvider.overrideWithValue(repository),
        authServiceProvider.overrideWithValue(TestAuth()),
        mlServiceProvider.overrideWithValue(analysis),
        diameterServiceProvider.overrideWithValue(diameter),
        quillValidatorServiceProvider.overrideWith((ref) {
          heuristicReads++;
          throw StateError('Heuristics must never be consulted by capture.');
        }),
        capturePhotoProvider.overrideWithValue((_) async {
          cameraCalls++;
          return XFile.fromData(
            Uint8List.fromList([1, 2, 3]),
            path: 'camera-$cameraCalls.jpg',
          );
        }),
      ],
    );
    container.listen(captureValidationControllerProvider, (_, _) {});
    controller = container.read(captureValidationControllerProvider.notifier);
  });
  tearDown(() async {
    container.dispose();
    await db.close();
  });

  test('estimate requires a validated pair; selection and confirmation precede persistence', () async {
    expect(await controller.estimateDiameter(), isFalse);
    expect(diameter.calls, 0);
    await capture();
    expect(await controller.estimateDiameter(), isFalse);
    await capture();
    expect(diameter.calls, 1);
    expect(current().diameterSource, DiameterSource.aiEstimated);
    expect(diameter.endImage, current().endPhotoPath);
    expect(analysis.calls, 0);
    await expectNoRecords();
    final estimate = current().diameterEstimate!;
    expect(
      await controller.gradeWithDiameter(
        estimate.diameterMm,
        source: DiameterSource.aiEstimated,
      ),
      isTrue,
    );
    await expectNoRecords();
    expect(await controller.confirmPrediction(), isTrue);
    final sample = (await repository.getAllSamples()).single;
    expect(sample.diameterMm, 9.25);
    expect(sample.diameterSource, 'ai_estimated');
    expect(sample.diameterModelVersion, 'diameter_v1');
    expect(sample.estimatedDiameterMm, 9.25);
    expect(sample.measuredDiameterMm, isNull);
    expect(sample.measurementMethod, 'experimental_image_regression');
    expect(sample.isSynced, isFalse);
    final payload = sampleSyncFields(sample);
    expect(payload['diameterSource'], 'ai_estimated');
    expect(payload['estimatedDiameterMm'], 9.25);
    expect(payload['diameterModelVersion'], 'diameter_v1');
    expect(payload['measuredDiameterMm'], isNull);
  });

  test(
    'actual caliper override preserves estimate metadata but uses measured mm',
    () async {
      await capture();
      await capture();
      await controller.gradeWithDiameter(
        9.25,
        source: DiameterSource.aiEstimated,
      );
      controller.changeDiameter();
      expect(await controller.confirmPrediction(), isFalse);
      expect(await controller.gradeWithDiameter(6.8), isTrue);
      await controller.confirmPrediction();
      final sample = (await repository.getAllSamples()).single;
      expect(sample.diameterMm, 6.8);
      expect(sample.measuredDiameterMm, 6.8);
      expect(sample.estimatedDiameterMm, 9.25);
      expect(sample.diameterSource, 'caliper_measured');
      expect(sample.measurementMethod, 'digital_caliper_manual');
      expect(sampleSyncFields(sample)['measuredDiameterMm'], 6.8);
    },
  );

  test('estimate errors permit retry or explicit manual entry without implicit grading', () async {
    await capture();
    diameter.error = const DiameterException('Model unavailable');
    await capture();
    expect(current().errorMessage, 'Model unavailable');
    expect(current().diameterSource, DiameterSource.aiEstimated);
    expect(
      await controller.gradeWithDiameter(
        9.25,
        source: DiameterSource.aiEstimated,
      ),
      isFalse,
    );
    expect(current().diameterEstimate, isNull);
    expect(analysis.calls, 0);
    await expectNoRecords();
    diameter.error = null;
    expect(await controller.estimateDiameter(), isTrue);
    expect(await controller.gradeWithDiameter(6.8), isTrue);
  });

  test('duplicate estimate taps and grading during estimation cannot start extra inference', () async {
    await capture();
    diameter.pending = Completer<DiameterEstimate>();
    await capture();
    expect(current().isProcessing, isTrue);
    expect(await controller.estimateDiameter(), isFalse);
    expect(await controller.gradeWithDiameter(6.8), isFalse);
    expect(await capture(), isFalse);
    expect(diameter.calls, 1);
    diameter.pending!.complete(
      const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1'),
    );
    await Future<void>.delayed(Duration.zero);
    expect(current().diameterEstimate!.diameterMm, 9.25);
    await expectNoRecords();
  });

  test(
    'cancel ignores a late diameter estimate and clears temporary photos',
    () async {
      await capture();
      diameter.pending = Completer<DiameterEstimate>();
      await capture();
      controller.resetAll();
      diameter.pending!.complete(
        const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1'),
      );
      await Future<void>.delayed(Duration.zero);
      expect(current().diameterEstimate, isNull);
      expect(current().status, CaptureStatus.idle);
      expect(photos.saved, isEmpty);
      await expectNoRecords();
    },
  );

  test(
    'end retake clears diameter estimate and grade but keeps valid side',
    () async {
      await capture();
      await capture();
      final side = current().sidePhotoPath;
      await controller.gradeWithDiameter(
        9.25,
        source: DiameterSource.aiEstimated,
      );
      controller.retakeEndPhoto();
      expect(current().sidePhotoPath, side);
      expect(current().endPhotoPath, isNull);
      expect(current().diameterEstimate, isNull);
      expect(current().gradeResult, isNull);
      await expectNoRecords();
    },
  );

  test('two validated photos, measured prediction and confirmation create a sample', () async {
    expect(await capture(), isTrue);
    expect(current().currentStep, ScanStep.endView);
    expect(current().validationResult!.status, CinnamonValidationStatus.valid);
    expect(current().sampleId, isNull);
    await expectNoRecords();
    expect(await capture(), isTrue);
    expect(current().status, CaptureStatus.awaitingMeasurement);
    expect(analysis.calls, 0);
    await expectNoRecords();
    expect(await controller.confirmPrediction(), isFalse);
    expect(await controller.gradeWithDiameter(6.8), isTrue);
    await expectNoRecords();
    expect(await controller.confirmPrediction(), isTrue);
    expect(current().status, CaptureStatus.success);
    final samples = await repository.getAllSamples();
    expect(samples, hasLength(1));
    expect(samples.single.predictedGrade, 'ALBA');
    expect(samples.single.diameterMm, 6.8);
    expect(samples.single.modelProbability, 0.9);
    expect(samples.single.modelVersion, 'hybrid_v2');
    expect(samples.single.measurementMethod, 'digital_caliper_manual');
    expect(samples.single.crossSectionHeightMm, isNull);
    expect(samples.single.crossSectionWidthMm, isNull);
    expect(samples.single.needsReview, isTrue);
    expect(samples.single.isSynced, isFalse);
    expect(samples.single.sidePhotoLocalPath, isNotNull);
    expect(samples.single.endPhotoLocalPath, isNotNull);
    expect(analysis.calls, 1);
    expect(heuristicReads, 0);
    expect(await capture(), isFalse);
    expect(validator.calls, 2);
  });

  for (final entry in <CaptureStatus, List<double>>{
    CaptureStatus.invalid: [0.05, 0.9, 0.05],
    CaptureStatus.uncertain: [0.6, 0.2, 0.2],
  }.entries) {
    test('${entry.key} never persists or advances either step', () async {
      validator.result = prediction(entry.value);
      expect(await capture(), isFalse);
      expect(current().status, entry.key);
      expect(current().currentStep, ScanStep.sideView);
      expect(photos.writes, 0);
      expect(diameter.calls, 0);
      await expectNoRecords();
      controller.resetToReady();
      validator.result = prediction([0.9, 0.05, 0.05]);
      await capture();
      final side = current().sidePhotoPath;
      validator.result = prediction(entry.value);
      expect(await capture(), isFalse);
      expect(current().status, entry.key);
      expect(current().sidePhotoPath, side);
      expect(current().endPhotoPath, isNull);
      expect(current().sampleId, isNull);
      expect(diameter.calls, 0);
      expect(analysis.calls, 0);
      await expectNoRecords();
      controller.resetToReady();
      expect(current().sidePhotoPath, side);
      expect(current().validationResult, isNull);
      expect(current().errorMessage, isNull);
    });
  }

  test('other objects are rejected without any persistence', () async {
    validator.result = prediction([0.05, 0.05, 0.9]);
    expect(await capture(), isFalse);
    expect(current().status, CaptureStatus.invalid);
    await expectNoRecords();
  });

  for (final throws in [false, true]) {
    test(
      'model failure (throws=$throws) never invokes heuristic fallback',
      () async {
        validator.result = const CinnamonValidationResult.modelError();
        if (throws) validator.error = StateError('Native exception');
        expect(await capture(), isFalse);
        expect(current().status, CaptureStatus.modelError);
        expect(current().validationResult!.accepted, isFalse);
        expect(heuristicReads, 0);
        expect(photos.writes, 0);
        await expectNoRecords();
      },
    );
  }

  test('repeated capture taps never start duplicate inference', () async {
    validator.pending = Completer<CinnamonValidationResult>();
    final first = controller.processCapture(null);
    await Future<void>.delayed(Duration.zero);
    expect(current().status, CaptureStatus.validating);
    expect(await capture(), isFalse);
    expect(cameraCalls, 1);
    expect(validator.calls, 1);
    validator.pending!.complete(prediction([0.9, 0.05, 0.05]));
    expect(await first, isTrue);
  });

  test('retry uses same photo and does not capture again', () async {
    validator.result = const CinnamonValidationResult.modelError();
    await capture();
    expect(await capture(), isFalse);
    validator.result = prediction([0.9, 0.05, 0.05]);
    expect(await controller.retryValidation(), isTrue);
    expect(validator.calls, 2);
    expect(cameraCalls, 1);
    expect(identical(validator.images[0], validator.images[1]), isTrue);
    expect(current().currentStep, ScanStep.endView);
    await expectNoRecords();
  });

  test('retake discards retry photo and captures anew', () async {
    validator.result = const CinnamonValidationResult.modelError();
    await capture();
    controller.resetToReady();
    expect(await controller.retryValidation(), isFalse);
    validator.result = prediction([0.9, 0.05, 0.05]);
    expect(await capture(), isTrue);
    expect(cameraCalls, 2);
  });

  test('successful end-view validation retry starts automatic estimation exactly once', () async {
    await capture();
    validator.result = const CinnamonValidationResult.modelError();
    expect(await capture(), isFalse);
    expect(diameter.calls, 0);
    validator.result = prediction([0.9, 0.05, 0.05]);
    expect(await controller.retryValidation(), isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(diameter.calls, 1);
    expect(current().diameterEstimate!.diameterMm, 9.25);
    expect(cameraCalls, 2);
    expect(await controller.retryValidation(), isFalse);
    expect(diameter.calls, 1);
    await expectNoRecords();
  });

  test('cancel clears validated side and pending retry image', () async {
    await capture();
    final side = current().sidePhotoPath!;
    validator.result = const CinnamonValidationResult.modelError();
    await capture();
    controller.resetAll();
    expect(current().currentStep, ScanStep.sideView);
    expect(current().sidePhotoPath, isNull);
    expect(current().sampleId, isNull);
    expect(photos.deleted, contains(side));
    expect(await controller.retryValidation(), isFalse);
    await expectNoRecords();
  });

  test('cancel ignores late successful inference', () async {
    validator.pending = Completer<CinnamonValidationResult>();
    final first = controller.processCapture(null);
    await Future<void>.delayed(Duration.zero);
    controller.resetAll();
    expect(await capture(), isFalse);
    validator.pending!.complete(prediction([0.9, 0.05, 0.05]));
    expect(await first, isFalse);
    expect(current().status, CaptureStatus.idle);
    expect(photos.writes, 0);
    await expectNoRecords();
  });

  test(
    'cancel during analysis prevents sample creation and cleans photos',
    () async {
      await capture();
      analysis.pending = Completer<MLGradeResult>();
      await capture();
      final second = controller.gradeWithDiameter(6.8);
      await Future<void>.delayed(Duration.zero);
      expect(analysis.calls, 1);
      controller.resetAll();
      analysis.pending!.complete(testGrade());
      expect(await second, isFalse);
      expect(photos.saved, isEmpty);
      await expectNoRecords();
    },
  );

  test('retaking side removes prior validated state', () async {
    await capture();
    controller.retakeSidePhoto();
    expect(current().currentStep, ScanStep.sideView);
    expect(current().sidePhotoPath, isNull);
    expect(photos.saved, isEmpty);
    await expectNoRecords();
  });

  test('disposing during inference cannot persist a late result', () async {
    validator.pending = Completer<CinnamonValidationResult>();
    final pending = controller.processCapture(null);
    await Future<void>.delayed(Duration.zero);
    container.dispose();
    validator.pending!.complete(prediction([0.9, 0.05, 0.05]));
    expect(await pending, isFalse);
    expect(photos.saved, isEmpty);
    await expectNoRecords();
  });

  test(
    'repository transaction rolls back when cancelled before commit',
    () async {
      var checks = 0;
      await expectLater(
        repository.createAnalyzedSample(
          'u',
          6,
          5,
          'ALBA',
          sidePhotoLocalPath: 'side',
          endPhotoLocalPath: 'end',
          isCurrent: () => ++checks == 1,
        ),
        throwsStateError,
      );
      await expectNoRecords();
    },
  );

  test(
    'missing/invalid caliper input and unvalidated photos cannot run grading',
    () async {
      expect(await controller.gradeWithDiameter(6.8), isFalse);
      expect(analysis.calls, 0);
      await capture();
      await capture();
      for (final diameter in [0.0, -1.0, double.nan, double.infinity]) {
        expect(await controller.gradeWithDiameter(diameter), isFalse);
        expect(current().gradeResult, isNull);
      }
      expect(analysis.calls, 0);
      await expectNoRecords();
    },
  );

  test(
    'inference failure retains validated pair and never saves a guess',
    () async {
      await capture();
      await capture();
      analysis.error = StateError('Inference failed');
      expect(await controller.gradeWithDiameter(6.8), isFalse);
      expect(current().status, CaptureStatus.awaitingMeasurement);
      expect(current().errorMessage, isNotNull);
      expect(current().gradeResult, isNull);
      expect(await controller.confirmPrediction(), isFalse);
      await expectNoRecords();
      analysis.error = null;
      expect(await controller.gradeWithDiameter(6.8), isTrue);
      expect(validator.calls, 2);
    },
  );

  test(
    'changing diameter discards prediction and requires inference again',
    () async {
      await capture();
      await capture();
      await controller.gradeWithDiameter(6.8);
      controller.changeDiameter();
      expect(current().gradeResult, isNull);
      expect(await controller.confirmPrediction(), isFalse);
      await expectNoRecords();
    },
  );

  test(
    'duplicate grading and confirmation cannot produce duplicate records',
    () async {
      await capture();
      await capture();
      analysis.pending = Completer<MLGradeResult>();
      final first = controller.gradeWithDiameter(6.8);
      expect(await controller.gradeWithDiameter(6.8), isFalse);
      analysis.pending!.complete(testGrade());
      expect(await first, isTrue);
      final saving = controller.confirmPrediction();
      expect(await controller.confirmPrediction(), isFalse);
      expect(await saving, isTrue);
      expect(await repository.getAllSamples(), hasLength(1));
      expect(analysis.calls, 1);
    },
  );

  test('retaking end removes prediction but keeps validated side', () async {
    await capture();
    await capture();
    final side = current().sidePhotoPath;
    final end = current().endPhotoPath;
    await controller.gradeWithDiameter(6.8);
    controller.retakeEndPhoto();
    expect(current().sidePhotoPath, side);
    expect(current().endPhotoPath, isNull);
    expect(current().gradeResult, isNull);
    expect(photos.deleted, contains(end));
    expect(await controller.confirmPrediction(), isFalse);
    await expectNoRecords();
  });

  test('absent camera cannot create simulated acceptance', () async {
    final realContainer = ProviderContainer(
      overrides: [
        cinnamonValidatorServiceProvider.overrideWithValue(validator),
        capturePhotoStorageProvider.overrideWithValue(photos),
      ],
    );
    final subscription = realContainer.listen(
      captureValidationControllerProvider,
      (_, _) {},
    );
    final realController = realContainer.read(
      captureValidationControllerProvider.notifier,
    );
    expect(await realController.processCapture(null), isFalse);
    expect(
      realContainer.read(captureValidationControllerProvider).status,
      CaptureStatus.error,
    );
    expect(validator.calls, 0);
    subscription.close();
    realContainer.dispose();
  });
}

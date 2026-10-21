import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/core/ml/image_only_config.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';

import 'support/hybrid_capture_fakes.dart';
import 'support/image_only_capture_fakes.dart';
import 'support/validation_fakes.dart';

class _ControlledRepository extends SampleRepository {
  Completer<void>? gate;
  void Function()? beforeCommit;
  bool failSave = false;
  int calls = 0;
  _ControlledRepository(super.db);

  @override
  Future<String> createImageOnlySample(
    String ownerId,
    ImageOnlyGradeResult result, {
    required String sidePhotoLocalPath,
    required String endPhotoLocalPath,
    required bool Function() isCurrent,
    double? diameterMm,
    DiameterSource? diameterSource,
    DiameterEstimate? diameterEstimate,
  }) async {
    calls++;
    if (gate != null) await gate!.future;
    if (failSave) throw StateError('Storage unavailable');
    var checks = 0;
    return super.createImageOnlySample(
      ownerId,
      result,
      sidePhotoLocalPath: sidePhotoLocalPath,
      endPhotoLocalPath: endPhotoLocalPath,
      diameterMm: diameterMm,
      diameterSource: diameterSource,
      diameterEstimate: diameterEstimate,
      isCurrent: () {
        if (++checks == 3) beforeCommit?.call();
        return isCurrent();
      },
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  late AppDatabase db;
  late _ControlledRepository repository;
  late ProviderContainer container;
  late CaptureValidationController controller;
  late FakeValidator validator;
  late TestImageOnly imageOnly;
  late TestDiameter diameter;
  late TestAnalysis hybrid;
  late TestFilePhotos photos;

  CaptureValidationState current() =>
      container.read(captureValidationControllerProvider);
  Future<void> capture() async {
    await controller.processCapture(null);
    await Future<void>.delayed(Duration.zero);
  }

  Future<void> pair() async {
    await capture();
    await capture();
  }

  setUp(() {
    directory = Directory.systemTemp.createTempSync('four_class_capture_');
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = _ControlledRepository(db);
    validator = FakeValidator();
    imageOnly = TestImageOnly();
    diameter = TestDiameter();
    hybrid = TestAnalysis();
    photos = TestFilePhotos(directory);
    container = ProviderContainer(
      overrides: [
        cinnamonValidatorServiceProvider.overrideWithValue(validator),
        imageOnlyServiceProvider.overrideWithValue(imageOnly),
        diameterServiceProvider.overrideWithValue(diameter),
        mlServiceProvider.overrideWithValue(hybrid),
        sampleRepositoryProvider.overrideWithValue(repository),
        authServiceProvider.overrideWithValue(TestAuth()),
        capturePhotoStorageProvider.overrideWithValue(photos),
        capturePhotoProvider.overrideWithValue(
          (_) async => XFile.fromData(
            Uint8List.fromList([1, 2, 3]),
            path: 'test-camera.png',
          ),
        ),
      ],
    );
    container.listen(captureValidationControllerProvider, (_, _) {});
    controller = container.read(captureValidationControllerProvider.notifier);
    controller.selectGradingMode(GradingMode.imageOnly);
  });
  tearDown(() async {
    container.dispose();
    await db.close();
    directory.deleteSync(recursive: true);
  });

  for (var i = 0; i < 4; i++) {
    final winner = i;
    test(
      'validated pair saves exact ${ImageOnlyConfig.classes[winner]} with no diameter',
      () async {
        imageOnly.scores = List<double>.filled(4, 0.1)..[winner] = 0.7;
        expect(await controller.gradeImageOnly(), isFalse);
        await capture();
        expect(imageOnly.calls, 0);
        expect(current().gradingMode, GradingMode.imageOnly);
        await capture();
        expect(validator.calls, 2);
        expect(imageOnly.calls, 1);
        expect(imageOnly.side, current().sidePhotoPath);
        expect(imageOnly.end, current().endPhotoPath);
        expect(diameter.calls, 0);
        expect(hybrid.calls, 0);
        expect(await repository.getAllSamples(), isEmpty);
        expect(await controller.confirmPrediction(), isTrue);
        final sample = (await repository.getAllSamples()).single;
        expect(sample.predictedGrade, ImageOnlyConfig.classes[winner]);
        expect(sample.modelVersion, ImageOnlyConfig.modelVersion);
        expect(sample.modelProbability, 0.7);
        expect(sample.diameterMm, isNull);
        expect(sample.diameterSource, isNull);
        expect(sample.measuredDiameterMm, isNull);
        expect(sample.estimatedDiameterMm, isNull);
        expect(sample.needsReview, isTrue);
        expect(sample.isSynced, isFalse);
        expect(sample.ownerId, 'test-user');
        expect(current().sampleId, sample.id);
        controller.resetAll();
        expect(File(sample.sidePhotoLocalPath!).existsSync(), isTrue);
        expect(File(sample.endPhotoLocalPath!).existsSync(), isTrue);
        expect(await controller.confirmPrediction(), isFalse);
      },
    );
  }

  test(
    'mode selection locks after first capture and hybrid remains independent',
    () async {
      expect(controller.selectGradingMode(GradingMode.hybrid), isTrue);
      await capture();
      expect(controller.selectGradingMode(GradingMode.imageOnly), isFalse);
      await capture();
      expect(await controller.gradeImageOnly(), isFalse);
      expect(diameter.calls, 1);
      expect(imageOnly.calls, 0);
      expect(await controller.gradeWithDiameter(6.8), isTrue);
      expect(await controller.confirmPrediction(), isTrue);
      final sample = (await repository.getAllSamples()).single;
      expect(sample.modelVersion, 'hybrid_v2');
      expect(sample.diameterMm, 6.8);
      expect(sample.diameterSource, 'caliper_measured');
    },
  );

  test(
    'image-only rejects diameter operations and switching after validation',
    () async {
      await pair();
      expect(await controller.estimateDiameter(), isFalse);
      expect(await controller.gradeWithDiameter(9), isFalse);
      controller.changeDiameter();
      expect(current().imageOnlyResult, isNotNull);
      expect(controller.selectGradingMode(GradingMode.hybrid), isFalse);
      expect(diameter.calls, 0);
      expect(hybrid.calls, 0);
    },
  );

  for (final rejectedSide in [true, false]) {
    test(
      'rejected ${rejectedSide ? 'side' : 'end'} photo never reaches grading',
      () async {
        if (!rejectedSide) await capture();
        validator.result = prediction([0.01, 0.01, 0.98]);
        await capture();
        expect(current().status, CaptureStatus.invalid);
        expect(imageOnly.calls, 0);
        expect(await controller.confirmPrediction(), isFalse);
        expect(await repository.getAllSamples(), isEmpty);
        controller.resetAll();
        expect(photos.saved, isEmpty);
      },
    );
  }

  for (final message in [
    'Image-only model asset could not be loaded.',
    'Image-only inference failed.',
  ]) {
    test('$message allows retry without hybrid fallback', () async {
      imageOnly.error = ImageOnlyException(message);
      await pair();
      expect(current().status, CaptureStatus.awaitingImageOnlyPrediction);
      expect(current().errorMessage, message);
      expect(current().imageOnlyResult, isNull);
      expect(await controller.confirmPrediction(), isFalse);
      expect(diameter.calls, 0);
      expect(hybrid.calls, 0);
      expect(await repository.getAllSamples(), isEmpty);
      imageOnly.error = null;
      expect(await controller.gradeImageOnly(), isTrue);
      expect(validator.calls, 2);
      expect(imageOnly.calls, 2);
    });
  }

  test('retake end clears result, keeps side and preserves mode', () async {
    await pair();
    final side = current().sidePhotoPath!;
    final oldEnd = current().endPhotoPath!;
    controller.retakeEndPhoto();
    expect(current().gradingMode, GradingMode.imageOnly);
    expect(current().sidePhotoPath, side);
    expect(current().imageOnlyResult, isNull);
    expect(current().endPhotoPath, isNull);
    expect(File(oldEnd).existsSync(), isFalse);
    expect(await controller.confirmPrediction(), isFalse);
    await capture();
    expect(imageOnly.calls, 2);
    expect(current().endPhotoPath, isNot(oldEnd));
    controller.retakeSidePhoto();
    expect(photos.saved, isEmpty);
    expect(current().currentStep, ScanStep.sideView);
    expect(current().gradingMode, GradingMode.imageOnly);
    expect(current().imageOnlyResult, isNull);
  });

  test(
    'duplicate inference is blocked and cancel discards late results',
    () async {
      imageOnly.pending = Completer<ImageOnlyGradeResult>();
      await pair();
      expect(current().status, CaptureStatus.grading);
      expect(await controller.gradeImageOnly(), isFalse);
      expect(await controller.confirmPrediction(), isFalse);
      expect(await controller.processCapture(null), isFalse);
      controller.resetAll();
      imageOnly.pending!.complete(
        ImageOnlyGradeResult.fromOutput([1, 0, 0, 0]),
      );
      await Future<void>.delayed(Duration.zero);
      expect(current().status, CaptureStatus.idle);
      expect(current().imageOnlyResult, isNull);
      expect(photos.saved, isEmpty);
      expect(imageOnly.calls, 1);
      expect(await repository.getAllSamples(), isEmpty);
    },
  );

  test(
    'duplicate confirmation and cancellation during commit are blocked',
    () async {
      await pair();
      repository.gate = Completer<void>();
      final saving = controller.confirmPrediction();
      expect(current().status, CaptureStatus.committing);
      expect(await controller.confirmPrediction(), isFalse);
      controller.resetAll();
      expect(current().status, CaptureStatus.committing);
      expect(photos.saved, hasLength(2));
      repository.gate!.complete();
      expect(await saving, isTrue);
      expect(repository.calls, 1);
      expect(await repository.getAllSamples(), hasLength(1));
    },
  );

  test(
    'provider disposal before commit rolls back row and cleans photos',
    () async {
      await pair();
      repository.beforeCommit = container.dispose;
      expect(await controller.confirmPrediction(), isFalse);
      expect(await repository.getAllSamples(), isEmpty);
      expect(photos.saved, isEmpty);
    },
  );

  test(
    'save failure retains result and photos for an explicit retry',
    () async {
      await pair();
      repository.failSave = true;
      expect(await controller.confirmPrediction(), isFalse);
      expect(current().status, CaptureStatus.reviewPrediction);
      expect(current().imageOnlyResult, isNotNull);
      expect(photos.saved, hasLength(2));
      expect(await repository.getAllSamples(), isEmpty);
      repository.failSave = false;
      expect(await controller.confirmPrediction(), isTrue);
      expect(await repository.getAllSamples(), hasLength(1));
      expect(imageOnly.calls, 1);
    },
  );
}

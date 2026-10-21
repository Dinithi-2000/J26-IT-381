import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/ml/image_only_config.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';
import 'package:quill_grade/features/scan/result_screen.dart';
import 'package:quill_grade/features/scan/scan_screen.dart';

import 'scan_screen_validation_test.dart' show TestCamera;
import 'support/hybrid_capture_fakes.dart';
import 'support/image_only_capture_fakes.dart';
import 'support/validation_fakes.dart';

void main() {
  late Directory directory;
  late AppDatabase db;
  late SampleRepository repository;
  late ProviderContainer container;
  late TestImageOnly imageOnly;
  late TestDiameter diameter;
  late TestAnalysis hybrid;
  late FakeValidator validator;
  late TestFilePhotos photos;
  late TestCamera camera;
  late CameraPlatform original;
  late GoRouter router;

  setUp(() {
    original = CameraPlatform.instance;
    camera = TestCamera();
    CameraPlatform.instance = camera;
    directory = Directory.systemTemp.createTempSync('four_class_widgets_');
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = SampleRepository(db);
    imageOnly = TestImageOnly();
    diameter = TestDiameter();
    hybrid = TestAnalysis();
    validator = FakeValidator();
    photos = TestFilePhotos(directory);
    container = ProviderContainer(
      overrides: [
        imageOnlyServiceProvider.overrideWithValue(imageOnly),
        diameterServiceProvider.overrideWithValue(diameter),
        mlServiceProvider.overrideWithValue(hybrid),
        cinnamonValidatorServiceProvider.overrideWithValue(validator),
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
    router = GoRouter(
      initialLocation: '/scan',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: Text('Home')),
        ),
        GoRoute(path: '/scan', builder: (_, _) => const ScanScreen()),
        GoRoute(
          path: '/result/:id',
          builder: (_, state) =>
              ResultScreen(sampleId: state.pathParameters['id']!),
        ),
      ],
    );
  });
  tearDown(() async {
    camera.errors.add(const CameraErrorEvent(1, 'Test complete'));
    await camera.errors.close();
    CameraPlatform.instance = original;
    router.dispose();
    container.dispose();
    await db.close();
    directory.deleteSync(recursive: true);
  });

  Future<void> start(WidgetTester tester, {bool selectImageOnly = true}) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    final selector = find.byKey(const Key('gradingModeSelector'));
    expect(
      tester.widget<DropdownButton<GradingMode>>(selector).value,
      GradingMode.hybrid,
    );
    if (selectImageOnly) {
      await tester.tap(selector);
      await tester.pumpAndSettle();
      await tester.tap(find.text('4-Class Image-Only').last);
      await tester.pumpAndSettle();
    }
  }

  Future<void> capturePair(WidgetTester tester, {bool pending = false}) async {
    await tester.tap(find.byIcon(Icons.camera_alt));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<DropdownButton<GradingMode>>(
            find.byKey(const Key('gradingModeSelector')),
          )
          .onChanged,
      isNull,
    );
    await tester.tap(find.byIcon(Icons.lens));
    if (pending) {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    } else {
      await tester.pumpAndSettle();
    }
  }

  testWidgets(
    'select four-class, review every label, save and navigate to exact Special result',
    (tester) async {
      await start(tester);
      await capturePair(tester);
      expect(find.text('4-Class Image-Only Prediction'), findsOneWidget);
      expect(find.byKey(const Key('imageOnlyGrade')), findsOneWidget);
      expect(find.text('Special'), findsOneWidget);
      expect(find.text('C5 Special'), findsNothing);
      expect(find.text('Confidence: 40.00%'), findsOneWidget);
      for (final line in [
        'ALBA: 10.00%',
        'C4: 20.00%',
        'C5: 30.00%',
        'Special: 40.00%',
      ]) {
        expect(find.text(line), findsOneWidget);
      }
      expect(find.byKey(const Key('caliperDiameter')), findsNothing);
      expect(find.text('Use AI Estimate'), findsNothing);
      expect(diameter.calls, 0);
      expect(hybrid.calls, 0);
      expect(await repository.getAllSamples(), isEmpty);
      await tester.runAsync(() async {
        final saved = Completer<void>();
        final subscription = container.listen(
          captureValidationControllerProvider,
          (_, next) {
            if (next.status == CaptureStatus.success && !saved.isCompleted) {
              saved.complete();
            }
          },
        );
        try {
          await tester.tap(find.text('Confirm & Save'));
          await saved.future.timeout(const Duration(seconds: 5));
        } finally {
          subscription.close();
        }
      });
      await tester.pumpAndSettle();
      final sample = (await repository.getAllSamples()).single;
      expect(
        router.routeInformationProvider.value.uri.path,
        '/result/${sample.id}',
      );
      expect(find.text('Scan Result'), findsOneWidget);
      expect(find.text('Special'), findsOneWidget);
      expect(find.text('Model probability: 40.00%'), findsOneWidget);
      expect(find.text('Not measured'), findsNWidgets(2));
      expect(sample.modelVersion, ImageOnlyConfig.modelVersion);
      expect(sample.diameterMm, isNull);
      expect(sample.predictedGrade, 'Special');
      expect(File(sample.sidePhotoLocalPath!).existsSync(), isTrue);
      expect(File(sample.endPhotoLocalPath!).existsSync(), isTrue);
    },
  );

  testWidgets(
    'existing hybrid selection retains estimation and manual caliper UI',
    (tester) async {
      await start(tester, selectImageOnly: false);
      await capturePair(tester);
      expect(find.text('Experimental Prediction'), findsOneWidget);
      expect(find.text('Use AI Estimate'), findsOneWidget);
      expect(diameter.calls, 1);
      expect(imageOnly.calls, 0);
      await tester.ensureVisible(
        find.text('Enter Caliper Measurement Instead'),
      );
      await tester.tap(find.text('Enter Caliper Measurement Instead'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('caliperDiameter')), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
    },
  );

  for (final message in [
    'Image-only model asset could not be loaded.',
    'Image-only inference failed.',
  ]) {
    testWidgets('shows $message with explicit retry and no fallback', (
      tester,
    ) async {
      imageOnly.error = ImageOnlyException(message);
      await start(tester);
      await capturePair(tester);
      expect(find.text(message), findsOneWidget);
      expect(find.text('Confirm & Save'), findsNothing);
      expect(await repository.getAllSamples(), isEmpty);
      imageOnly.error = null;
      await tester.tap(find.text('Retry 4-Class Prediction'));
      await tester.pumpAndSettle();
      expect(find.text('Special'), findsOneWidget);
      expect(imageOnly.calls, 2);
      expect(validator.calls, 2);
      expect(diameter.calls, 0);
      expect(hybrid.calls, 0);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
    });
  }

  for (final systemBack in [false, true]) {
    testWidgets(
      '${systemBack ? 'system back' : 'cancel'} during inference discards late result',
      (tester) async {
        imageOnly.pending = Completer<ImageOnlyGradeResult>();
        await start(tester);
        await capturePair(tester, pending: true);
        expect(find.text('Running 4-Class prediction...'), findsOneWidget);
        expect(
          tester
              .widget<ElevatedButton>(
                find.widgetWithText(ElevatedButton, 'Retry 4-Class Prediction'),
              )
              .onPressed,
          isNull,
        );
        if (systemBack) {
          await tester.binding.handlePopRoute();
        } else {
          await tester.tap(find.text('Cancel'));
        }
        await tester.pumpAndSettle();
        imageOnly.pending!.complete(
          ImageOnlyGradeResult.fromOutput([1, 0, 0, 0]),
        );
        await tester.pumpAndSettle();
        expect(find.text('Home'), findsOneWidget);
        expect(photos.saved, isEmpty);
        expect(await repository.getAllSamples(), isEmpty);
      },
    );
  }

  testWidgets(
    'retake end retains side and mode; retake both returns to side capture',
    (tester) async {
      await start(tester);
      await capturePair(tester);
      final side = container
          .read(captureValidationControllerProvider)
          .sidePhotoPath;
      await tester.tap(find.text('Retake End Photo'));
      await tester.pumpAndSettle();
      expect(find.text('Step 2 of 2: End View Cut'), findsOneWidget);
      expect(
        container.read(captureValidationControllerProvider).sidePhotoPath,
        side,
      );
      expect(photos.saved, hasLength(1));
      await tester.tap(find.byIcon(Icons.lens));
      await tester.pumpAndSettle();
      expect(imageOnly.calls, 2);
      await tester.tap(find.text('Retake Both Photos'));
      await tester.pumpAndSettle();
      expect(find.text('Step 1 of 2: Side View'), findsOneWidget);
      expect(photos.saved, isEmpty);
      expect(
        tester
            .widget<DropdownButton<GradingMode>>(
              find.byKey(const Key('gradingModeSelector')),
            )
            .value,
        GradingMode.imageOnly,
      );
    },
  );

  testWidgets(
    'invalid end photo uses existing cinnamon rejection and never grades',
    (tester) async {
      await start(tester);
      await tester.tap(find.byIcon(Icons.camera_alt));
      await tester.pumpAndSettle();
      validator.result = prediction([0.01, 0.01, 0.98]);
      await tester.tap(find.byIcon(Icons.lens));
      await tester.pumpAndSettle();
      expect(find.text('4-Class Image-Only Prediction'), findsNothing);
      expect(imageOnly.calls, 0);
      expect(await repository.getAllSamples(), isEmpty);
      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();
      expect(find.text('Step 2 of 2: End View Cut'), findsOneWidget);
    },
  );
}

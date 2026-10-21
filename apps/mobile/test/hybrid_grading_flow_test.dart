import 'dart:async';
import 'dart:typed_data';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';
import 'package:quill_grade/features/scan/scan_screen.dart';
import 'package:quill_grade/features/scan/result_screen.dart';

import 'support/validation_fakes.dart';
import 'support/hybrid_capture_fakes.dart';
import 'scan_screen_validation_test.dart' show TestCamera;

void main() {
  late AppDatabase db;
  late SampleRepository repository;
  late ProviderContainer container;
  late TestAnalysis analysis;
  late TestDiameter diameter;
  late TestCamera camera;
  late CameraPlatform original;
  late GoRouter router;
  setUp(() {
    original = CameraPlatform.instance;
    camera = TestCamera();
    CameraPlatform.instance = camera;
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = SampleRepository(db);
    analysis = TestAnalysis();
    diameter = TestDiameter();
    container = ProviderContainer(
      overrides: [
        cinnamonValidatorServiceProvider.overrideWithValue(FakeValidator()),
        mlServiceProvider.overrideWithValue(analysis),
        diameterServiceProvider.overrideWithValue(diameter),
        sampleRepositoryProvider.overrideWithValue(repository),
        authServiceProvider.overrideWithValue(TestAuth()),
        capturePhotoStorageProvider.overrideWithValue(MemoryPhotos()),
        capturePhotoProvider.overrideWithValue(
          (_) async =>
              XFile.fromData(Uint8List.fromList([1, 2, 3]), path: 'camera.jpg'),
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
  });

  Future<void> openGrading(
    WidgetTester tester, {
    bool waitForEstimate = true,
  }) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.camera_alt));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.lens));
    if (waitForEstimate) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(find.text('Experimental Prediction'), findsOneWidget);
  }

  Future<void> openCaliper(WidgetTester tester) async {
    await openGrading(tester);
    expect(find.byKey(const Key('caliperDiameter')), findsNothing);
    await tester.ensureVisible(find.text('Enter Caliper Measurement Instead'));
    await tester.tap(find.text('Enter Caliper Measurement Instead'));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'caliper validation, prediction, confirmation and stored result',
    (tester) async {
      await openCaliper(tester);
      await tester.tap(find.text('Predict Grade'));
      await tester.pumpAndSettle();
      expect(
        find.text('Enter a finite diameter greater than 0 in millimeters.'),
        findsOneWidget,
      );
      expect(analysis.calls, 0);
      await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
      await tester.tap(find.text('Predict Grade'));
      await tester.pumpAndSettle();
      expect(find.text('ALBA'), findsOneWidget);
      expect(find.text('Model probability: 90.00%'), findsOneWidget);
      expect(await repository.getAllSamples(), isEmpty);
      await tester.tap(find.text('Confirm & Save'));
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await tester.pumpAndSettle();
      expect(await repository.getAllSamples(), hasLength(1));
      expect(find.text('Experimental Prediction'), findsOneWidget);
      expect(find.text('Model probability: 90.00%'), findsOneWidget);
      expect(find.text('6.80 mm'), findsOneWidget);
      expect(find.text('Not measured'), findsOneWidget);
      expect(find.textContaining('Optical Confidence'), findsNothing);
    },
  );

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  testWidgets(
    'explicit AI selection grades in mm and saves its experimental source',
    (tester) async {
      await openGrading(tester);
      expect(diameter.calls, 1);
      expect(find.text('Experimental Estimate: 9.25 mm'), findsOneWidget);
      expect(analysis.calls, 0);
      expect(await repository.getAllSamples(), isEmpty);
      expect(find.byKey(const Key('caliperDiameter')), findsNothing);
      await tapVisible(tester, find.text('Use AI Estimate'));
      expect(analysis.lastDiameterMm, 9.25);
      expect(
        find.text('Experimental estimated diameter: 9.25 mm'),
        findsOneWidget,
      );
      expect(await repository.getAllSamples(), isEmpty);
      await tester.tap(find.text('Confirm & Save'));
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await tester.pumpAndSettle();
      expect(
        (await repository.getAllSamples()).single.diameterSource,
        'ai_estimated',
      );
      expect(
        find.textContaining('Experimental Estimate from end-view photo'),
        findsOneWidget,
      );
      expect(
        find.text('Manually measured with a digital caliper'),
        findsNothing,
      );
    },
  );

  testWidgets('manual override of an AI prediction requires a fresh grade', (
    tester,
  ) async {
    await openGrading(tester);
    await tapVisible(tester, find.text('Use AI Estimate'));
    await tapVisible(tester, find.text('Enter Caliper Measurement Instead'));
    expect(find.text('Confirm & Save'), findsNothing);
    await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
    await tapVisible(tester, find.text('Predict Grade'));
    expect(find.text('Caliper diameter: 6.80 mm'), findsOneWidget);
    expect(analysis.calls, 2);
  });

  testWidgets(
    'diameter error displays retry and keeps manual input available',
    (tester) async {
      diameter.error = const DiameterException('Diameter model unavailable');
      await openGrading(tester);
      expect(find.text('Diameter model unavailable'), findsOneWidget);
      expect(find.byKey(const Key('caliperDiameter')), findsNothing);
      expect(
        tester
            .widget<ElevatedButton>(
              find.widgetWithText(ElevatedButton, 'Use AI Estimate'),
            )
            .onPressed,
        isNull,
      );
      expect(analysis.calls, 0);
      diameter.error = null;
      await tapVisible(tester, find.byKey(const Key('estimateDiameter')));
      expect(find.text('Experimental Estimate: 9.25 mm'), findsOneWidget);
    },
  );

  testWidgets(
    'cancel while estimating navigates away and discards late estimate',
    (tester) async {
      diameter.pending = Completer<DiameterEstimate>();
      await openGrading(tester, waitForEstimate: false);
      expect(find.textContaining('Estimating diameter'), findsOneWidget);
      expect(diameter.calls, 1);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      diameter.pending!.complete(
        const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(await repository.getAllSamples(), isEmpty);
    },
  );

  testWidgets('editing diameter invalidates displayed prediction', (
    tester,
  ) async {
    await openCaliper(tester);
    await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
    await tester.tap(find.text('Predict Grade'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('caliperDiameter')), '9');
    await tester.pumpAndSettle();
    expect(find.text('Confirm & Save'), findsNothing);
    expect(find.text('Predict Grade'), findsOneWidget);
    expect(await repository.getAllSamples(), isEmpty);
  });

  testWidgets(
    'system back during automatic estimation cancels the scan safely',
    (tester) async {
      diameter.pending = Completer<DiameterEstimate>();
      await openGrading(tester, waitForEstimate: false);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      diameter.pending!.complete(
        const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(await repository.getAllSamples(), isEmpty);
    },
  );

  testWidgets('model failure shows error and permits retry without saving', (
    tester,
  ) async {
    await openCaliper(tester);
    analysis.error = StateError('Native failure');
    await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
    await tester.tap(find.text('Predict Grade'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Hybrid grading failed'), findsOneWidget);
    expect(find.text('Confirm & Save'), findsNothing);
    expect(await repository.getAllSamples(), isEmpty);
    analysis.error = null;
    await tester.tap(find.text('Predict Grade'));
    await tester.pumpAndSettle();
    expect(find.text('Confirm & Save'), findsOneWidget);
  });

  testWidgets(
    'cancel during grading does not persist or navigate to a result',
    (tester) async {
      await openCaliper(tester);
      analysis.pending = Completer<MLGradeResult>();
      await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
      await tester.tap(find.text('Predict Grade'));
      await tester.pump();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      analysis.pending!.complete(testGrade());
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(await repository.getAllSamples(), isEmpty);
    },
  );

  testWidgets('retake end returns to existing camera and retains valid side', (
    tester,
  ) async {
    await openCaliper(tester);
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
    expect(
      container.read(captureValidationControllerProvider).endPhotoPath,
      isNull,
    );
    expect(await repository.getAllSamples(), isEmpty);
    await tester.tap(find.byIcon(Icons.lens));
    await tester.pumpAndSettle();
    expect(diameter.calls, 2);
    expect(find.text('Experimental Estimate: 9.25 mm'), findsOneWidget);
    expect(find.byKey(const Key('caliperDiameter')), findsNothing);
  });

  testWidgets(
    'automatic error allows explicit caliper fallback without retrying diameter',
    (tester) async {
      diameter.error = const DiameterException('Diameter model unavailable');
      await openCaliper(tester);
      await tester.enterText(find.byKey(const Key('caliperDiameter')), '6.8');
      await tapVisible(tester, find.text('Predict Grade'));
      expect(analysis.lastDiameterMm, 6.8);
      expect(diameter.calls, 1);
      expect(find.text('Caliper diameter: 6.80 mm'), findsOneWidget);
      expect(await repository.getAllSamples(), isEmpty);
    },
  );

  testWidgets(
    'automatic estimation progress prevents duplicate inference and premature grading',
    (tester) async {
      diameter.pending = Completer<DiameterEstimate>();
      await openGrading(tester, waitForEstimate: false);
      expect(find.byKey(const Key('caliperDiameter')), findsNothing);
      expect(
        tester
            .widget<ElevatedButton>(
              find.widgetWithText(ElevatedButton, 'Use AI Estimate'),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<TextButton>(find.byKey(const Key('estimateDiameter')))
            .onPressed,
        isNull,
      );
      await tester.pump();
      expect(diameter.calls, 1);
      expect(analysis.calls, 0);
      diameter.pending!.complete(
        const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1'),
      );
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('Use AI Estimate'));
      expect(analysis.lastDiameterMm, 9.25);
      expect(diameter.calls, 1);
    },
  );
}

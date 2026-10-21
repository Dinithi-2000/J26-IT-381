import 'dart:async';
import 'dart:typed_data';

import 'package:camera_platform_interface/camera_platform_interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';
import 'package:quill_grade/features/scan/scan_screen.dart';

import 'support/validation_fakes.dart';

class TestCamera extends CameraPlatform {
  final errors = StreamController<CameraErrorEvent>.broadcast();
  @override
  Future<List<CameraDescription>> availableCameras() async => [
    const CameraDescription(
      name: 'test',
      lensDirection: CameraLensDirection.back,
      sensorOrientation: 0,
    ),
  ];
  @override
  Future<int> createCameraWithSettings(
    CameraDescription camera,
    MediaSettings settings,
  ) async => 1;
  @override
  Future<void> initializeCamera(
    int cameraId, {
    ImageFormatGroup imageFormatGroup = ImageFormatGroup.unknown,
  }) async {}
  @override
  Stream<CameraInitializedEvent> onCameraInitialized(int cameraId) =>
      Stream.value(
        CameraInitializedEvent(
          cameraId,
          640,
          480,
          ExposureMode.auto,
          false,
          FocusMode.auto,
          false,
        ),
      );
  @override
  Stream<CameraErrorEvent> onCameraError(int cameraId) => errors.stream;
  @override
  Stream<DeviceOrientationChangedEvent> onDeviceOrientationChanged() =>
      const Stream.empty();
  @override
  Widget buildPreview(int cameraId) => const SizedBox.expand();
  @override
  Future<void> dispose(int cameraId) async {}
}

class WidgetPhotos extends CapturePhotoStorage {
  @override
  Future<String> save(Uint8List bytes, String prefix) async => '$prefix.jpg';
  @override
  Future<void> delete(String path) async {}
}

void main() {
  late TestCamera camera;
  late CameraPlatform originalCamera;
  late FakeValidator validator;
  late ProviderContainer container;
  late GoRouter router;
  var cameraCalls = 0;

  setUp(() {
    originalCamera = CameraPlatform.instance;
    camera = TestCamera();
    CameraPlatform.instance = camera;
    validator = FakeValidator();
    cameraCalls = 0;
    container = ProviderContainer(
      overrides: [
        cinnamonValidatorServiceProvider.overrideWithValue(validator),
        capturePhotoStorageProvider.overrideWithValue(WidgetPhotos()),
        sampleRepositoryProvider.overrideWith(
          (ref) => throw StateError('Rejected photo accessed storage'),
        ),
        capturePhotoProvider.overrideWithValue((_) async {
          cameraCalls++;
          return XFile.fromData(
            Uint8List.fromList([1, 2, 3]),
            path: 'camera.jpg',
          );
        }),
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
      ],
    );
  });
  tearDown(() {
    // Resolve the camera plugin's .first error subscription before closing.
    camera.errors.add(const CameraErrorEvent(1, 'Test complete'));
    camera.errors.close();
    CameraPlatform.instance = originalCamera;
    router.dispose();
    container.dispose();
  });

  Future<void> start(WidgetTester tester) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> capture(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.camera_alt));
    await tester.pumpAndSettle();
  }

  testWidgets('invalid shows existing Try Again dialog and stays on camera', (
    tester,
  ) async {
    validator.result = prediction([0.05, 0.9, 0.05]);
    await start(tester);
    await capture(tester);
    expect(find.text('Invalid Item Detected'), findsOneWidget);
    expect(find.textContaining('Side view verified!'), findsNothing);
    await tester.tap(find.text('Try Again'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Step 1 of 2: Side View'), findsOneWidget);
    expect(
      container.read(captureValidationControllerProvider).status,
      CaptureStatus.idle,
    );
  });

  testWidgets('uncertain displays exact retake message without success', (
    tester,
  ) async {
    validator.result = prediction([0.6, 0.2, 0.2]);
    await start(tester);
    await capture(tester);
    expect(
      find.text('Unable to confirm cinnamon. Please capture a clearer photo.'),
      findsOneWidget,
    );
    expect(find.textContaining('Side view verified!'), findsNothing);
  });

  testWidgets(
    'model error retry uses same image and advances only after VALID',
    (tester) async {
      validator.result = const CinnamonValidationResult.modelError();
      await start(tester);
      await capture(tester);
      expect(
        find.text(
          'Cinnamon validation is temporarily unavailable. Please retry.',
        ),
        findsOneWidget,
      );
      expect(find.text('Retry Validation'), findsOneWidget);
      expect(find.text('Retake Photo'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.textContaining('Side view verified!'), findsNothing);
      validator.result = prediction([0.9, 0.05, 0.05]);
      await tester.tap(find.text('Retry Validation'));
      await tester.pumpAndSettle();
      expect(cameraCalls, 1);
      expect(validator.calls, 2);
      expect(find.text('Step 2 of 2: End View Cut'), findsOneWidget);
    },
  );

  testWidgets('model error retake stays on camera and clears retry state', (
    tester,
  ) async {
    validator.result = const CinnamonValidationResult.modelError();
    await start(tester);
    await capture(tester);
    await tester.tap(find.text('Retake Photo'));
    await tester.pumpAndSettle();
    expect(find.text('Step 1 of 2: Side View'), findsOneWidget);
    final controller = container.read(
      captureValidationControllerProvider.notifier,
    );
    expect(await controller.retryValidation(), isFalse);
  });

  testWidgets('model error cancel navigates home and resets the scan', (
    tester,
  ) async {
    validator.result = const CinnamonValidationResult.modelError();
    await start(tester);
    await capture(tester);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(
      container.read(captureValidationControllerProvider).sidePhotoPath,
      isNull,
    );
  });

  testWidgets(
    'shutter disabled while inference runs; cancel ignores late VALID',
    (tester) async {
      validator.pending = Completer<CinnamonValidationResult>();
      await start(tester);
      await tester.tap(find.byIcon(Icons.camera_alt));
      await tester.pump();
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.byType(CircularProgressIndicator));
      await tester.pump();
      expect(validator.calls, 1);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
      validator.pending!.complete(prediction([0.9, 0.05, 0.05]));
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(find.textContaining('Side view verified!'), findsNothing);
    },
  );
}

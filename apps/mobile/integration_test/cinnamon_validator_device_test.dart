import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';

class NoNetwork extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) =>
      throw StateError('Offline inference must not use HTTP.');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('installed model performs real offline inference', (
    tester,
  ) async {
    // Also run on a physical device with airplane mode enabled. This override
    // prevents Dart HTTP but cannot disable the device's native network stack.
    await HttpOverrides.runZoned(() async {
      final service = CinnamonValidatorService();
      try {
        await service.initialize();
        expect(service.isReady, isTrue, reason: service.lastError);
        expect(service.labels, [
          'valid_cinnamon',
          'cinnamon_with_hand',
          'other_objects',
        ]);
        expect(service.inputWidth, 224);
        expect(service.inputHeight, 224);
        final image = await rootBundle.load('assets/images/cinnamon_bg.jpg');
        final bytes = image.buffer.asUint8List(
          image.offsetInBytes,
          image.lengthInBytes,
        );
        for (var i = 0; i < 2; i++) {
          final result = await service.classify(bytes);
          expect(
            result.status,
            isNot(CinnamonValidationStatus.modelError),
            reason: service.lastError,
          );
          expect(result.probabilities.length, 3);
          expect(result.confidence!.isFinite, isTrue);
          // This background image is a runtime fixture, not a labelled accuracy test.
        }
      } finally {
        service.dispose();
      }
    }, createHttpClient: NoNetwork().createHttpClient);
  });

  testWidgets('missing installed model returns MODEL_ERROR', (tester) async {
    final service = CinnamonValidatorService(
      modelAssetPath: 'assets/models/missing.tflite',
    );
    try {
      expect(
        (await service.classify(Uint8List(0))).status,
        CinnamonValidationStatus.modelError,
      );
      expect(service.isReady, isFalse);
    } finally {
      service.dispose();
    }
  });
}

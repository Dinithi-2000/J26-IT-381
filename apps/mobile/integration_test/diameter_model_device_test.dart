import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/core/ml/hybrid_config.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';

Future<Uint8List> bytes(String path) async {
  final data = await rootBundle.load(path);
  return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'installed diameter model and Hybrid V2 run offline as a native chain',
    (tester) async {
      // Also run the physical device in airplane mode. This override blocks Dart
      // HTTP in this isolate, not native network access or Android connectivity.
      await HttpOverrides.runZoned(
        () async {
          final model = await bytes(DiameterConfig.modelAsset);
          final photo = await bytes('assets/images/cinnamon_bg.jpg');
          final config = DiameterConfig.parse(
            await rootBundle.loadString(DiameterConfig.configAsset),
          );
          final raw = await runDiameterModel(DiameterRequest(model, photo));
          final estimate = config.decodeOutput(raw);
          expect(estimate.diameterMm.isFinite, isTrue);
          expect(estimate.diameterMm, greaterThan(0));
          final repeated = await runDiameterModel(
            DiameterRequest(model, photo),
          );
          expect(repeated.single, closeTo(raw.single, 1e-5));

          final hybrid = HybridConfig.parse(
            await rootBundle.loadString(HybridConfig.configAsset),
          );
          final scores = await runHybridModel(
            HybridRequest(
              await bytes(HybridConfig.modelAsset),
              photo,
              photo,
              hybrid.normalizeDiameter(estimate.diameterMm),
            ),
          );
          final result = MLGradeResult.fromOutput(
            scores,
            hybrid,
            estimate.diameterMm,
          );
          expect(result.probabilities.length, 7);
          expect(result.diameterMm, estimate.diameterMm);
          // Background artwork is an invocation smoke fixture, not a held-out
          // labelled sample. This test establishes no diameter or grade accuracy.
        },
        createHttpClient: (_) =>
            throw StateError('Offline smoke test attempted HTTP'),
      );
    },
  );

  testWidgets(
    'real native model loading and image preprocessing failures return errors',
    (tester) async {
      final photo = await bytes('assets/images/cinnamon_bg.jpg');
      await expectLater(
        runDiameterModel(
          DiameterRequest(
            Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]),
            photo,
          ),
        ),
        throwsA(isA<DiameterException>()),
      );
      await expectLater(
        runDiameterModel(
          DiameterRequest(
            await bytes(DiameterConfig.modelAsset),
            Uint8List.fromList([1, 2, 3]),
          ),
        ),
        throwsA(isA<DiameterException>()),
      );
    },
  );
}

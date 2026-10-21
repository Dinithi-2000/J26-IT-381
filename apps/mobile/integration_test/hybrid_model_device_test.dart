import 'dart:convert';
import 'dart:io';
import 'dart:typed_data' show Endian;

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path/path.dart' as p;
import 'package:quill_grade/core/ml/hybrid_config.dart';
import 'package:quill_grade/core/ml/hybrid_image_preprocessor.dart';
import 'package:quill_grade/core/services/ml_service.dart';

Future<Uint8List> assetBytes(String path) async {
  final data = await rootBundle.load(path);
  return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'real installed Hybrid V2 model runs offline with all three inputs',
    (tester) async {
      // Run the physical device in airplane mode too. Dart HTTP is blocked here;
      // this test does not change Android's native connectivity settings.
      await HttpOverrides.runZoned(
        () async {
          final model = await assetBytes(HybridConfig.modelAsset);
          final config = HybridConfig.parse(
            await rootBundle.loadString(HybridConfig.configAsset),
          );
          final image = await assetBytes('assets/images/cinnamon_bg.jpg');
          final request = HybridRequest(
            model,
            image,
            image,
            config.normalizeDiameter(6.8),
          );
          final scores = await runHybridModel(request);
          final result = MLGradeResult.fromOutput(scores, config, 6.8);
          expect(result.probabilities.length, 7);
          expect(config.classes, contains(result.predictedGrade));
          final repeated = await runHybridModel(request);
          for (var i = 0; i < 7; i++) {
            expect(repeated[i], closeTo(scores[i], 1e-5));
          }
          // Existing background image is a runtime fixture, not a labelled accuracy case.
        },
        createHttpClient: (_) =>
            throw StateError('Offline smoke test attempted HTTP.'),
      );
    },
  );

  testWidgets('native corrupt model fails without a prediction', (
    tester,
  ) async {
    final broken = Uint8List.fromList([0, 0, 0, 0, ...'TFL3'.codeUnits]);
    final photo = await assetBytes('assets/images/cinnamon_bg.jpg');
    await expectLater(
      runHybridModel(HybridRequest(broken, photo, photo, 0)),
      throwsA(isA<HybridException>()),
    );
  });

  const fixture = String.fromEnvironment('HYBRID_FIXTURE_ASSET');
  testWidgets('real Colab full-probability fixture (requires exported manifest)', (
    tester,
  ) async {
    final manifest = jsonDecode(
      await rootBundle.loadString(fixture),
    ) as Map<String, dynamic>;
    final config = HybridConfig.parse(
      await rootBundle.loadString(HybridConfig.configAsset),
    );
    final model = await assetBytes(HybridConfig.modelAsset);
    expect(sha256.convert(model).toString(), manifest['model_sha256']);
    expect(config.classes, manifest['class_names']);
    expect(config.diameterMean, manifest['diameter_mean']);
    expect(config.diameterStd, manifest['diameter_std']);
    final base = p.posix.dirname(fixture);
    final side = await assetBytes(
      p.posix.join(base, manifest['side'] as String),
    );
    final end = await assetBytes(p.posix.join(base, manifest['end'] as String));
    for (final entry in {'side_tensor': side, 'end_tensor': end}.entries) {
      final actual = HybridImagePreprocessor.preprocess(entry.value);
      final expectedBytes = await assetBytes(
        p.posix.join(base, manifest[entry.key] as String),
      );
      final expected = ByteData.sublistView(expectedBytes);
      expect(expected.lengthInBytes, actual.length * 4);
      // Up to three RGB units for independent JPEG decoders; probability check
      // below remains separate and tight. Never compare grade names alone.
      for (var i = 0; i < actual.length; i++) {
        expect(
          actual[i],
          closeTo(expected.getFloat32(i * 4, Endian.little), 3),
        );
      }
    }
    final diameter = (manifest['diameter_mm'] as num).toDouble();
    final normalized = config.normalizeDiameter(diameter);
    expect(
      normalized,
      closeTo((manifest['normalized_diameter'] as num).toDouble(), 1e-6),
    );
    final actual = await runHybridModel(
      HybridRequest(model, side, end, normalized),
    );
    final expected = (manifest['probabilities'] as List).cast<num>();
    expect(expected.length, 7);
    for (var i = 0; i < 7; i++) {
      expect(
        actual[i],
        closeTo(expected[i].toDouble(), 1e-4),
        reason:
            'Class ${config.classes[i]} differs from Colab; investigate preprocessing/runtime.',
      );
    }
  }, skip: fixture.isEmpty);
}

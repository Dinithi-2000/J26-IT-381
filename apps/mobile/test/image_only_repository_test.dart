import 'dart:io';

import 'package:drift/drift.dart' as drift;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/core/ml/hybrid_config.dart';
import 'package:quill_grade/core/ml/image_only_config.dart';
import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';

// The normal result factory prevents invalid records. This external
// implementation exercises validation at the repository trust boundary too.
class _UntrustedResult implements ImageOnlyGradeResult {
  @override
  final String predictedGrade;
  @override
  final double confidence;
  @override
  final String modelVersion;
  @override
  final Map<String, double> probabilities;

  const _UntrustedResult({
    this.predictedGrade = 'ALBA',
    this.confidence = 0.7,
    this.modelVersion = 'image_only_4class_v1',
    this.probabilities = const {
      'ALBA': 0.7,
      'C4': 0.1,
      'C5': 0.1,
      'Special': 0.1,
    },
  });
}

ImageOnlyGradeResult _prediction([int winner = 0]) =>
    ImageOnlyGradeResult.fromOutput(
      List<double>.filled(4, 0.1)..[winner] = 0.7,
    );

void main() {
  late AppDatabase db;
  late SampleRepository repository;
  late Directory directory;
  late File side;
  late File end;

  setUp(() async {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = SampleRepository(db);
    directory = await Directory.systemTemp.createTemp('image_only_repository_');
    final image = img.Image(width: 2, height: 3);
    img.fill(image, color: img.ColorRgb8(200, 120, 40));
    side = await File('${directory.path}/side.png')
        .writeAsBytes(img.encodePng(image));
    img.fill(image, color: img.ColorRgb8(100, 60, 20));
    end = await File('${directory.path}/end.png')
        .writeAsBytes(img.encodePng(image));
  });

  tearDown(() async {
    await db.close();
    await directory.delete(recursive: true);
  });

  Future<String> save({
    String owner = 'owner',
    ImageOnlyGradeResult? result,
    String? sidePath,
    String? endPath,
    double? diameter,
    DiameterSource? source,
    DiameterEstimate? estimate,
    bool Function()? isCurrent,
  }) => repository.createImageOnlySample(
    owner,
    result ?? _prediction(),
    sidePhotoLocalPath: sidePath ?? side.path,
    endPhotoLocalPath: endPath ?? end.path,
    diameterMm: diameter,
    diameterSource: source,
    diameterEstimate: estimate,
    isCurrent: isCurrent ?? () => true,
  );

  Future<void> expectEmpty() async {
    expect(await repository.getAllSamples(), isEmpty);
    expect(await db.select(db.syncJobs).get(), isEmpty);
  }

  for (var index = 0; index < 4; index++) {
    final winner = index;
    test(
      'saves and reloads ${ImageOnlyConfig.classes[winner]} with no diameter',
      () async {
        final before = DateTime.now().subtract(const Duration(seconds: 1));
        final sideBefore = await side.readAsBytes();
        final endBefore = await end.readAsBytes();
        final id = await save(result: _prediction(winner));
        final sample = await repository.getSample(id);
        expect(
          sample.id,
          matches(
            RegExp(
              r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
            ),
          ),
        );
        expect(sample.sampleId, 'SMP-$id');
        expect(sample.ownerId, 'owner');
        expect(sample.predictedGrade, ImageOnlyConfig.classes[winner]);
        expect(sample.modelProbability, 0.7);
        expect(sample.modelVersion, 'image_only_4class_v1');
        expect(sample.sidePhotoLocalPath, side.path);
        expect(sample.endPhotoLocalPath, end.path);
        expect(sample.captureTimestamp.isAfter(before), isTrue);
        expect(sample.captureTimestamp.isAfter(DateTime.now()), isFalse);
        expect(sample.diameterMm, isNull);
        expect(sample.diameterSource, isNull);
        expect(sample.diameterModelVersion, isNull);
        expect(sample.estimatedDiameterMm, isNull);
        expect(sample.measuredDiameterMm, isNull);
        expect(sample.measurementMethod, isNull);
        expect(sample.crossSectionWidthMm, isNull);
        expect(sample.crossSectionHeightMm, isNull);
        expect(sample.calibrationVersion, isNull);
        expect(sample.needsReview, isTrue);
        expect(sample.isSynced, isFalse);
        expect(sample.revision, 1);
        expect(sample.expertGrade, isNull);
        expect(sample.serverReceiptTime, isNull);
        expect(sample.sidePhotoCloudPath, isNull);
        expect(sample.endPhotoCloudPath, isNull);
        expect(await db.select(db.syncJobs).get(), isEmpty);
        expect(await side.readAsBytes(), sideBefore);
        expect(await end.readAsBytes(), endBefore);
      },
    );
  }

  test('persists a supplied caliper diameter with its true source', () async {
    final sample = await repository.getSample(
      await save(diameter: 6.8, source: DiameterSource.caliperMeasured),
    );
    expect(sample.diameterMm, 6.8);
    expect(sample.measuredDiameterMm, 6.8);
    expect(sample.diameterSource, 'caliper_measured');
    expect(sample.measurementMethod, 'digital_caliper_manual');
    expect(sample.estimatedDiameterMm, isNull);
    expect(sample.diameterModelVersion, isNull);
    expect(sample.modelVersion, ImageOnlyConfig.modelVersion);
  });

  test(
    'preserves a supplied matching AI estimate without calling a model',
    () async {
      final sample = await repository.getSample(
        await save(
          diameter: 7.2,
          source: DiameterSource.aiEstimated,
          estimate: const DiameterEstimate(
            diameterMm: 7.2,
            modelVersion: 'diameter_v1',
          ),
        ),
      );
      expect(sample.diameterMm, 7.2);
      expect(sample.estimatedDiameterMm, 7.2);
      expect(sample.diameterModelVersion, 'diameter_v1');
      expect(sample.diameterSource, 'ai_estimated');
      expect(sample.measurementMethod, 'experimental_image_regression');
      expect(sample.measuredDiameterMm, isNull);
    },
  );

  test(
    'caliper selection retains separately supplied estimate metadata',
    () async {
      final sample = await repository.getSample(
        await save(
          diameter: 6.8,
          source: DiameterSource.caliperMeasured,
          estimate: const DiameterEstimate(
            diameterMm: 7.2,
            modelVersion: 'diameter_v1',
          ),
        ),
      );
      expect(sample.diameterMm, 6.8);
      expect(sample.measuredDiameterMm, 6.8);
      expect(sample.estimatedDiameterMm, 7.2);
      expect(sample.diameterSource, 'caliper_measured');
      expect(sample.diameterModelVersion, 'diameter_v1');
    },
  );

  final invalidResults = <String, ImageOnlyGradeResult>{
    'legacy grade': const _UntrustedResult(predictedGrade: 'EXTRA'),
    'grade spelling': const _UntrustedResult(predictedGrade: 'special'),
    'legacy model': const _UntrustedResult(modelVersion: 'hybrid_v2'),
    'unknown model': const _UntrustedResult(
      modelVersion: 'image_only_4class_v2',
    ),
    'non-winning grade': const _UntrustedResult(predictedGrade: 'C4'),
    'mismatched confidence': const _UntrustedResult(confidence: 0.6),
    'NaN confidence': const _UntrustedResult(confidence: double.nan),
    'infinite confidence': const _UntrustedResult(confidence: double.infinity),
    'missing probability': const _UntrustedResult(
      probabilities: {'ALBA': 0.7, 'C4': 0.2, 'C5': 0.1},
    ),
    'extra probability': const _UntrustedResult(
      probabilities: {
        'ALBA': 0.7,
        'C4': 0.1,
        'C5': 0.1,
        'Special': 0.1,
        'EXTRA': 0,
      },
    ),
    'wrong probability label': const _UntrustedResult(
      probabilities: {'ALBA': 0.7, 'C4': 0.1, 'C5': 0.1, 'special': 0.1},
    ),
    'NaN probability': const _UntrustedResult(
      probabilities: {'ALBA': 0.7, 'C4': double.nan, 'C5': 0.1, 'Special': 0.1},
    ),
    'infinite probability': const _UntrustedResult(
      probabilities: {
        'ALBA': 0.7,
        'C4': double.infinity,
        'C5': 0.1,
        'Special': 0.1,
      },
    ),
    'negative probability': const _UntrustedResult(
      probabilities: {'ALBA': 0.7, 'C4': -0.1, 'C5': 0.2, 'Special': 0.2},
    ),
    'probability above one': const _UntrustedResult(
      probabilities: {'ALBA': 1.1, 'C4': 0, 'C5': 0, 'Special': 0},
    ),
    'invalid probability sum': const _UntrustedResult(
      probabilities: {'ALBA': 0.7, 'C4': 0, 'C5': 0, 'Special': 0},
    ),
  };
  for (final entry in invalidResults.entries) {
    test('rejects ${entry.key} without a partial row', () async {
      await expectLater(
        save(result: entry.value),
        throwsA(isA<ImageOnlyException>()),
      );
      await expectEmpty();
    });
  }

  test(
    'probability keys are mapped by label, not map insertion order',
    () async {
      final id = await save(
        result: const _UntrustedResult(
          probabilities: {'Special': 0.1, 'C5': 0.1, 'C4': 0.1, 'ALBA': 0.7},
        ),
      );
      expect((await repository.getSample(id)).predictedGrade, 'ALBA');
    },
  );

  test('missing owner is rejected', () async {
    for (final owner in ['', '   ']) {
      await expectLater(save(owner: owner), throwsA(isA<ImageOnlyException>()));
    }
    await expectEmpty();
  });

  for (final badSide in [true, false]) {
    test(
      'rejects blank, missing, empty and directory ${badSide ? 'side' : 'end'} paths',
      () async {
        final empty = await File('${directory.path}/empty.png')
            .writeAsBytes([]);
        for (final path in [
          '',
          ' ',
          '${directory.path}/missing.png',
          empty.path,
          directory.path,
        ]) {
          await expectLater(
            save(
              sidePath: badSide ? path : side.path,
              endPath: badSide ? end.path : path,
            ),
            throwsA(isA<ImageOnlyException>()),
          );
          await expectEmpty();
        }
        expect(await side.exists(), isTrue);
        expect(await end.exists(), isTrue);
      },
    );
  }

  test('rejects invalid optional diameters', () async {
    for (final value in [0.0, -1.0, double.nan, double.infinity, 1e300]) {
      await expectLater(
        save(diameter: value, source: DiameterSource.caliperMeasured),
        throwsA(isA<ImageOnlyException>()),
      );
    }
    await expectEmpty();
  });

  test(
    'never assumes a diameter source or invents a missing diameter',
    () async {
      await expectLater(
        save(diameter: 6.8),
        throwsA(isA<ImageOnlyException>()),
      );
      await expectLater(
        save(source: DiameterSource.caliperMeasured),
        throwsA(isA<ImageOnlyException>()),
      );
      await expectLater(
        save(
          estimate: const DiameterEstimate(
            diameterMm: 6.8,
            modelVersion: 'diameter_v1',
          ),
        ),
        throwsA(isA<ImageOnlyException>()),
      );
      await expectLater(
        save(diameter: 6.8, source: DiameterSource.aiEstimated),
        throwsA(isA<ImageOnlyException>()),
      );
      await expectEmpty();
    },
  );

  test('rejects mismatched or malformed estimate provenance', () async {
    for (final estimate in [
      const DiameterEstimate(diameterMm: 7.2, modelVersion: 'diameter_v1'),
      const DiameterEstimate(diameterMm: 6.8, modelVersion: 'unknown'),
      const DiameterEstimate(
        diameterMm: double.nan,
        modelVersion: 'diameter_v1',
      ),
    ]) {
      await expectLater(
        save(
          diameter: 6.8,
          source: DiameterSource.aiEstimated,
          estimate: estimate,
        ),
        throwsA(isA<ImageOnlyException>()),
      );
    }
    await expectLater(
      save(
        diameter: 6.8,
        source: DiameterSource.caliperMeasured,
        estimate: const DiameterEstimate(
          diameterMm: -2,
          modelVersion: 'diameter_v1',
        ),
      ),
      throwsA(isA<ImageOnlyException>()),
    );
    await expectEmpty();
  });

  for (final cancelledAt in [1, 2, 3]) {
    test(
      'cancellation at checkpoint $cancelledAt rolls back and preserves existing rows',
      () async {
        final oldId = await repository.createNewSample('legacy-owner');
        final old = await repository.getSample(oldId);
        var checks = 0;
        await expectLater(
          save(isCurrent: () => ++checks < cancelledAt),
          throwsStateError,
        );
        expect(checks, cancelledAt);
        expect(await repository.getAllSamples(), [old]);
        expect(await db.select(db.syncJobs).get(), isEmpty);
        expect(await side.exists(), isTrue);
        expect(await end.exists(), isTrue);
        // A cancelled transaction must not poison later saves.
        await save();
        expect(await repository.getAllSamples(), hasLength(2));
      },
    );
  }

  test(
    'SQLite failure rolls back without changing an existing sample or sync job',
    () async {
      final oldId = await repository.createNewSample('legacy-owner');
      final old = await repository.getSample(oldId);
      await db
          .into(db.syncJobs)
          .insert(
            SyncJobsCompanion.insert(
              id: 'existing-job',
              sampleId: oldId,
              operation: 'update',
              createdAt: DateTime.now(),
              retryCount: const drift.Value(2),
            ),
          );
      final jobsBefore = await db.select(db.syncJobs).get();
      await db.customStatement('''
      CREATE TRIGGER reject_image_only AFTER INSERT ON samples
      WHEN NEW.model_version = 'image_only_4class_v1'
      BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;
    ''');
      await expectLater(save(), throwsA(isA<SqliteException>()));
      expect(await repository.getAllSamples(), [old]);
      expect(await db.select(db.syncJobs).get(), jobsBefore);
      expect(await side.exists(), isTrue);
      expect(await end.exists(), isTrue);
    },
  );

  test('concurrent saves have unique UUIDs and display IDs', () async {
    final ids = await Future.wait(List.generate(12, (_) => save()));
    expect(ids.toSet(), hasLength(12));
    final samples = await repository.getAllSamples();
    expect(samples, hasLength(12));
    expect(samples.map((s) => s.sampleId).toSet(), hasLength(12));
  });

  test('persists across closing and reopening an actual SQLite file without migration', () async {
    await db.close();
    final file = File('${directory.path}/samples.sqlite');
    db = AppDatabase.forTesting(NativeDatabase(file));
    repository = SampleRepository(db);
    final id = await save(result: _prediction(3));
    final before = await repository.getSample(id);
    await db.close();
    db = AppDatabase.forTesting(NativeDatabase(file));
    repository = SampleRepository(db);
    expect(await repository.getSample(id), before);
    expect(db.schemaVersion, 3);
    final version = await db.customSelect('PRAGMA user_version').getSingle();
    expect(version.read<int>('user_version'), 3);
  });

  test(
    'legacy seven-class saves remain unchanged beside image-only records',
    () async {
      for (final grade in HybridConfig.expectedClasses) {
        final id = await repository.createHybridSample(
          'legacy-owner',
          MLGradeResult(
            predictedGrade: grade,
            modelProbability: 0.9,
            diameterMm: 6.8,
            modelVersion: 'hybrid_v2',
            probabilities: {grade: 0.9},
          ),
          sidePhotoLocalPath: 'legacy-side.jpg',
          endPhotoLocalPath: 'legacy-end.jpg',
          isCurrent: () => true,
        );
        final legacy = await repository.getSample(id);
        expect(legacy.predictedGrade, grade);
        expect(legacy.modelVersion, 'hybrid_v2');
        expect(legacy.diameterMm, 6.8);
        expect(legacy.measuredDiameterMm, 6.8);
        expect(legacy.diameterSource, 'caliper_measured');
        expect(legacy.measurementMethod, 'digital_caliper_manual');
        expect(legacy.modelProbability, 0.9);
      }
      final before = await repository.getAllSamples();
      await save(result: _prediction(3));
      for (final sample in before) {
        expect(await repository.getSample(sample.id), sample);
      }
      expect(await repository.getAllSamples(), hasLength(8));
      await expectLater(
        repository.createHybridSample(
          'owner',
          const MLGradeResult(
            predictedGrade: 'Special',
            modelProbability: 0.9,
            diameterMm: 6.8,
            modelVersion: 'hybrid_v2',
            probabilities: {'Special': 0.9},
          ),
          sidePhotoLocalPath: 'side',
          endPhotoLocalPath: 'end',
          isCurrent: () => true,
        ),
        throwsA(isA<HybridException>()),
      );
      expect(await repository.getAllSamples(), hasLength(8));
    },
  );
}

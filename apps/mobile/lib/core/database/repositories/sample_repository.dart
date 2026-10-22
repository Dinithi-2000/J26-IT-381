import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' as drift;

import '../app_database.dart';
import '../database_provider.dart';
import '../../services/ml_service.dart';
import '../../ml/hybrid_config.dart';
import '../../ml/diameter_config.dart';
import '../../ml/image_only_config.dart';
import '../../services/image_only_service.dart';

final sampleRepositoryProvider = Provider<SampleRepository>((ref) {
  final db = ref.watch(databaseProvider);
  return SampleRepository(db);
});

class SampleRepository {
  final AppDatabase _db;
  final _uuid = const Uuid();

  SampleRepository(this._db);

  /// Saves a confirmed image-only prediction without invoking any models.
  /// Photo files remain caller-owned and must stay available until commit.
  /// Schema v3 stores the winning probability, not the full probability vector.
  Future<String> createImageOnlySample(
    String ownerId,
    ImageOnlyGradeResult result, {
    required String sidePhotoLocalPath,
    required String endPhotoLocalPath,
    required bool Function() isCurrent,
    double? diameterMm,
    DiameterSource? diameterSource,
    DiameterEstimate? diameterEstimate,
  }) => _db.transaction(() async {
    if (!isCurrent()) throw StateError('Capture cancelled.');

    // Snapshot and validate even externally implemented result objects before
    // any asynchronous work. Never infer label order from map insertion order.
    final grade = result.predictedGrade;
    final confidence = result.confidence;
    final version = result.modelVersion;
    final probabilities = Map<String, double>.of(result.probabilities);
    if (ownerId.trim().isEmpty ||
        version != ImageOnlyConfig.modelVersion ||
        !ImageOnlyConfig.classes.contains(grade) ||
        probabilities.length != ImageOnlyConfig.classes.length ||
        !ImageOnlyConfig.classes.every(probabilities.containsKey)) {
      throw const ImageOnlyException(
        'Cannot save an invalid image-only record.',
      );
    }
    final validated = ImageOnlyGradeResult.fromOutput([
      for (final label in ImageOnlyConfig.classes) probabilities[label]!,
    ]);
    if (!confidence.isFinite ||
        confidence != validated.confidence ||
        grade != validated.predictedGrade) {
      throw const ImageOnlyException(
        'Image-only grade or confidence does not match its probabilities.',
      );
    }

    final estimatedMm = diameterEstimate?.diameterMm;
    final diameterVersion = diameterEstimate?.modelVersion;
    if (diameterMm == null) {
      if (diameterSource != null || diameterEstimate != null) {
        throw const ImageOnlyException(
          'Diameter provenance requires a supplied diameter.',
        );
      }
    } else if (HybridConfig.diameterError(diameterMm) != null ||
        diameterSource == null ||
        (diameterEstimate != null &&
            (HybridConfig.diameterError(estimatedMm) != null ||
                diameterVersion != 'diameter_v1')) ||
        (diameterSource == DiameterSource.aiEstimated &&
            (diameterEstimate == null || diameterMm != estimatedMm))) {
      throw const ImageOnlyException(
        'Diameter source does not match the supplied measurement or estimate.',
      );
    }

    for (final path in [sidePhotoLocalPath, endPhotoLocalPath]) {
      if (path.trim().isEmpty) {
        throw const ImageOnlyException(
          'Both existing photo paths are required.',
        );
      }
      try {
        final stat = await File(path).stat();
        if (stat.type != FileSystemEntityType.file || stat.size <= 0) {
          throw const ImageOnlyException(
            'A required photo is missing or empty.',
          );
        }
      } on FileSystemException {
        throw const ImageOnlyException('A required photo is unavailable.');
      }
    }
    if (!isCurrent()) throw StateError('Capture cancelled.');
    final id = _uuid.v4();
    await _db
        .into(_db.samples)
        .insert(
          SamplesCompanion.insert(
            id: id,
            ownerId: ownerId,
            // UUID suffix avoids same-millisecond display ID collisions on saves.
            sampleId: 'SMP-$id',
            captureTimestamp: DateTime.now(),
            predictedGrade: drift.Value(grade),
            modelProbability: drift.Value(confidence),
            modelVersion: drift.Value(version),
            sidePhotoLocalPath: drift.Value(sidePhotoLocalPath),
            endPhotoLocalPath: drift.Value(endPhotoLocalPath),
            diameterMm: drift.Value(diameterMm),
            diameterSource: drift.Value(diameterSource?.databaseValue),
            diameterModelVersion: drift.Value(diameterVersion),
            estimatedDiameterMm: drift.Value(estimatedMm),
            measuredDiameterMm: drift.Value(
              diameterSource == DiameterSource.caliperMeasured
                  ? diameterMm
                  : null,
            ),
            measurementMethod: drift.Value(switch (diameterSource) {
              null => null,
              DiameterSource.caliperMeasured => 'digital_caliper_manual',
              DiameterSource.aiEstimated => 'experimental_image_regression',
            }),
            needsReview: const drift.Value(true),
            isSynced: const drift.Value(false),
          ),
        );
    if (!isCurrent()) throw StateError('Capture cancelled.');
    return id;
  });

  /// Called only after the user confirms a completed experimental prediction.
  Future<String> createHybridSample(
    String ownerId,
    MLGradeResult result, {
    required String sidePhotoLocalPath,
    required String endPhotoLocalPath,
    required bool Function() isCurrent,
    DiameterSource diameterSource = DiameterSource.caliperMeasured,
    DiameterEstimate? diameterEstimate,
  }) => _db.transaction(() async {
    if (!isCurrent()) throw StateError('Capture cancelled.');
    if (HybridConfig.diameterError(result.diameterMm) != null ||
        !result.modelProbability.isFinite ||
        result.modelProbability < 0 ||
        result.modelProbability > 1 ||
        !HybridConfig.expectedClasses.contains(result.predictedGrade) ||
        result.modelVersion != 'hybrid_v2') {
      throw const HybridException('Cannot save an invalid hybrid prediction.');
    }
    if ((diameterEstimate != null &&
            (HybridConfig.diameterError(diameterEstimate.diameterMm) != null ||
                diameterEstimate.modelVersion != 'diameter_v1')) ||
        (diameterSource == DiameterSource.aiEstimated &&
            (diameterEstimate == null ||
                result.diameterMm != diameterEstimate.diameterMm))) {
      throw const HybridException(
        'Diameter source does not match the selected value.',
      );
    }
    final id = await createNewSample(ownerId);
    await (_db.update(_db.samples)..where((t) => t.id.equals(id))).write(
      SamplesCompanion(
        predictedGrade: drift.Value(result.predictedGrade),
        modelProbability: drift.Value(result.modelProbability),
        diameterMm: drift.Value(result.diameterMm),
        modelVersion: drift.Value(result.modelVersion),
        measurementMethod: drift.Value(
          diameterSource == DiameterSource.aiEstimated
              ? 'experimental_image_regression'
              : 'digital_caliper_manual',
        ),
        diameterSource: drift.Value(diameterSource.databaseValue),
        diameterModelVersion: drift.Value(diameterEstimate?.modelVersion),
        estimatedDiameterMm: drift.Value(diameterEstimate?.diameterMm),
        measuredDiameterMm: drift.Value(
          diameterSource == DiameterSource.caliperMeasured
              ? result.diameterMm
              : null,
        ),
        sidePhotoLocalPath: drift.Value(sidePhotoLocalPath),
        endPhotoLocalPath: drift.Value(endPhotoLocalPath),
        needsReview: const drift.Value(true),
        isSynced: const drift.Value(false),
      ),
    );
    if (!isCurrent()) throw StateError('Capture cancelled.');
    return id;
  });

  /// Publish a sample atomically only after both photos pass model validation.
  /// Cancellation during the transaction rolls back the pending row.
  Future<String> createAnalyzedSample(
    String ownerId,
    double width,
    double height,
    String grade, {
    required String sidePhotoLocalPath,
    required String endPhotoLocalPath,
    required bool Function() isCurrent,
  }) => _db.transaction(() async {
    if (!isCurrent()) throw StateError('Capture cancelled.');
    final id = await createNewSample(ownerId);
    await saveAnalysisResult(
      id,
      width,
      height,
      grade,
      sidePhotoLocalPath: sidePhotoLocalPath,
      endPhotoLocalPath: endPhotoLocalPath,
    );
    if (!isCurrent()) throw StateError('Capture cancelled.');
    return id;
  });

  Future<String> createNewSample(String ownerId) async {
    final id = _uuid.v4();
    final sampleId =
        'SMP-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

    await _db
        .into(_db.samples)
        .insert(
          SamplesCompanion.insert(
            id: id,
            ownerId: ownerId,
            sampleId: sampleId,
            captureTimestamp: DateTime.now(),
          ),
        );

    return id;
  }

  Future<Sample> getSample(String id) async {
    return (_db.select(_db.samples)..where((t) => t.id.equals(id))).getSingle();
  }

  Future<List<Sample>> getUnsyncedSamplesForOwner(String ownerId) =>
      (_db.select(
            _db.samples,
          )..where((t) => t.ownerId.equals(ownerId) & t.isSynced.equals(false)))
          .get();

  /// Compare the full snapshot, including revision, within the write transaction.
  /// Only acknowledgment fields change; original grading and photo data survive.
  Future<bool> acknowledgeUpload(
    Sample uploaded,
    DateTime serverReceiptTime, {
    required bool Function() isCurrentUser,
  }) => _db.transaction(() async {
    final current = await (_db.select(
      _db.samples,
    )..where((t) => t.id.equals(uploaded.id))).getSingleOrNull();
    if (current != uploaded || uploaded.isSynced || !isCurrentUser()) {
      return false;
    }
    final count =
        await (_db.update(_db.samples)..where(
              (t) =>
                  t.id.equals(uploaded.id) &
                  t.ownerId.equals(uploaded.ownerId) &
                  t.revision.equals(uploaded.revision) &
                  t.isSynced.equals(false),
            ))
            .write(
              SamplesCompanion(
                isSynced: const drift.Value(true),
                serverReceiptTime: drift.Value(serverReceiptTime),
              ),
            );
    return count == 1;
  });

  Stream<List<Sample>> watchAllSamples() {
    return (_db.select(_db.samples)..orderBy([
          (t) => drift.OrderingTerm(
            expression: t.captureTimestamp,
            mode: drift.OrderingMode.desc,
          ),
        ]))
        .watch();
  }

  Future<List<Sample>> getAllSamples() async {
    return (_db.select(_db.samples)..orderBy([
          (t) => drift.OrderingTerm(
            expression: t.captureTimestamp,
            mode: drift.OrderingMode.desc,
          ),
        ]))
        .get();
  }

  Future<void> updateSample(Sample sample) async {
    await _db.update(_db.samples).replace(sample);
  }

  Future<void> saveAnalysisResult(
    String id,
    double width,
    double height,
    String? grade, {
    String? sidePhotoLocalPath,
    String? endPhotoLocalPath,
    bool needsReview = true,
  }) async {
    await (_db.update(_db.samples)..where((t) => t.id.equals(id))).write(
      SamplesCompanion(
        crossSectionWidthMm: drift.Value(width),
        crossSectionHeightMm: drift.Value(height),
        predictedGrade: drift.Value(grade),
        sidePhotoLocalPath: sidePhotoLocalPath != null
            ? drift.Value(sidePhotoLocalPath)
            : const drift.Value.absent(),
        endPhotoLocalPath: endPhotoLocalPath != null
            ? drift.Value(endPhotoLocalPath)
            : const drift.Value.absent(),
        needsReview: drift.Value(needsReview),
        isSynced: const drift.Value(false),
      ),
    );
  }

  Future<void> seedInitialDemoData(String ownerId) async {
    final existing = await getAllSamples();
    if (existing.isNotEmpty) return;

    final now = DateTime.now();
    final demoItems = [
      {
        'id': _uuid.v4(),
        'sampleId': 'SMP-89240',
        'time': now.subtract(const Duration(minutes: 42)),
        'width': 6.2,
        'height': 5.9,
        'grade': 'ALBA',
        'isSynced': true,
      },
      {
        'id': _uuid.v4(),
        'sampleId': 'SMP-89182',
        'time': now.subtract(const Duration(hours: 3, minutes: 15)),
        'width': 9.4,
        'height': 9.0,
        'grade': 'C5 Special',
        'isSynced': true,
      },
      {
        'id': _uuid.v4(),
        'sampleId': 'SMP-89095',
        'time': now.subtract(const Duration(hours: 7)),
        'width': 13.6,
        'height': 13.1,
        'grade': 'C4',
        'isSynced': false,
      },
      {
        'id': _uuid.v4(),
        'sampleId': 'SMP-88941',
        'time': now.subtract(const Duration(days: 1, hours: 2)),
        'width': 17.2,
        'height': 16.8,
        'grade': 'M5',
        'isSynced': true,
      },
    ];

    for (final item in demoItems) {
      await _db
          .into(_db.samples)
          .insert(
            SamplesCompanion.insert(
              id: item['id'] as String,
              ownerId: ownerId,
              sampleId: item['sampleId'] as String,
              captureTimestamp: item['time'] as DateTime,
              crossSectionWidthMm: drift.Value(item['width'] as double),
              crossSectionHeightMm: drift.Value(item['height'] as double),
              predictedGrade: drift.Value(item['grade'] as String),
              isSynced: drift.Value(item['isSynced'] as bool),
              needsReview: const drift.Value(false),
            ),
          );
    }
  }
}

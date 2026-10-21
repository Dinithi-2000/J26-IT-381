import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/sync/sync_manager.dart';

import 'support/hybrid_capture_fakes.dart';

void main() {
  test('confirmed hybrid fields survive offline storage and enter existing sync payload', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    final repository = SampleRepository(db);
    final id = await repository.createHybridSample(
      'owner',
      testGrade(),
      sidePhotoLocalPath: 'side.jpg',
      endPhotoLocalPath: 'end.jpg',
      isCurrent: () => true,
    );
    final sample = await repository.getSample(id);
    final payload = sampleSyncFields(sample);
    expect(payload['diameterMm'], 6.8);
    expect(payload['measurementMethod'], 'digital_caliper_manual');
    expect(payload['modelVersion'], 'hybrid_v2');
    expect(payload['modelProbability'], 0.9);
    expect(payload['needsReview'], isTrue);
    expect(payload['ownerId'], 'owner');
    expect(payload['predictedGrade'], 'ALBA');
    expect(payload['crossSectionHeightMm'], isNull);
    expect(sample.isSynced, isFalse);
    expect(payload['diameterSource'], 'caliper_measured');
    expect(payload['measuredDiameterMm'], 6.8);
    expect(payload['estimatedDiameterMm'], isNull);
    expect(payload['diameterModelVersion'], isNull);
  });

  for (final legacyVersion in [1, 2]) {
    test(
      'v$legacyVersion to v3 preserves samples, measurements, sync state and queued jobs',
      () async {
        final db = AppDatabase.forTesting(
          NativeDatabase.memory(
            setup: (sqlite) {
              sqlite.execute('''
        CREATE TABLE samples (
          id TEXT NOT NULL PRIMARY KEY, owner_id TEXT NOT NULL, sample_id TEXT NOT NULL,
          batch_id TEXT, capture_timestamp INTEGER NOT NULL, location TEXT,
          side_photo_local_path TEXT, end_photo_local_path TEXT,
          side_photo_cloud_path TEXT, end_photo_cloud_path TEXT,
          cross_section_width_mm REAL, cross_section_height_mm REAL,
          measurement_method TEXT, calibration_version TEXT, predicted_grade TEXT,
          expert_grade TEXT, model_version TEXT, needs_review INTEGER NOT NULL DEFAULT 0,
          is_synced INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
          server_receipt_time INTEGER
        );
        CREATE TABLE sync_jobs (
          id TEXT NOT NULL PRIMARY KEY, sample_id TEXT NOT NULL REFERENCES samples(id),
          operation TEXT NOT NULL, created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0, last_error TEXT,
          is_completed INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO samples (id, owner_id, sample_id, capture_timestamp,
          cross_section_width_mm, cross_section_height_mm, predicted_grade,
          side_photo_local_path, is_synced, revision)
          VALUES ('old', 'owner', 'SMP-OLD', 1700000000, 12.5, 11.2, 'C4', 'side.jpg', 1, 7);
        INSERT INTO sync_jobs (id,sample_id,operation,created_at,retry_count)
          VALUES ('job', 'old', 'update', 1700000000, 2);
        PRAGMA user_version = 1;
      ''');
              if (legacyVersion == 2) {
                sqlite.execute('''
                ALTER TABLE samples ADD COLUMN diameter_mm REAL;
                ALTER TABLE samples ADD COLUMN model_probability REAL;
                UPDATE samples SET diameter_mm = 8.4, model_probability = 0.75,
                    model_version = 'hybrid_v2', measurement_method = 'digital_caliper_manual';
                PRAGMA user_version = 2;
              ''');
              }
            },
          ),
        );
        addTearDown(db.close);
        final sample = await SampleRepository(db).getSample('old');
        expect(sample.predictedGrade, 'C4');
        expect(sample.crossSectionWidthMm, 12.5);
        expect(sample.crossSectionHeightMm, 11.2);
        expect(sample.isSynced, isTrue);
        expect(sample.revision, 7);
        expect(sample.sidePhotoLocalPath, 'side.jpg');
        expect(sample.diameterMm, legacyVersion == 2 ? 8.4 : null);
        expect(sample.modelProbability, legacyVersion == 2 ? 0.75 : null);
        if (legacyVersion == 2) {
          expect(sample.modelVersion, 'hybrid_v2');
          expect(sample.measurementMethod, 'digital_caliper_manual');
        }
        expect(sample.diameterSource, isNull);
        expect(sample.estimatedDiameterMm, isNull);
        expect(sample.measuredDiameterMm, isNull);
        expect(sample.diameterModelVersion, isNull);
        final jobs = await db.select(db.syncJobs).get();
        expect(jobs.single.id, 'job');
        expect(jobs.single.retryCount, 2);
        final version = await db
            .customSelect('PRAGMA user_version')
            .getSingle();
        expect(version.read<int>('user_version'), 3);
      },
    );
  }
}

import 'package:drift/drift.dart';

@DataClassName('Sample')
class Samples extends Table {
  TextColumn get id => text()(); // UUID
  TextColumn get ownerId => text()(); // User who created it
  TextColumn get sampleId => text()(); // Human-readable ID
  TextColumn get batchId => text().nullable()();
  DateTimeColumn get captureTimestamp => dateTime()();
  TextColumn get location => text().nullable()(); // Optional location

  // File paths and Sync status
  TextColumn get sidePhotoLocalPath => text().nullable()();
  TextColumn get endPhotoLocalPath => text().nullable()();
  TextColumn get sidePhotoCloudPath => text().nullable()();
  TextColumn get endPhotoCloudPath => text().nullable()();

  // Measurements
  RealColumn get crossSectionWidthMm => real().nullable()();
  RealColumn get crossSectionHeightMm => real().nullable()();
  TextColumn get measurementMethod => text().nullable()(); // 'auto', 'manual'
  TextColumn get calibrationVersion => text().nullable()();

  // Predictions
  TextColumn get predictedGrade => text().nullable()();
  TextColumn get expertGrade => text().nullable()();
  TextColumn get modelVersion => text().nullable()();
  // Final selected millimeter input to Hybrid V2 (source recorded separately).
  RealColumn get diameterMm => real().nullable()();
  TextColumn get diameterSource => text().nullable()();
  TextColumn get diameterModelVersion => text().nullable()();
  RealColumn get estimatedDiameterMm => real().nullable()();
  RealColumn get measuredDiameterMm => real().nullable()();
  RealColumn get modelProbability => real().nullable()();
  BoolColumn get needsReview => boolean().withDefault(const Constant(false))();

  // Sync Status
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  IntColumn get revision => integer().withDefault(const Constant(1))();
  DateTimeColumn get serverReceiptTime => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('SyncJob')
class SyncJobs extends Table {
  TextColumn get id => text()(); // UUID of the job
  TextColumn get sampleId =>
      text().references(Samples, #id)(); // Which sample to sync
  TextColumn get operation => text()(); // 'create', 'update'
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  BoolColumn get isCompleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {id};
}

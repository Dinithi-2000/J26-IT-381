import '../database/app_database.dart';
import '../ml/image_only_config.dart';
import '../ml/hybrid_config.dart';

class UploadValidationException implements Exception {
  final String message;
  const UploadValidationException(this.message);
}

/// A metadata-only snapshot. Probability stays in SQLite's 0–1 units;
/// the existing Express validator performs the sole percentage conversion.
Map<String, Object?> mapGradingUpload(Sample sample, String firebaseUid) {
  if (firebaseUid.isEmpty ||
      const ['demo-inspector-1', 'inspector-1'].contains(firebaseUid) ||
      sample.ownerId != firebaseUid) {
    throw const UploadValidationException(
      'This record does not belong to the active Firebase inspector.',
    );
  }
  final imageOnly = sample.modelVersion == ImageOnlyConfig.modelVersion;
  final hybrid = sample.modelVersion == 'hybrid_v2';
  final grades = imageOnly
      ? ImageOnlyConfig.classes
      : HybridConfig.expectedClasses;
  final probability = sample.modelProbability;
  final diameter = sample.diameterMm;
  if (sample.isSynced ||
      !RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      ).hasMatch(sample.id) ||
      sample.sampleId.trim().isEmpty ||
      sample.sampleId != sample.sampleId.trim() ||
      sample.revision < 1 ||
      (!imageOnly && !hybrid) ||
      !grades.contains(sample.predictedGrade) ||
      (sample.expertGrade != null && !grades.contains(sample.expertGrade)) ||
      probability == null ||
      !probability.isFinite ||
      probability < 0 ||
      probability > 1 ||
      (hybrid && diameter == null) ||
      (diameter != null && (!diameter.isFinite || diameter <= 0)) ||
      (diameter == null && sample.diameterSource != null) ||
      (sample.diameterSource != null &&
          !const [
            'ai_estimated',
            'caliper_measured',
          ].contains(sample.diameterSource)) ||
      sample.captureTimestamp.isAfter(
        DateTime.now().add(const Duration(minutes: 10)),
      )) {
    throw const UploadValidationException(
      'Record is already synced or lacks valid supported grading metadata.',
    );
  }
  return {
    'mobileSampleUuid': sample.id,
    'sampleId': sample.sampleId,
    'ownerId': firebaseUid,
    'predictedGrade': sample.predictedGrade,
    'expertGrade': sample.expertGrade,
    'modelVersion': sample.modelVersion,
    'modelProbability': probability,
    'diameterMm': diameter,
    'diameterSource': sample.diameterSource,
    'measurementMethod': sample.measurementMethod,
    'captureTimestamp': sample.captureTimestamp.toUtc().toIso8601String(),
    'revision': sample.revision,
    'batchId': sample.batchId,
    'needsReview': sample.needsReview,
  };
}

DateTime validateUploadReceipt(Object? body, Sample sample, {DateTime? now}) {
  if (body is! Map ||
      body['status'] != 'acknowledged' ||
      !const [
        'created',
        'updated',
        'idempotent_duplicate',
      ].contains(body['action'])) {
    throw const UploadValidationException(
      'Backend did not acknowledge this upload. Record remains pending.',
    );
  }
  final receipt = body['receipt'];
  if (receipt is! Map ||
      receipt['mobileSampleUuid'] != sample.id ||
      receipt['ownerId'] != sample.ownerId ||
      receipt['sampleId'] != sample.sampleId ||
      receipt['revision'] is! int ||
      receipt['revision'] != sample.revision) {
    throw const UploadValidationException(
      'Backend receipt does not match the selected record. Record remains pending.',
    );
  }
  final rawTime = receipt['serverReceiptTimestamp'];
  final timestamp = rawTime is String ? DateTime.tryParse(rawTime) : null;
  if (rawTime is! String ||
      !RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$')
          .hasMatch(rawTime) ||
      timestamp == null ||
      timestamp.toUtc().toIso8601String() != rawTime ||
      timestamp.isBefore(DateTime.utc(2000)) ||
      timestamp.isAfter(
        (now ?? DateTime.now()).add(const Duration(minutes: 10)),
      ) ||
      timestamp.isBefore(
        sample.captureTimestamp.subtract(const Duration(minutes: 10)),
      )) {
    throw const UploadValidationException(
      'Backend receipt has an invalid server timestamp. Record remains pending.',
    );
  }
  return timestamp;
}

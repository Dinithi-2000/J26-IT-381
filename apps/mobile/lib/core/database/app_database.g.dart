// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $SamplesTable extends Samples with TableInfo<$SamplesTable, Sample> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SamplesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ownerIdMeta = const VerificationMeta(
    'ownerId',
  );
  @override
  late final GeneratedColumn<String> ownerId = GeneratedColumn<String>(
    'owner_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sampleIdMeta = const VerificationMeta(
    'sampleId',
  );
  @override
  late final GeneratedColumn<String> sampleId = GeneratedColumn<String>(
    'sample_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _batchIdMeta = const VerificationMeta(
    'batchId',
  );
  @override
  late final GeneratedColumn<String> batchId = GeneratedColumn<String>(
    'batch_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _captureTimestampMeta = const VerificationMeta(
    'captureTimestamp',
  );
  @override
  late final GeneratedColumn<DateTime> captureTimestamp =
      GeneratedColumn<DateTime>(
        'capture_timestamp',
        aliasedName,
        false,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: true,
      );
  static const VerificationMeta _locationMeta = const VerificationMeta(
    'location',
  );
  @override
  late final GeneratedColumn<String> location = GeneratedColumn<String>(
    'location',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sidePhotoLocalPathMeta =
      const VerificationMeta('sidePhotoLocalPath');
  @override
  late final GeneratedColumn<String> sidePhotoLocalPath =
      GeneratedColumn<String>(
        'side_photo_local_path',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _endPhotoLocalPathMeta = const VerificationMeta(
    'endPhotoLocalPath',
  );
  @override
  late final GeneratedColumn<String> endPhotoLocalPath =
      GeneratedColumn<String>(
        'end_photo_local_path',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _sidePhotoCloudPathMeta =
      const VerificationMeta('sidePhotoCloudPath');
  @override
  late final GeneratedColumn<String> sidePhotoCloudPath =
      GeneratedColumn<String>(
        'side_photo_cloud_path',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _endPhotoCloudPathMeta = const VerificationMeta(
    'endPhotoCloudPath',
  );
  @override
  late final GeneratedColumn<String> endPhotoCloudPath =
      GeneratedColumn<String>(
        'end_photo_cloud_path',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _crossSectionWidthMmMeta =
      const VerificationMeta('crossSectionWidthMm');
  @override
  late final GeneratedColumn<double> crossSectionWidthMm =
      GeneratedColumn<double>(
        'cross_section_width_mm',
        aliasedName,
        true,
        type: DriftSqlType.double,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _crossSectionHeightMmMeta =
      const VerificationMeta('crossSectionHeightMm');
  @override
  late final GeneratedColumn<double> crossSectionHeightMm =
      GeneratedColumn<double>(
        'cross_section_height_mm',
        aliasedName,
        true,
        type: DriftSqlType.double,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _measurementMethodMeta = const VerificationMeta(
    'measurementMethod',
  );
  @override
  late final GeneratedColumn<String> measurementMethod =
      GeneratedColumn<String>(
        'measurement_method',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _calibrationVersionMeta =
      const VerificationMeta('calibrationVersion');
  @override
  late final GeneratedColumn<String> calibrationVersion =
      GeneratedColumn<String>(
        'calibration_version',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _predictedGradeMeta = const VerificationMeta(
    'predictedGrade',
  );
  @override
  late final GeneratedColumn<String> predictedGrade = GeneratedColumn<String>(
    'predicted_grade',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _expertGradeMeta = const VerificationMeta(
    'expertGrade',
  );
  @override
  late final GeneratedColumn<String> expertGrade = GeneratedColumn<String>(
    'expert_grade',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _modelVersionMeta = const VerificationMeta(
    'modelVersion',
  );
  @override
  late final GeneratedColumn<String> modelVersion = GeneratedColumn<String>(
    'model_version',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _diameterMmMeta = const VerificationMeta(
    'diameterMm',
  );
  @override
  late final GeneratedColumn<double> diameterMm = GeneratedColumn<double>(
    'diameter_mm',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _diameterSourceMeta = const VerificationMeta(
    'diameterSource',
  );
  @override
  late final GeneratedColumn<String> diameterSource = GeneratedColumn<String>(
    'diameter_source',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _diameterModelVersionMeta =
      const VerificationMeta('diameterModelVersion');
  @override
  late final GeneratedColumn<String> diameterModelVersion =
      GeneratedColumn<String>(
        'diameter_model_version',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _estimatedDiameterMmMeta =
      const VerificationMeta('estimatedDiameterMm');
  @override
  late final GeneratedColumn<double> estimatedDiameterMm =
      GeneratedColumn<double>(
        'estimated_diameter_mm',
        aliasedName,
        true,
        type: DriftSqlType.double,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _measuredDiameterMmMeta =
      const VerificationMeta('measuredDiameterMm');
  @override
  late final GeneratedColumn<double> measuredDiameterMm =
      GeneratedColumn<double>(
        'measured_diameter_mm',
        aliasedName,
        true,
        type: DriftSqlType.double,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _modelProbabilityMeta = const VerificationMeta(
    'modelProbability',
  );
  @override
  late final GeneratedColumn<double> modelProbability = GeneratedColumn<double>(
    'model_probability',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _needsReviewMeta = const VerificationMeta(
    'needsReview',
  );
  @override
  late final GeneratedColumn<bool> needsReview = GeneratedColumn<bool>(
    'needs_review',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("needs_review" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _isSyncedMeta = const VerificationMeta(
    'isSynced',
  );
  @override
  late final GeneratedColumn<bool> isSynced = GeneratedColumn<bool>(
    'is_synced',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_synced" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _revisionMeta = const VerificationMeta(
    'revision',
  );
  @override
  late final GeneratedColumn<int> revision = GeneratedColumn<int>(
    'revision',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _serverReceiptTimeMeta = const VerificationMeta(
    'serverReceiptTime',
  );
  @override
  late final GeneratedColumn<DateTime> serverReceiptTime =
      GeneratedColumn<DateTime>(
        'server_receipt_time',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    ownerId,
    sampleId,
    batchId,
    captureTimestamp,
    location,
    sidePhotoLocalPath,
    endPhotoLocalPath,
    sidePhotoCloudPath,
    endPhotoCloudPath,
    crossSectionWidthMm,
    crossSectionHeightMm,
    measurementMethod,
    calibrationVersion,
    predictedGrade,
    expertGrade,
    modelVersion,
    diameterMm,
    diameterSource,
    diameterModelVersion,
    estimatedDiameterMm,
    measuredDiameterMm,
    modelProbability,
    needsReview,
    isSynced,
    revision,
    serverReceiptTime,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'samples';
  @override
  VerificationContext validateIntegrity(
    Insertable<Sample> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_id')) {
      context.handle(
        _ownerIdMeta,
        ownerId.isAcceptableOrUnknown(data['owner_id']!, _ownerIdMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerIdMeta);
    }
    if (data.containsKey('sample_id')) {
      context.handle(
        _sampleIdMeta,
        sampleId.isAcceptableOrUnknown(data['sample_id']!, _sampleIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sampleIdMeta);
    }
    if (data.containsKey('batch_id')) {
      context.handle(
        _batchIdMeta,
        batchId.isAcceptableOrUnknown(data['batch_id']!, _batchIdMeta),
      );
    }
    if (data.containsKey('capture_timestamp')) {
      context.handle(
        _captureTimestampMeta,
        captureTimestamp.isAcceptableOrUnknown(
          data['capture_timestamp']!,
          _captureTimestampMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_captureTimestampMeta);
    }
    if (data.containsKey('location')) {
      context.handle(
        _locationMeta,
        location.isAcceptableOrUnknown(data['location']!, _locationMeta),
      );
    }
    if (data.containsKey('side_photo_local_path')) {
      context.handle(
        _sidePhotoLocalPathMeta,
        sidePhotoLocalPath.isAcceptableOrUnknown(
          data['side_photo_local_path']!,
          _sidePhotoLocalPathMeta,
        ),
      );
    }
    if (data.containsKey('end_photo_local_path')) {
      context.handle(
        _endPhotoLocalPathMeta,
        endPhotoLocalPath.isAcceptableOrUnknown(
          data['end_photo_local_path']!,
          _endPhotoLocalPathMeta,
        ),
      );
    }
    if (data.containsKey('side_photo_cloud_path')) {
      context.handle(
        _sidePhotoCloudPathMeta,
        sidePhotoCloudPath.isAcceptableOrUnknown(
          data['side_photo_cloud_path']!,
          _sidePhotoCloudPathMeta,
        ),
      );
    }
    if (data.containsKey('end_photo_cloud_path')) {
      context.handle(
        _endPhotoCloudPathMeta,
        endPhotoCloudPath.isAcceptableOrUnknown(
          data['end_photo_cloud_path']!,
          _endPhotoCloudPathMeta,
        ),
      );
    }
    if (data.containsKey('cross_section_width_mm')) {
      context.handle(
        _crossSectionWidthMmMeta,
        crossSectionWidthMm.isAcceptableOrUnknown(
          data['cross_section_width_mm']!,
          _crossSectionWidthMmMeta,
        ),
      );
    }
    if (data.containsKey('cross_section_height_mm')) {
      context.handle(
        _crossSectionHeightMmMeta,
        crossSectionHeightMm.isAcceptableOrUnknown(
          data['cross_section_height_mm']!,
          _crossSectionHeightMmMeta,
        ),
      );
    }
    if (data.containsKey('measurement_method')) {
      context.handle(
        _measurementMethodMeta,
        measurementMethod.isAcceptableOrUnknown(
          data['measurement_method']!,
          _measurementMethodMeta,
        ),
      );
    }
    if (data.containsKey('calibration_version')) {
      context.handle(
        _calibrationVersionMeta,
        calibrationVersion.isAcceptableOrUnknown(
          data['calibration_version']!,
          _calibrationVersionMeta,
        ),
      );
    }
    if (data.containsKey('predicted_grade')) {
      context.handle(
        _predictedGradeMeta,
        predictedGrade.isAcceptableOrUnknown(
          data['predicted_grade']!,
          _predictedGradeMeta,
        ),
      );
    }
    if (data.containsKey('expert_grade')) {
      context.handle(
        _expertGradeMeta,
        expertGrade.isAcceptableOrUnknown(
          data['expert_grade']!,
          _expertGradeMeta,
        ),
      );
    }
    if (data.containsKey('model_version')) {
      context.handle(
        _modelVersionMeta,
        modelVersion.isAcceptableOrUnknown(
          data['model_version']!,
          _modelVersionMeta,
        ),
      );
    }
    if (data.containsKey('diameter_mm')) {
      context.handle(
        _diameterMmMeta,
        diameterMm.isAcceptableOrUnknown(data['diameter_mm']!, _diameterMmMeta),
      );
    }
    if (data.containsKey('diameter_source')) {
      context.handle(
        _diameterSourceMeta,
        diameterSource.isAcceptableOrUnknown(
          data['diameter_source']!,
          _diameterSourceMeta,
        ),
      );
    }
    if (data.containsKey('diameter_model_version')) {
      context.handle(
        _diameterModelVersionMeta,
        diameterModelVersion.isAcceptableOrUnknown(
          data['diameter_model_version']!,
          _diameterModelVersionMeta,
        ),
      );
    }
    if (data.containsKey('estimated_diameter_mm')) {
      context.handle(
        _estimatedDiameterMmMeta,
        estimatedDiameterMm.isAcceptableOrUnknown(
          data['estimated_diameter_mm']!,
          _estimatedDiameterMmMeta,
        ),
      );
    }
    if (data.containsKey('measured_diameter_mm')) {
      context.handle(
        _measuredDiameterMmMeta,
        measuredDiameterMm.isAcceptableOrUnknown(
          data['measured_diameter_mm']!,
          _measuredDiameterMmMeta,
        ),
      );
    }
    if (data.containsKey('model_probability')) {
      context.handle(
        _modelProbabilityMeta,
        modelProbability.isAcceptableOrUnknown(
          data['model_probability']!,
          _modelProbabilityMeta,
        ),
      );
    }
    if (data.containsKey('needs_review')) {
      context.handle(
        _needsReviewMeta,
        needsReview.isAcceptableOrUnknown(
          data['needs_review']!,
          _needsReviewMeta,
        ),
      );
    }
    if (data.containsKey('is_synced')) {
      context.handle(
        _isSyncedMeta,
        isSynced.isAcceptableOrUnknown(data['is_synced']!, _isSyncedMeta),
      );
    }
    if (data.containsKey('revision')) {
      context.handle(
        _revisionMeta,
        revision.isAcceptableOrUnknown(data['revision']!, _revisionMeta),
      );
    }
    if (data.containsKey('server_receipt_time')) {
      context.handle(
        _serverReceiptTimeMeta,
        serverReceiptTime.isAcceptableOrUnknown(
          data['server_receipt_time']!,
          _serverReceiptTimeMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Sample map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Sample(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      ownerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner_id'],
      )!,
      sampleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sample_id'],
      )!,
      batchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}batch_id'],
      ),
      captureTimestamp: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}capture_timestamp'],
      )!,
      location: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}location'],
      ),
      sidePhotoLocalPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}side_photo_local_path'],
      ),
      endPhotoLocalPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_photo_local_path'],
      ),
      sidePhotoCloudPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}side_photo_cloud_path'],
      ),
      endPhotoCloudPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_photo_cloud_path'],
      ),
      crossSectionWidthMm: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}cross_section_width_mm'],
      ),
      crossSectionHeightMm: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}cross_section_height_mm'],
      ),
      measurementMethod: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}measurement_method'],
      ),
      calibrationVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}calibration_version'],
      ),
      predictedGrade: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}predicted_grade'],
      ),
      expertGrade: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}expert_grade'],
      ),
      modelVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}model_version'],
      ),
      diameterMm: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}diameter_mm'],
      ),
      diameterSource: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}diameter_source'],
      ),
      diameterModelVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}diameter_model_version'],
      ),
      estimatedDiameterMm: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}estimated_diameter_mm'],
      ),
      measuredDiameterMm: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}measured_diameter_mm'],
      ),
      modelProbability: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}model_probability'],
      ),
      needsReview: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}needs_review'],
      )!,
      isSynced: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_synced'],
      )!,
      revision: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}revision'],
      )!,
      serverReceiptTime: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}server_receipt_time'],
      ),
    );
  }

  @override
  $SamplesTable createAlias(String alias) {
    return $SamplesTable(attachedDatabase, alias);
  }
}

class Sample extends DataClass implements Insertable<Sample> {
  final String id;
  final String ownerId;
  final String sampleId;
  final String? batchId;
  final DateTime captureTimestamp;
  final String? location;
  final String? sidePhotoLocalPath;
  final String? endPhotoLocalPath;
  final String? sidePhotoCloudPath;
  final String? endPhotoCloudPath;
  final double? crossSectionWidthMm;
  final double? crossSectionHeightMm;
  final String? measurementMethod;
  final String? calibrationVersion;
  final String? predictedGrade;
  final String? expertGrade;
  final String? modelVersion;
  final double? diameterMm;
  final String? diameterSource;
  final String? diameterModelVersion;
  final double? estimatedDiameterMm;
  final double? measuredDiameterMm;
  final double? modelProbability;
  final bool needsReview;
  final bool isSynced;
  final int revision;
  final DateTime? serverReceiptTime;
  const Sample({
    required this.id,
    required this.ownerId,
    required this.sampleId,
    this.batchId,
    required this.captureTimestamp,
    this.location,
    this.sidePhotoLocalPath,
    this.endPhotoLocalPath,
    this.sidePhotoCloudPath,
    this.endPhotoCloudPath,
    this.crossSectionWidthMm,
    this.crossSectionHeightMm,
    this.measurementMethod,
    this.calibrationVersion,
    this.predictedGrade,
    this.expertGrade,
    this.modelVersion,
    this.diameterMm,
    this.diameterSource,
    this.diameterModelVersion,
    this.estimatedDiameterMm,
    this.measuredDiameterMm,
    this.modelProbability,
    required this.needsReview,
    required this.isSynced,
    required this.revision,
    this.serverReceiptTime,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_id'] = Variable<String>(ownerId);
    map['sample_id'] = Variable<String>(sampleId);
    if (!nullToAbsent || batchId != null) {
      map['batch_id'] = Variable<String>(batchId);
    }
    map['capture_timestamp'] = Variable<DateTime>(captureTimestamp);
    if (!nullToAbsent || location != null) {
      map['location'] = Variable<String>(location);
    }
    if (!nullToAbsent || sidePhotoLocalPath != null) {
      map['side_photo_local_path'] = Variable<String>(sidePhotoLocalPath);
    }
    if (!nullToAbsent || endPhotoLocalPath != null) {
      map['end_photo_local_path'] = Variable<String>(endPhotoLocalPath);
    }
    if (!nullToAbsent || sidePhotoCloudPath != null) {
      map['side_photo_cloud_path'] = Variable<String>(sidePhotoCloudPath);
    }
    if (!nullToAbsent || endPhotoCloudPath != null) {
      map['end_photo_cloud_path'] = Variable<String>(endPhotoCloudPath);
    }
    if (!nullToAbsent || crossSectionWidthMm != null) {
      map['cross_section_width_mm'] = Variable<double>(crossSectionWidthMm);
    }
    if (!nullToAbsent || crossSectionHeightMm != null) {
      map['cross_section_height_mm'] = Variable<double>(crossSectionHeightMm);
    }
    if (!nullToAbsent || measurementMethod != null) {
      map['measurement_method'] = Variable<String>(measurementMethod);
    }
    if (!nullToAbsent || calibrationVersion != null) {
      map['calibration_version'] = Variable<String>(calibrationVersion);
    }
    if (!nullToAbsent || predictedGrade != null) {
      map['predicted_grade'] = Variable<String>(predictedGrade);
    }
    if (!nullToAbsent || expertGrade != null) {
      map['expert_grade'] = Variable<String>(expertGrade);
    }
    if (!nullToAbsent || modelVersion != null) {
      map['model_version'] = Variable<String>(modelVersion);
    }
    if (!nullToAbsent || diameterMm != null) {
      map['diameter_mm'] = Variable<double>(diameterMm);
    }
    if (!nullToAbsent || diameterSource != null) {
      map['diameter_source'] = Variable<String>(diameterSource);
    }
    if (!nullToAbsent || diameterModelVersion != null) {
      map['diameter_model_version'] = Variable<String>(diameterModelVersion);
    }
    if (!nullToAbsent || estimatedDiameterMm != null) {
      map['estimated_diameter_mm'] = Variable<double>(estimatedDiameterMm);
    }
    if (!nullToAbsent || measuredDiameterMm != null) {
      map['measured_diameter_mm'] = Variable<double>(measuredDiameterMm);
    }
    if (!nullToAbsent || modelProbability != null) {
      map['model_probability'] = Variable<double>(modelProbability);
    }
    map['needs_review'] = Variable<bool>(needsReview);
    map['is_synced'] = Variable<bool>(isSynced);
    map['revision'] = Variable<int>(revision);
    if (!nullToAbsent || serverReceiptTime != null) {
      map['server_receipt_time'] = Variable<DateTime>(serverReceiptTime);
    }
    return map;
  }

  SamplesCompanion toCompanion(bool nullToAbsent) {
    return SamplesCompanion(
      id: Value(id),
      ownerId: Value(ownerId),
      sampleId: Value(sampleId),
      batchId: batchId == null && nullToAbsent
          ? const Value.absent()
          : Value(batchId),
      captureTimestamp: Value(captureTimestamp),
      location: location == null && nullToAbsent
          ? const Value.absent()
          : Value(location),
      sidePhotoLocalPath: sidePhotoLocalPath == null && nullToAbsent
          ? const Value.absent()
          : Value(sidePhotoLocalPath),
      endPhotoLocalPath: endPhotoLocalPath == null && nullToAbsent
          ? const Value.absent()
          : Value(endPhotoLocalPath),
      sidePhotoCloudPath: sidePhotoCloudPath == null && nullToAbsent
          ? const Value.absent()
          : Value(sidePhotoCloudPath),
      endPhotoCloudPath: endPhotoCloudPath == null && nullToAbsent
          ? const Value.absent()
          : Value(endPhotoCloudPath),
      crossSectionWidthMm: crossSectionWidthMm == null && nullToAbsent
          ? const Value.absent()
          : Value(crossSectionWidthMm),
      crossSectionHeightMm: crossSectionHeightMm == null && nullToAbsent
          ? const Value.absent()
          : Value(crossSectionHeightMm),
      measurementMethod: measurementMethod == null && nullToAbsent
          ? const Value.absent()
          : Value(measurementMethod),
      calibrationVersion: calibrationVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(calibrationVersion),
      predictedGrade: predictedGrade == null && nullToAbsent
          ? const Value.absent()
          : Value(predictedGrade),
      expertGrade: expertGrade == null && nullToAbsent
          ? const Value.absent()
          : Value(expertGrade),
      modelVersion: modelVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(modelVersion),
      diameterMm: diameterMm == null && nullToAbsent
          ? const Value.absent()
          : Value(diameterMm),
      diameterSource: diameterSource == null && nullToAbsent
          ? const Value.absent()
          : Value(diameterSource),
      diameterModelVersion: diameterModelVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(diameterModelVersion),
      estimatedDiameterMm: estimatedDiameterMm == null && nullToAbsent
          ? const Value.absent()
          : Value(estimatedDiameterMm),
      measuredDiameterMm: measuredDiameterMm == null && nullToAbsent
          ? const Value.absent()
          : Value(measuredDiameterMm),
      modelProbability: modelProbability == null && nullToAbsent
          ? const Value.absent()
          : Value(modelProbability),
      needsReview: Value(needsReview),
      isSynced: Value(isSynced),
      revision: Value(revision),
      serverReceiptTime: serverReceiptTime == null && nullToAbsent
          ? const Value.absent()
          : Value(serverReceiptTime),
    );
  }

  factory Sample.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Sample(
      id: serializer.fromJson<String>(json['id']),
      ownerId: serializer.fromJson<String>(json['ownerId']),
      sampleId: serializer.fromJson<String>(json['sampleId']),
      batchId: serializer.fromJson<String?>(json['batchId']),
      captureTimestamp: serializer.fromJson<DateTime>(json['captureTimestamp']),
      location: serializer.fromJson<String?>(json['location']),
      sidePhotoLocalPath: serializer.fromJson<String?>(
        json['sidePhotoLocalPath'],
      ),
      endPhotoLocalPath: serializer.fromJson<String?>(
        json['endPhotoLocalPath'],
      ),
      sidePhotoCloudPath: serializer.fromJson<String?>(
        json['sidePhotoCloudPath'],
      ),
      endPhotoCloudPath: serializer.fromJson<String?>(
        json['endPhotoCloudPath'],
      ),
      crossSectionWidthMm: serializer.fromJson<double?>(
        json['crossSectionWidthMm'],
      ),
      crossSectionHeightMm: serializer.fromJson<double?>(
        json['crossSectionHeightMm'],
      ),
      measurementMethod: serializer.fromJson<String?>(
        json['measurementMethod'],
      ),
      calibrationVersion: serializer.fromJson<String?>(
        json['calibrationVersion'],
      ),
      predictedGrade: serializer.fromJson<String?>(json['predictedGrade']),
      expertGrade: serializer.fromJson<String?>(json['expertGrade']),
      modelVersion: serializer.fromJson<String?>(json['modelVersion']),
      diameterMm: serializer.fromJson<double?>(json['diameterMm']),
      diameterSource: serializer.fromJson<String?>(json['diameterSource']),
      diameterModelVersion: serializer.fromJson<String?>(
        json['diameterModelVersion'],
      ),
      estimatedDiameterMm: serializer.fromJson<double?>(
        json['estimatedDiameterMm'],
      ),
      measuredDiameterMm: serializer.fromJson<double?>(
        json['measuredDiameterMm'],
      ),
      modelProbability: serializer.fromJson<double?>(json['modelProbability']),
      needsReview: serializer.fromJson<bool>(json['needsReview']),
      isSynced: serializer.fromJson<bool>(json['isSynced']),
      revision: serializer.fromJson<int>(json['revision']),
      serverReceiptTime: serializer.fromJson<DateTime?>(
        json['serverReceiptTime'],
      ),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerId': serializer.toJson<String>(ownerId),
      'sampleId': serializer.toJson<String>(sampleId),
      'batchId': serializer.toJson<String?>(batchId),
      'captureTimestamp': serializer.toJson<DateTime>(captureTimestamp),
      'location': serializer.toJson<String?>(location),
      'sidePhotoLocalPath': serializer.toJson<String?>(sidePhotoLocalPath),
      'endPhotoLocalPath': serializer.toJson<String?>(endPhotoLocalPath),
      'sidePhotoCloudPath': serializer.toJson<String?>(sidePhotoCloudPath),
      'endPhotoCloudPath': serializer.toJson<String?>(endPhotoCloudPath),
      'crossSectionWidthMm': serializer.toJson<double?>(crossSectionWidthMm),
      'crossSectionHeightMm': serializer.toJson<double?>(crossSectionHeightMm),
      'measurementMethod': serializer.toJson<String?>(measurementMethod),
      'calibrationVersion': serializer.toJson<String?>(calibrationVersion),
      'predictedGrade': serializer.toJson<String?>(predictedGrade),
      'expertGrade': serializer.toJson<String?>(expertGrade),
      'modelVersion': serializer.toJson<String?>(modelVersion),
      'diameterMm': serializer.toJson<double?>(diameterMm),
      'diameterSource': serializer.toJson<String?>(diameterSource),
      'diameterModelVersion': serializer.toJson<String?>(diameterModelVersion),
      'estimatedDiameterMm': serializer.toJson<double?>(estimatedDiameterMm),
      'measuredDiameterMm': serializer.toJson<double?>(measuredDiameterMm),
      'modelProbability': serializer.toJson<double?>(modelProbability),
      'needsReview': serializer.toJson<bool>(needsReview),
      'isSynced': serializer.toJson<bool>(isSynced),
      'revision': serializer.toJson<int>(revision),
      'serverReceiptTime': serializer.toJson<DateTime?>(serverReceiptTime),
    };
  }

  Sample copyWith({
    String? id,
    String? ownerId,
    String? sampleId,
    Value<String?> batchId = const Value.absent(),
    DateTime? captureTimestamp,
    Value<String?> location = const Value.absent(),
    Value<String?> sidePhotoLocalPath = const Value.absent(),
    Value<String?> endPhotoLocalPath = const Value.absent(),
    Value<String?> sidePhotoCloudPath = const Value.absent(),
    Value<String?> endPhotoCloudPath = const Value.absent(),
    Value<double?> crossSectionWidthMm = const Value.absent(),
    Value<double?> crossSectionHeightMm = const Value.absent(),
    Value<String?> measurementMethod = const Value.absent(),
    Value<String?> calibrationVersion = const Value.absent(),
    Value<String?> predictedGrade = const Value.absent(),
    Value<String?> expertGrade = const Value.absent(),
    Value<String?> modelVersion = const Value.absent(),
    Value<double?> diameterMm = const Value.absent(),
    Value<String?> diameterSource = const Value.absent(),
    Value<String?> diameterModelVersion = const Value.absent(),
    Value<double?> estimatedDiameterMm = const Value.absent(),
    Value<double?> measuredDiameterMm = const Value.absent(),
    Value<double?> modelProbability = const Value.absent(),
    bool? needsReview,
    bool? isSynced,
    int? revision,
    Value<DateTime?> serverReceiptTime = const Value.absent(),
  }) => Sample(
    id: id ?? this.id,
    ownerId: ownerId ?? this.ownerId,
    sampleId: sampleId ?? this.sampleId,
    batchId: batchId.present ? batchId.value : this.batchId,
    captureTimestamp: captureTimestamp ?? this.captureTimestamp,
    location: location.present ? location.value : this.location,
    sidePhotoLocalPath: sidePhotoLocalPath.present
        ? sidePhotoLocalPath.value
        : this.sidePhotoLocalPath,
    endPhotoLocalPath: endPhotoLocalPath.present
        ? endPhotoLocalPath.value
        : this.endPhotoLocalPath,
    sidePhotoCloudPath: sidePhotoCloudPath.present
        ? sidePhotoCloudPath.value
        : this.sidePhotoCloudPath,
    endPhotoCloudPath: endPhotoCloudPath.present
        ? endPhotoCloudPath.value
        : this.endPhotoCloudPath,
    crossSectionWidthMm: crossSectionWidthMm.present
        ? crossSectionWidthMm.value
        : this.crossSectionWidthMm,
    crossSectionHeightMm: crossSectionHeightMm.present
        ? crossSectionHeightMm.value
        : this.crossSectionHeightMm,
    measurementMethod: measurementMethod.present
        ? measurementMethod.value
        : this.measurementMethod,
    calibrationVersion: calibrationVersion.present
        ? calibrationVersion.value
        : this.calibrationVersion,
    predictedGrade: predictedGrade.present
        ? predictedGrade.value
        : this.predictedGrade,
    expertGrade: expertGrade.present ? expertGrade.value : this.expertGrade,
    modelVersion: modelVersion.present ? modelVersion.value : this.modelVersion,
    diameterMm: diameterMm.present ? diameterMm.value : this.diameterMm,
    diameterSource: diameterSource.present
        ? diameterSource.value
        : this.diameterSource,
    diameterModelVersion: diameterModelVersion.present
        ? diameterModelVersion.value
        : this.diameterModelVersion,
    estimatedDiameterMm: estimatedDiameterMm.present
        ? estimatedDiameterMm.value
        : this.estimatedDiameterMm,
    measuredDiameterMm: measuredDiameterMm.present
        ? measuredDiameterMm.value
        : this.measuredDiameterMm,
    modelProbability: modelProbability.present
        ? modelProbability.value
        : this.modelProbability,
    needsReview: needsReview ?? this.needsReview,
    isSynced: isSynced ?? this.isSynced,
    revision: revision ?? this.revision,
    serverReceiptTime: serverReceiptTime.present
        ? serverReceiptTime.value
        : this.serverReceiptTime,
  );
  Sample copyWithCompanion(SamplesCompanion data) {
    return Sample(
      id: data.id.present ? data.id.value : this.id,
      ownerId: data.ownerId.present ? data.ownerId.value : this.ownerId,
      sampleId: data.sampleId.present ? data.sampleId.value : this.sampleId,
      batchId: data.batchId.present ? data.batchId.value : this.batchId,
      captureTimestamp: data.captureTimestamp.present
          ? data.captureTimestamp.value
          : this.captureTimestamp,
      location: data.location.present ? data.location.value : this.location,
      sidePhotoLocalPath: data.sidePhotoLocalPath.present
          ? data.sidePhotoLocalPath.value
          : this.sidePhotoLocalPath,
      endPhotoLocalPath: data.endPhotoLocalPath.present
          ? data.endPhotoLocalPath.value
          : this.endPhotoLocalPath,
      sidePhotoCloudPath: data.sidePhotoCloudPath.present
          ? data.sidePhotoCloudPath.value
          : this.sidePhotoCloudPath,
      endPhotoCloudPath: data.endPhotoCloudPath.present
          ? data.endPhotoCloudPath.value
          : this.endPhotoCloudPath,
      crossSectionWidthMm: data.crossSectionWidthMm.present
          ? data.crossSectionWidthMm.value
          : this.crossSectionWidthMm,
      crossSectionHeightMm: data.crossSectionHeightMm.present
          ? data.crossSectionHeightMm.value
          : this.crossSectionHeightMm,
      measurementMethod: data.measurementMethod.present
          ? data.measurementMethod.value
          : this.measurementMethod,
      calibrationVersion: data.calibrationVersion.present
          ? data.calibrationVersion.value
          : this.calibrationVersion,
      predictedGrade: data.predictedGrade.present
          ? data.predictedGrade.value
          : this.predictedGrade,
      expertGrade: data.expertGrade.present
          ? data.expertGrade.value
          : this.expertGrade,
      modelVersion: data.modelVersion.present
          ? data.modelVersion.value
          : this.modelVersion,
      diameterMm: data.diameterMm.present
          ? data.diameterMm.value
          : this.diameterMm,
      diameterSource: data.diameterSource.present
          ? data.diameterSource.value
          : this.diameterSource,
      diameterModelVersion: data.diameterModelVersion.present
          ? data.diameterModelVersion.value
          : this.diameterModelVersion,
      estimatedDiameterMm: data.estimatedDiameterMm.present
          ? data.estimatedDiameterMm.value
          : this.estimatedDiameterMm,
      measuredDiameterMm: data.measuredDiameterMm.present
          ? data.measuredDiameterMm.value
          : this.measuredDiameterMm,
      modelProbability: data.modelProbability.present
          ? data.modelProbability.value
          : this.modelProbability,
      needsReview: data.needsReview.present
          ? data.needsReview.value
          : this.needsReview,
      isSynced: data.isSynced.present ? data.isSynced.value : this.isSynced,
      revision: data.revision.present ? data.revision.value : this.revision,
      serverReceiptTime: data.serverReceiptTime.present
          ? data.serverReceiptTime.value
          : this.serverReceiptTime,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Sample(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('sampleId: $sampleId, ')
          ..write('batchId: $batchId, ')
          ..write('captureTimestamp: $captureTimestamp, ')
          ..write('location: $location, ')
          ..write('sidePhotoLocalPath: $sidePhotoLocalPath, ')
          ..write('endPhotoLocalPath: $endPhotoLocalPath, ')
          ..write('sidePhotoCloudPath: $sidePhotoCloudPath, ')
          ..write('endPhotoCloudPath: $endPhotoCloudPath, ')
          ..write('crossSectionWidthMm: $crossSectionWidthMm, ')
          ..write('crossSectionHeightMm: $crossSectionHeightMm, ')
          ..write('measurementMethod: $measurementMethod, ')
          ..write('calibrationVersion: $calibrationVersion, ')
          ..write('predictedGrade: $predictedGrade, ')
          ..write('expertGrade: $expertGrade, ')
          ..write('modelVersion: $modelVersion, ')
          ..write('diameterMm: $diameterMm, ')
          ..write('diameterSource: $diameterSource, ')
          ..write('diameterModelVersion: $diameterModelVersion, ')
          ..write('estimatedDiameterMm: $estimatedDiameterMm, ')
          ..write('measuredDiameterMm: $measuredDiameterMm, ')
          ..write('modelProbability: $modelProbability, ')
          ..write('needsReview: $needsReview, ')
          ..write('isSynced: $isSynced, ')
          ..write('revision: $revision, ')
          ..write('serverReceiptTime: $serverReceiptTime')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    id,
    ownerId,
    sampleId,
    batchId,
    captureTimestamp,
    location,
    sidePhotoLocalPath,
    endPhotoLocalPath,
    sidePhotoCloudPath,
    endPhotoCloudPath,
    crossSectionWidthMm,
    crossSectionHeightMm,
    measurementMethod,
    calibrationVersion,
    predictedGrade,
    expertGrade,
    modelVersion,
    diameterMm,
    diameterSource,
    diameterModelVersion,
    estimatedDiameterMm,
    measuredDiameterMm,
    modelProbability,
    needsReview,
    isSynced,
    revision,
    serverReceiptTime,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Sample &&
          other.id == this.id &&
          other.ownerId == this.ownerId &&
          other.sampleId == this.sampleId &&
          other.batchId == this.batchId &&
          other.captureTimestamp == this.captureTimestamp &&
          other.location == this.location &&
          other.sidePhotoLocalPath == this.sidePhotoLocalPath &&
          other.endPhotoLocalPath == this.endPhotoLocalPath &&
          other.sidePhotoCloudPath == this.sidePhotoCloudPath &&
          other.endPhotoCloudPath == this.endPhotoCloudPath &&
          other.crossSectionWidthMm == this.crossSectionWidthMm &&
          other.crossSectionHeightMm == this.crossSectionHeightMm &&
          other.measurementMethod == this.measurementMethod &&
          other.calibrationVersion == this.calibrationVersion &&
          other.predictedGrade == this.predictedGrade &&
          other.expertGrade == this.expertGrade &&
          other.modelVersion == this.modelVersion &&
          other.diameterMm == this.diameterMm &&
          other.diameterSource == this.diameterSource &&
          other.diameterModelVersion == this.diameterModelVersion &&
          other.estimatedDiameterMm == this.estimatedDiameterMm &&
          other.measuredDiameterMm == this.measuredDiameterMm &&
          other.modelProbability == this.modelProbability &&
          other.needsReview == this.needsReview &&
          other.isSynced == this.isSynced &&
          other.revision == this.revision &&
          other.serverReceiptTime == this.serverReceiptTime);
}

class SamplesCompanion extends UpdateCompanion<Sample> {
  final Value<String> id;
  final Value<String> ownerId;
  final Value<String> sampleId;
  final Value<String?> batchId;
  final Value<DateTime> captureTimestamp;
  final Value<String?> location;
  final Value<String?> sidePhotoLocalPath;
  final Value<String?> endPhotoLocalPath;
  final Value<String?> sidePhotoCloudPath;
  final Value<String?> endPhotoCloudPath;
  final Value<double?> crossSectionWidthMm;
  final Value<double?> crossSectionHeightMm;
  final Value<String?> measurementMethod;
  final Value<String?> calibrationVersion;
  final Value<String?> predictedGrade;
  final Value<String?> expertGrade;
  final Value<String?> modelVersion;
  final Value<double?> diameterMm;
  final Value<String?> diameterSource;
  final Value<String?> diameterModelVersion;
  final Value<double?> estimatedDiameterMm;
  final Value<double?> measuredDiameterMm;
  final Value<double?> modelProbability;
  final Value<bool> needsReview;
  final Value<bool> isSynced;
  final Value<int> revision;
  final Value<DateTime?> serverReceiptTime;
  final Value<int> rowid;
  const SamplesCompanion({
    this.id = const Value.absent(),
    this.ownerId = const Value.absent(),
    this.sampleId = const Value.absent(),
    this.batchId = const Value.absent(),
    this.captureTimestamp = const Value.absent(),
    this.location = const Value.absent(),
    this.sidePhotoLocalPath = const Value.absent(),
    this.endPhotoLocalPath = const Value.absent(),
    this.sidePhotoCloudPath = const Value.absent(),
    this.endPhotoCloudPath = const Value.absent(),
    this.crossSectionWidthMm = const Value.absent(),
    this.crossSectionHeightMm = const Value.absent(),
    this.measurementMethod = const Value.absent(),
    this.calibrationVersion = const Value.absent(),
    this.predictedGrade = const Value.absent(),
    this.expertGrade = const Value.absent(),
    this.modelVersion = const Value.absent(),
    this.diameterMm = const Value.absent(),
    this.diameterSource = const Value.absent(),
    this.diameterModelVersion = const Value.absent(),
    this.estimatedDiameterMm = const Value.absent(),
    this.measuredDiameterMm = const Value.absent(),
    this.modelProbability = const Value.absent(),
    this.needsReview = const Value.absent(),
    this.isSynced = const Value.absent(),
    this.revision = const Value.absent(),
    this.serverReceiptTime = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SamplesCompanion.insert({
    required String id,
    required String ownerId,
    required String sampleId,
    this.batchId = const Value.absent(),
    required DateTime captureTimestamp,
    this.location = const Value.absent(),
    this.sidePhotoLocalPath = const Value.absent(),
    this.endPhotoLocalPath = const Value.absent(),
    this.sidePhotoCloudPath = const Value.absent(),
    this.endPhotoCloudPath = const Value.absent(),
    this.crossSectionWidthMm = const Value.absent(),
    this.crossSectionHeightMm = const Value.absent(),
    this.measurementMethod = const Value.absent(),
    this.calibrationVersion = const Value.absent(),
    this.predictedGrade = const Value.absent(),
    this.expertGrade = const Value.absent(),
    this.modelVersion = const Value.absent(),
    this.diameterMm = const Value.absent(),
    this.diameterSource = const Value.absent(),
    this.diameterModelVersion = const Value.absent(),
    this.estimatedDiameterMm = const Value.absent(),
    this.measuredDiameterMm = const Value.absent(),
    this.modelProbability = const Value.absent(),
    this.needsReview = const Value.absent(),
    this.isSynced = const Value.absent(),
    this.revision = const Value.absent(),
    this.serverReceiptTime = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       ownerId = Value(ownerId),
       sampleId = Value(sampleId),
       captureTimestamp = Value(captureTimestamp);
  static Insertable<Sample> custom({
    Expression<String>? id,
    Expression<String>? ownerId,
    Expression<String>? sampleId,
    Expression<String>? batchId,
    Expression<DateTime>? captureTimestamp,
    Expression<String>? location,
    Expression<String>? sidePhotoLocalPath,
    Expression<String>? endPhotoLocalPath,
    Expression<String>? sidePhotoCloudPath,
    Expression<String>? endPhotoCloudPath,
    Expression<double>? crossSectionWidthMm,
    Expression<double>? crossSectionHeightMm,
    Expression<String>? measurementMethod,
    Expression<String>? calibrationVersion,
    Expression<String>? predictedGrade,
    Expression<String>? expertGrade,
    Expression<String>? modelVersion,
    Expression<double>? diameterMm,
    Expression<String>? diameterSource,
    Expression<String>? diameterModelVersion,
    Expression<double>? estimatedDiameterMm,
    Expression<double>? measuredDiameterMm,
    Expression<double>? modelProbability,
    Expression<bool>? needsReview,
    Expression<bool>? isSynced,
    Expression<int>? revision,
    Expression<DateTime>? serverReceiptTime,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerId != null) 'owner_id': ownerId,
      if (sampleId != null) 'sample_id': sampleId,
      if (batchId != null) 'batch_id': batchId,
      if (captureTimestamp != null) 'capture_timestamp': captureTimestamp,
      if (location != null) 'location': location,
      if (sidePhotoLocalPath != null)
        'side_photo_local_path': sidePhotoLocalPath,
      if (endPhotoLocalPath != null) 'end_photo_local_path': endPhotoLocalPath,
      if (sidePhotoCloudPath != null)
        'side_photo_cloud_path': sidePhotoCloudPath,
      if (endPhotoCloudPath != null) 'end_photo_cloud_path': endPhotoCloudPath,
      if (crossSectionWidthMm != null)
        'cross_section_width_mm': crossSectionWidthMm,
      if (crossSectionHeightMm != null)
        'cross_section_height_mm': crossSectionHeightMm,
      if (measurementMethod != null) 'measurement_method': measurementMethod,
      if (calibrationVersion != null) 'calibration_version': calibrationVersion,
      if (predictedGrade != null) 'predicted_grade': predictedGrade,
      if (expertGrade != null) 'expert_grade': expertGrade,
      if (modelVersion != null) 'model_version': modelVersion,
      if (diameterMm != null) 'diameter_mm': diameterMm,
      if (diameterSource != null) 'diameter_source': diameterSource,
      if (diameterModelVersion != null)
        'diameter_model_version': diameterModelVersion,
      if (estimatedDiameterMm != null)
        'estimated_diameter_mm': estimatedDiameterMm,
      if (measuredDiameterMm != null)
        'measured_diameter_mm': measuredDiameterMm,
      if (modelProbability != null) 'model_probability': modelProbability,
      if (needsReview != null) 'needs_review': needsReview,
      if (isSynced != null) 'is_synced': isSynced,
      if (revision != null) 'revision': revision,
      if (serverReceiptTime != null) 'server_receipt_time': serverReceiptTime,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SamplesCompanion copyWith({
    Value<String>? id,
    Value<String>? ownerId,
    Value<String>? sampleId,
    Value<String?>? batchId,
    Value<DateTime>? captureTimestamp,
    Value<String?>? location,
    Value<String?>? sidePhotoLocalPath,
    Value<String?>? endPhotoLocalPath,
    Value<String?>? sidePhotoCloudPath,
    Value<String?>? endPhotoCloudPath,
    Value<double?>? crossSectionWidthMm,
    Value<double?>? crossSectionHeightMm,
    Value<String?>? measurementMethod,
    Value<String?>? calibrationVersion,
    Value<String?>? predictedGrade,
    Value<String?>? expertGrade,
    Value<String?>? modelVersion,
    Value<double?>? diameterMm,
    Value<String?>? diameterSource,
    Value<String?>? diameterModelVersion,
    Value<double?>? estimatedDiameterMm,
    Value<double?>? measuredDiameterMm,
    Value<double?>? modelProbability,
    Value<bool>? needsReview,
    Value<bool>? isSynced,
    Value<int>? revision,
    Value<DateTime?>? serverReceiptTime,
    Value<int>? rowid,
  }) {
    return SamplesCompanion(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      sampleId: sampleId ?? this.sampleId,
      batchId: batchId ?? this.batchId,
      captureTimestamp: captureTimestamp ?? this.captureTimestamp,
      location: location ?? this.location,
      sidePhotoLocalPath: sidePhotoLocalPath ?? this.sidePhotoLocalPath,
      endPhotoLocalPath: endPhotoLocalPath ?? this.endPhotoLocalPath,
      sidePhotoCloudPath: sidePhotoCloudPath ?? this.sidePhotoCloudPath,
      endPhotoCloudPath: endPhotoCloudPath ?? this.endPhotoCloudPath,
      crossSectionWidthMm: crossSectionWidthMm ?? this.crossSectionWidthMm,
      crossSectionHeightMm: crossSectionHeightMm ?? this.crossSectionHeightMm,
      measurementMethod: measurementMethod ?? this.measurementMethod,
      calibrationVersion: calibrationVersion ?? this.calibrationVersion,
      predictedGrade: predictedGrade ?? this.predictedGrade,
      expertGrade: expertGrade ?? this.expertGrade,
      modelVersion: modelVersion ?? this.modelVersion,
      diameterMm: diameterMm ?? this.diameterMm,
      diameterSource: diameterSource ?? this.diameterSource,
      diameterModelVersion: diameterModelVersion ?? this.diameterModelVersion,
      estimatedDiameterMm: estimatedDiameterMm ?? this.estimatedDiameterMm,
      measuredDiameterMm: measuredDiameterMm ?? this.measuredDiameterMm,
      modelProbability: modelProbability ?? this.modelProbability,
      needsReview: needsReview ?? this.needsReview,
      isSynced: isSynced ?? this.isSynced,
      revision: revision ?? this.revision,
      serverReceiptTime: serverReceiptTime ?? this.serverReceiptTime,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerId.present) {
      map['owner_id'] = Variable<String>(ownerId.value);
    }
    if (sampleId.present) {
      map['sample_id'] = Variable<String>(sampleId.value);
    }
    if (batchId.present) {
      map['batch_id'] = Variable<String>(batchId.value);
    }
    if (captureTimestamp.present) {
      map['capture_timestamp'] = Variable<DateTime>(captureTimestamp.value);
    }
    if (location.present) {
      map['location'] = Variable<String>(location.value);
    }
    if (sidePhotoLocalPath.present) {
      map['side_photo_local_path'] = Variable<String>(sidePhotoLocalPath.value);
    }
    if (endPhotoLocalPath.present) {
      map['end_photo_local_path'] = Variable<String>(endPhotoLocalPath.value);
    }
    if (sidePhotoCloudPath.present) {
      map['side_photo_cloud_path'] = Variable<String>(sidePhotoCloudPath.value);
    }
    if (endPhotoCloudPath.present) {
      map['end_photo_cloud_path'] = Variable<String>(endPhotoCloudPath.value);
    }
    if (crossSectionWidthMm.present) {
      map['cross_section_width_mm'] = Variable<double>(
        crossSectionWidthMm.value,
      );
    }
    if (crossSectionHeightMm.present) {
      map['cross_section_height_mm'] = Variable<double>(
        crossSectionHeightMm.value,
      );
    }
    if (measurementMethod.present) {
      map['measurement_method'] = Variable<String>(measurementMethod.value);
    }
    if (calibrationVersion.present) {
      map['calibration_version'] = Variable<String>(calibrationVersion.value);
    }
    if (predictedGrade.present) {
      map['predicted_grade'] = Variable<String>(predictedGrade.value);
    }
    if (expertGrade.present) {
      map['expert_grade'] = Variable<String>(expertGrade.value);
    }
    if (modelVersion.present) {
      map['model_version'] = Variable<String>(modelVersion.value);
    }
    if (diameterMm.present) {
      map['diameter_mm'] = Variable<double>(diameterMm.value);
    }
    if (diameterSource.present) {
      map['diameter_source'] = Variable<String>(diameterSource.value);
    }
    if (diameterModelVersion.present) {
      map['diameter_model_version'] = Variable<String>(
        diameterModelVersion.value,
      );
    }
    if (estimatedDiameterMm.present) {
      map['estimated_diameter_mm'] = Variable<double>(
        estimatedDiameterMm.value,
      );
    }
    if (measuredDiameterMm.present) {
      map['measured_diameter_mm'] = Variable<double>(measuredDiameterMm.value);
    }
    if (modelProbability.present) {
      map['model_probability'] = Variable<double>(modelProbability.value);
    }
    if (needsReview.present) {
      map['needs_review'] = Variable<bool>(needsReview.value);
    }
    if (isSynced.present) {
      map['is_synced'] = Variable<bool>(isSynced.value);
    }
    if (revision.present) {
      map['revision'] = Variable<int>(revision.value);
    }
    if (serverReceiptTime.present) {
      map['server_receipt_time'] = Variable<DateTime>(serverReceiptTime.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SamplesCompanion(')
          ..write('id: $id, ')
          ..write('ownerId: $ownerId, ')
          ..write('sampleId: $sampleId, ')
          ..write('batchId: $batchId, ')
          ..write('captureTimestamp: $captureTimestamp, ')
          ..write('location: $location, ')
          ..write('sidePhotoLocalPath: $sidePhotoLocalPath, ')
          ..write('endPhotoLocalPath: $endPhotoLocalPath, ')
          ..write('sidePhotoCloudPath: $sidePhotoCloudPath, ')
          ..write('endPhotoCloudPath: $endPhotoCloudPath, ')
          ..write('crossSectionWidthMm: $crossSectionWidthMm, ')
          ..write('crossSectionHeightMm: $crossSectionHeightMm, ')
          ..write('measurementMethod: $measurementMethod, ')
          ..write('calibrationVersion: $calibrationVersion, ')
          ..write('predictedGrade: $predictedGrade, ')
          ..write('expertGrade: $expertGrade, ')
          ..write('modelVersion: $modelVersion, ')
          ..write('diameterMm: $diameterMm, ')
          ..write('diameterSource: $diameterSource, ')
          ..write('diameterModelVersion: $diameterModelVersion, ')
          ..write('estimatedDiameterMm: $estimatedDiameterMm, ')
          ..write('measuredDiameterMm: $measuredDiameterMm, ')
          ..write('modelProbability: $modelProbability, ')
          ..write('needsReview: $needsReview, ')
          ..write('isSynced: $isSynced, ')
          ..write('revision: $revision, ')
          ..write('serverReceiptTime: $serverReceiptTime, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncJobsTable extends SyncJobs with TableInfo<$SyncJobsTable, SyncJob> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncJobsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sampleIdMeta = const VerificationMeta(
    'sampleId',
  );
  @override
  late final GeneratedColumn<String> sampleId = GeneratedColumn<String>(
    'sample_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES samples (id)',
    ),
  );
  static const VerificationMeta _operationMeta = const VerificationMeta(
    'operation',
  );
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
    'operation',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isCompletedMeta = const VerificationMeta(
    'isCompleted',
  );
  @override
  late final GeneratedColumn<bool> isCompleted = GeneratedColumn<bool>(
    'is_completed',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_completed" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    sampleId,
    operation,
    createdAt,
    retryCount,
    lastError,
    isCompleted,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_jobs';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncJob> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('sample_id')) {
      context.handle(
        _sampleIdMeta,
        sampleId.isAcceptableOrUnknown(data['sample_id']!, _sampleIdMeta),
      );
    } else if (isInserting) {
      context.missing(_sampleIdMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(
        _operationMeta,
        operation.isAcceptableOrUnknown(data['operation']!, _operationMeta),
      );
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('is_completed')) {
      context.handle(
        _isCompletedMeta,
        isCompleted.isAcceptableOrUnknown(
          data['is_completed']!,
          _isCompletedMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncJob map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncJob(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      sampleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sample_id'],
      )!,
      operation: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operation'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      isCompleted: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_completed'],
      )!,
    );
  }

  @override
  $SyncJobsTable createAlias(String alias) {
    return $SyncJobsTable(attachedDatabase, alias);
  }
}

class SyncJob extends DataClass implements Insertable<SyncJob> {
  final String id;
  final String sampleId;
  final String operation;
  final DateTime createdAt;
  final int retryCount;
  final String? lastError;
  final bool isCompleted;
  const SyncJob({
    required this.id,
    required this.sampleId,
    required this.operation,
    required this.createdAt,
    required this.retryCount,
    this.lastError,
    required this.isCompleted,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['sample_id'] = Variable<String>(sampleId);
    map['operation'] = Variable<String>(operation);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['is_completed'] = Variable<bool>(isCompleted);
    return map;
  }

  SyncJobsCompanion toCompanion(bool nullToAbsent) {
    return SyncJobsCompanion(
      id: Value(id),
      sampleId: Value(sampleId),
      operation: Value(operation),
      createdAt: Value(createdAt),
      retryCount: Value(retryCount),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      isCompleted: Value(isCompleted),
    );
  }

  factory SyncJob.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncJob(
      id: serializer.fromJson<String>(json['id']),
      sampleId: serializer.fromJson<String>(json['sampleId']),
      operation: serializer.fromJson<String>(json['operation']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      isCompleted: serializer.fromJson<bool>(json['isCompleted']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'sampleId': serializer.toJson<String>(sampleId),
      'operation': serializer.toJson<String>(operation),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastError': serializer.toJson<String?>(lastError),
      'isCompleted': serializer.toJson<bool>(isCompleted),
    };
  }

  SyncJob copyWith({
    String? id,
    String? sampleId,
    String? operation,
    DateTime? createdAt,
    int? retryCount,
    Value<String?> lastError = const Value.absent(),
    bool? isCompleted,
  }) => SyncJob(
    id: id ?? this.id,
    sampleId: sampleId ?? this.sampleId,
    operation: operation ?? this.operation,
    createdAt: createdAt ?? this.createdAt,
    retryCount: retryCount ?? this.retryCount,
    lastError: lastError.present ? lastError.value : this.lastError,
    isCompleted: isCompleted ?? this.isCompleted,
  );
  SyncJob copyWithCompanion(SyncJobsCompanion data) {
    return SyncJob(
      id: data.id.present ? data.id.value : this.id,
      sampleId: data.sampleId.present ? data.sampleId.value : this.sampleId,
      operation: data.operation.present ? data.operation.value : this.operation,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      isCompleted: data.isCompleted.present
          ? data.isCompleted.value
          : this.isCompleted,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncJob(')
          ..write('id: $id, ')
          ..write('sampleId: $sampleId, ')
          ..write('operation: $operation, ')
          ..write('createdAt: $createdAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError, ')
          ..write('isCompleted: $isCompleted')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    sampleId,
    operation,
    createdAt,
    retryCount,
    lastError,
    isCompleted,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncJob &&
          other.id == this.id &&
          other.sampleId == this.sampleId &&
          other.operation == this.operation &&
          other.createdAt == this.createdAt &&
          other.retryCount == this.retryCount &&
          other.lastError == this.lastError &&
          other.isCompleted == this.isCompleted);
}

class SyncJobsCompanion extends UpdateCompanion<SyncJob> {
  final Value<String> id;
  final Value<String> sampleId;
  final Value<String> operation;
  final Value<DateTime> createdAt;
  final Value<int> retryCount;
  final Value<String?> lastError;
  final Value<bool> isCompleted;
  final Value<int> rowid;
  const SyncJobsCompanion({
    this.id = const Value.absent(),
    this.sampleId = const Value.absent(),
    this.operation = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
    this.isCompleted = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncJobsCompanion.insert({
    required String id,
    required String sampleId,
    required String operation,
    required DateTime createdAt,
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
    this.isCompleted = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       sampleId = Value(sampleId),
       operation = Value(operation),
       createdAt = Value(createdAt);
  static Insertable<SyncJob> custom({
    Expression<String>? id,
    Expression<String>? sampleId,
    Expression<String>? operation,
    Expression<DateTime>? createdAt,
    Expression<int>? retryCount,
    Expression<String>? lastError,
    Expression<bool>? isCompleted,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (sampleId != null) 'sample_id': sampleId,
      if (operation != null) 'operation': operation,
      if (createdAt != null) 'created_at': createdAt,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastError != null) 'last_error': lastError,
      if (isCompleted != null) 'is_completed': isCompleted,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncJobsCompanion copyWith({
    Value<String>? id,
    Value<String>? sampleId,
    Value<String>? operation,
    Value<DateTime>? createdAt,
    Value<int>? retryCount,
    Value<String?>? lastError,
    Value<bool>? isCompleted,
    Value<int>? rowid,
  }) {
    return SyncJobsCompanion(
      id: id ?? this.id,
      sampleId: sampleId ?? this.sampleId,
      operation: operation ?? this.operation,
      createdAt: createdAt ?? this.createdAt,
      retryCount: retryCount ?? this.retryCount,
      lastError: lastError ?? this.lastError,
      isCompleted: isCompleted ?? this.isCompleted,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (sampleId.present) {
      map['sample_id'] = Variable<String>(sampleId.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (isCompleted.present) {
      map['is_completed'] = Variable<bool>(isCompleted.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncJobsCompanion(')
          ..write('id: $id, ')
          ..write('sampleId: $sampleId, ')
          ..write('operation: $operation, ')
          ..write('createdAt: $createdAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError, ')
          ..write('isCompleted: $isCompleted, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $SamplesTable samples = $SamplesTable(this);
  late final $SyncJobsTable syncJobs = $SyncJobsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [samples, syncJobs];
}

typedef $$SamplesTableCreateCompanionBuilder = SamplesCompanion Function({
  required String id,
  required String ownerId,
  required String sampleId,
  Value<String?> batchId,
  required DateTime captureTimestamp,
  Value<String?> location,
  Value<String?> sidePhotoLocalPath,
  Value<String?> endPhotoLocalPath,
  Value<String?> sidePhotoCloudPath,
  Value<String?> endPhotoCloudPath,
  Value<double?> crossSectionWidthMm,
  Value<double?> crossSectionHeightMm,
  Value<String?> measurementMethod,
  Value<String?> calibrationVersion,
  Value<String?> predictedGrade,
  Value<String?> expertGrade,
  Value<String?> modelVersion,
  Value<double?> diameterMm,
  Value<String?> diameterSource,
  Value<String?> diameterModelVersion,
  Value<double?> estimatedDiameterMm,
  Value<double?> measuredDiameterMm,
  Value<double?> modelProbability,
  Value<bool> needsReview,
  Value<bool> isSynced,
  Value<int> revision,
  Value<DateTime?> serverReceiptTime,
  Value<int> rowid,
});
typedef $$SamplesTableUpdateCompanionBuilder = SamplesCompanion Function({
  Value<String> id,
  Value<String> ownerId,
  Value<String> sampleId,
  Value<String?> batchId,
  Value<DateTime> captureTimestamp,
  Value<String?> location,
  Value<String?> sidePhotoLocalPath,
  Value<String?> endPhotoLocalPath,
  Value<String?> sidePhotoCloudPath,
  Value<String?> endPhotoCloudPath,
  Value<double?> crossSectionWidthMm,
  Value<double?> crossSectionHeightMm,
  Value<String?> measurementMethod,
  Value<String?> calibrationVersion,
  Value<String?> predictedGrade,
  Value<String?> expertGrade,
  Value<String?> modelVersion,
  Value<double?> diameterMm,
  Value<String?> diameterSource,
  Value<String?> diameterModelVersion,
  Value<double?> estimatedDiameterMm,
  Value<double?> measuredDiameterMm,
  Value<double?> modelProbability,
  Value<bool> needsReview,
  Value<bool> isSynced,
  Value<int> revision,
  Value<DateTime?> serverReceiptTime,
  Value<int> rowid,
});

final class $$SamplesTableReferences
    extends BaseReferences<_$AppDatabase, $SamplesTable, Sample> {
  $$SamplesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$SyncJobsTable, List<SyncJob>> _syncJobsRefsTable(
    _$AppDatabase db,
  ) => MultiTypedResultKey.fromTable(
    db.syncJobs,
    aliasName: 'samples__id__sync_jobs__sample_id',
  );

  $$SyncJobsTableProcessedTableManager get syncJobsRefs {
    final manager = $$SyncJobsTableTableManager(
      $_db,
      $_db.syncJobs,
    ).filter((f) => f.sampleId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_syncJobsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$SamplesTableFilterComposer
    extends Composer<_$AppDatabase, $SamplesTable> {
  $$SamplesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ownerId => $composableBuilder(
    column: $table.ownerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sampleId => $composableBuilder(
    column: $table.sampleId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get batchId => $composableBuilder(
    column: $table.batchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get captureTimestamp => $composableBuilder(
    column: $table.captureTimestamp,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get location => $composableBuilder(
    column: $table.location,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sidePhotoLocalPath => $composableBuilder(
    column: $table.sidePhotoLocalPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endPhotoLocalPath => $composableBuilder(
    column: $table.endPhotoLocalPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sidePhotoCloudPath => $composableBuilder(
    column: $table.sidePhotoCloudPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endPhotoCloudPath => $composableBuilder(
    column: $table.endPhotoCloudPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get crossSectionWidthMm => $composableBuilder(
    column: $table.crossSectionWidthMm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get crossSectionHeightMm => $composableBuilder(
    column: $table.crossSectionHeightMm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get measurementMethod => $composableBuilder(
    column: $table.measurementMethod,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get calibrationVersion => $composableBuilder(
    column: $table.calibrationVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get predictedGrade => $composableBuilder(
    column: $table.predictedGrade,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get expertGrade => $composableBuilder(
    column: $table.expertGrade,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get modelVersion => $composableBuilder(
    column: $table.modelVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get diameterMm => $composableBuilder(
    column: $table.diameterMm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get diameterSource => $composableBuilder(
    column: $table.diameterSource,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get diameterModelVersion => $composableBuilder(
    column: $table.diameterModelVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get estimatedDiameterMm => $composableBuilder(
    column: $table.estimatedDiameterMm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get measuredDiameterMm => $composableBuilder(
    column: $table.measuredDiameterMm,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get modelProbability => $composableBuilder(
    column: $table.modelProbability,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get needsReview => $composableBuilder(
    column: $table.needsReview,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isSynced => $composableBuilder(
    column: $table.isSynced,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get revision => $composableBuilder(
    column: $table.revision,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get serverReceiptTime => $composableBuilder(
    column: $table.serverReceiptTime,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> syncJobsRefs(
    Expression<bool> Function($$SyncJobsTableFilterComposer f) f,
  ) {
    final $$SyncJobsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.syncJobs,
      getReferencedColumn: (t) => t.sampleId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SyncJobsTableFilterComposer(
            $db: $db,
            $table: $db.syncJobs,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$SamplesTableOrderingComposer
    extends Composer<_$AppDatabase, $SamplesTable> {
  $$SamplesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ownerId => $composableBuilder(
    column: $table.ownerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sampleId => $composableBuilder(
    column: $table.sampleId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get batchId => $composableBuilder(
    column: $table.batchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get captureTimestamp => $composableBuilder(
    column: $table.captureTimestamp,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get location => $composableBuilder(
    column: $table.location,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sidePhotoLocalPath => $composableBuilder(
    column: $table.sidePhotoLocalPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endPhotoLocalPath => $composableBuilder(
    column: $table.endPhotoLocalPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sidePhotoCloudPath => $composableBuilder(
    column: $table.sidePhotoCloudPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endPhotoCloudPath => $composableBuilder(
    column: $table.endPhotoCloudPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get crossSectionWidthMm => $composableBuilder(
    column: $table.crossSectionWidthMm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get crossSectionHeightMm => $composableBuilder(
    column: $table.crossSectionHeightMm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get measurementMethod => $composableBuilder(
    column: $table.measurementMethod,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get calibrationVersion => $composableBuilder(
    column: $table.calibrationVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get predictedGrade => $composableBuilder(
    column: $table.predictedGrade,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get expertGrade => $composableBuilder(
    column: $table.expertGrade,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get modelVersion => $composableBuilder(
    column: $table.modelVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get diameterMm => $composableBuilder(
    column: $table.diameterMm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get diameterSource => $composableBuilder(
    column: $table.diameterSource,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get diameterModelVersion => $composableBuilder(
    column: $table.diameterModelVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get estimatedDiameterMm => $composableBuilder(
    column: $table.estimatedDiameterMm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get measuredDiameterMm => $composableBuilder(
    column: $table.measuredDiameterMm,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get modelProbability => $composableBuilder(
    column: $table.modelProbability,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get needsReview => $composableBuilder(
    column: $table.needsReview,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isSynced => $composableBuilder(
    column: $table.isSynced,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get revision => $composableBuilder(
    column: $table.revision,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get serverReceiptTime => $composableBuilder(
    column: $table.serverReceiptTime,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SamplesTableAnnotationComposer
    extends Composer<_$AppDatabase, $SamplesTable> {
  $$SamplesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerId =>
      $composableBuilder(column: $table.ownerId, builder: (column) => column);

  GeneratedColumn<String> get sampleId =>
      $composableBuilder(column: $table.sampleId, builder: (column) => column);

  GeneratedColumn<String> get batchId =>
      $composableBuilder(column: $table.batchId, builder: (column) => column);

  GeneratedColumn<DateTime> get captureTimestamp => $composableBuilder(
    column: $table.captureTimestamp,
    builder: (column) => column,
  );

  GeneratedColumn<String> get location =>
      $composableBuilder(column: $table.location, builder: (column) => column);

  GeneratedColumn<String> get sidePhotoLocalPath => $composableBuilder(
    column: $table.sidePhotoLocalPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get endPhotoLocalPath => $composableBuilder(
    column: $table.endPhotoLocalPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sidePhotoCloudPath => $composableBuilder(
    column: $table.sidePhotoCloudPath,
    builder: (column) => column,
  );

  GeneratedColumn<String> get endPhotoCloudPath => $composableBuilder(
    column: $table.endPhotoCloudPath,
    builder: (column) => column,
  );

  GeneratedColumn<double> get crossSectionWidthMm => $composableBuilder(
    column: $table.crossSectionWidthMm,
    builder: (column) => column,
  );

  GeneratedColumn<double> get crossSectionHeightMm => $composableBuilder(
    column: $table.crossSectionHeightMm,
    builder: (column) => column,
  );

  GeneratedColumn<String> get measurementMethod => $composableBuilder(
    column: $table.measurementMethod,
    builder: (column) => column,
  );

  GeneratedColumn<String> get calibrationVersion => $composableBuilder(
    column: $table.calibrationVersion,
    builder: (column) => column,
  );

  GeneratedColumn<String> get predictedGrade => $composableBuilder(
    column: $table.predictedGrade,
    builder: (column) => column,
  );

  GeneratedColumn<String> get expertGrade => $composableBuilder(
    column: $table.expertGrade,
    builder: (column) => column,
  );

  GeneratedColumn<String> get modelVersion => $composableBuilder(
    column: $table.modelVersion,
    builder: (column) => column,
  );

  GeneratedColumn<double> get diameterMm => $composableBuilder(
    column: $table.diameterMm,
    builder: (column) => column,
  );

  GeneratedColumn<String> get diameterSource => $composableBuilder(
    column: $table.diameterSource,
    builder: (column) => column,
  );

  GeneratedColumn<String> get diameterModelVersion => $composableBuilder(
    column: $table.diameterModelVersion,
    builder: (column) => column,
  );

  GeneratedColumn<double> get estimatedDiameterMm => $composableBuilder(
    column: $table.estimatedDiameterMm,
    builder: (column) => column,
  );

  GeneratedColumn<double> get measuredDiameterMm => $composableBuilder(
    column: $table.measuredDiameterMm,
    builder: (column) => column,
  );

  GeneratedColumn<double> get modelProbability => $composableBuilder(
    column: $table.modelProbability,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get needsReview => $composableBuilder(
    column: $table.needsReview,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get isSynced =>
      $composableBuilder(column: $table.isSynced, builder: (column) => column);

  GeneratedColumn<int> get revision =>
      $composableBuilder(column: $table.revision, builder: (column) => column);

  GeneratedColumn<DateTime> get serverReceiptTime => $composableBuilder(
    column: $table.serverReceiptTime,
    builder: (column) => column,
  );

  Expression<T> syncJobsRefs<T extends Object>(
    Expression<T> Function($$SyncJobsTableAnnotationComposer a) f,
  ) {
    final $$SyncJobsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.syncJobs,
      getReferencedColumn: (t) => t.sampleId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SyncJobsTableAnnotationComposer(
            $db: $db,
            $table: $db.syncJobs,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$SamplesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SamplesTable,
          Sample,
          $$SamplesTableFilterComposer,
          $$SamplesTableOrderingComposer,
          $$SamplesTableAnnotationComposer,
          $$SamplesTableCreateCompanionBuilder,
          $$SamplesTableUpdateCompanionBuilder,
          (Sample, $$SamplesTableReferences),
          Sample,
          PrefetchHooks Function({bool syncJobsRefs})
        > {
  $$SamplesTableTableManager(_$AppDatabase db, $SamplesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SamplesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SamplesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SamplesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> ownerId = const Value.absent(),
                Value<String> sampleId = const Value.absent(),
                Value<String?> batchId = const Value.absent(),
                Value<DateTime> captureTimestamp = const Value.absent(),
                Value<String?> location = const Value.absent(),
                Value<String?> sidePhotoLocalPath = const Value.absent(),
                Value<String?> endPhotoLocalPath = const Value.absent(),
                Value<String?> sidePhotoCloudPath = const Value.absent(),
                Value<String?> endPhotoCloudPath = const Value.absent(),
                Value<double?> crossSectionWidthMm = const Value.absent(),
                Value<double?> crossSectionHeightMm = const Value.absent(),
                Value<String?> measurementMethod = const Value.absent(),
                Value<String?> calibrationVersion = const Value.absent(),
                Value<String?> predictedGrade = const Value.absent(),
                Value<String?> expertGrade = const Value.absent(),
                Value<String?> modelVersion = const Value.absent(),
                Value<double?> diameterMm = const Value.absent(),
                Value<String?> diameterSource = const Value.absent(),
                Value<String?> diameterModelVersion = const Value.absent(),
                Value<double?> estimatedDiameterMm = const Value.absent(),
                Value<double?> measuredDiameterMm = const Value.absent(),
                Value<double?> modelProbability = const Value.absent(),
                Value<bool> needsReview = const Value.absent(),
                Value<bool> isSynced = const Value.absent(),
                Value<int> revision = const Value.absent(),
                Value<DateTime?> serverReceiptTime = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SamplesCompanion(
                id: id,
                ownerId: ownerId,
                sampleId: sampleId,
                batchId: batchId,
                captureTimestamp: captureTimestamp,
                location: location,
                sidePhotoLocalPath: sidePhotoLocalPath,
                endPhotoLocalPath: endPhotoLocalPath,
                sidePhotoCloudPath: sidePhotoCloudPath,
                endPhotoCloudPath: endPhotoCloudPath,
                crossSectionWidthMm: crossSectionWidthMm,
                crossSectionHeightMm: crossSectionHeightMm,
                measurementMethod: measurementMethod,
                calibrationVersion: calibrationVersion,
                predictedGrade: predictedGrade,
                expertGrade: expertGrade,
                modelVersion: modelVersion,
                diameterMm: diameterMm,
                diameterSource: diameterSource,
                diameterModelVersion: diameterModelVersion,
                estimatedDiameterMm: estimatedDiameterMm,
                measuredDiameterMm: measuredDiameterMm,
                modelProbability: modelProbability,
                needsReview: needsReview,
                isSynced: isSynced,
                revision: revision,
                serverReceiptTime: serverReceiptTime,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String ownerId,
                required String sampleId,
                Value<String?> batchId = const Value.absent(),
                required DateTime captureTimestamp,
                Value<String?> location = const Value.absent(),
                Value<String?> sidePhotoLocalPath = const Value.absent(),
                Value<String?> endPhotoLocalPath = const Value.absent(),
                Value<String?> sidePhotoCloudPath = const Value.absent(),
                Value<String?> endPhotoCloudPath = const Value.absent(),
                Value<double?> crossSectionWidthMm = const Value.absent(),
                Value<double?> crossSectionHeightMm = const Value.absent(),
                Value<String?> measurementMethod = const Value.absent(),
                Value<String?> calibrationVersion = const Value.absent(),
                Value<String?> predictedGrade = const Value.absent(),
                Value<String?> expertGrade = const Value.absent(),
                Value<String?> modelVersion = const Value.absent(),
                Value<double?> diameterMm = const Value.absent(),
                Value<String?> diameterSource = const Value.absent(),
                Value<String?> diameterModelVersion = const Value.absent(),
                Value<double?> estimatedDiameterMm = const Value.absent(),
                Value<double?> measuredDiameterMm = const Value.absent(),
                Value<double?> modelProbability = const Value.absent(),
                Value<bool> needsReview = const Value.absent(),
                Value<bool> isSynced = const Value.absent(),
                Value<int> revision = const Value.absent(),
                Value<DateTime?> serverReceiptTime = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SamplesCompanion.insert(
                id: id,
                ownerId: ownerId,
                sampleId: sampleId,
                batchId: batchId,
                captureTimestamp: captureTimestamp,
                location: location,
                sidePhotoLocalPath: sidePhotoLocalPath,
                endPhotoLocalPath: endPhotoLocalPath,
                sidePhotoCloudPath: sidePhotoCloudPath,
                endPhotoCloudPath: endPhotoCloudPath,
                crossSectionWidthMm: crossSectionWidthMm,
                crossSectionHeightMm: crossSectionHeightMm,
                measurementMethod: measurementMethod,
                calibrationVersion: calibrationVersion,
                predictedGrade: predictedGrade,
                expertGrade: expertGrade,
                modelVersion: modelVersion,
                diameterMm: diameterMm,
                diameterSource: diameterSource,
                diameterModelVersion: diameterModelVersion,
                estimatedDiameterMm: estimatedDiameterMm,
                measuredDiameterMm: measuredDiameterMm,
                modelProbability: modelProbability,
                needsReview: needsReview,
                isSynced: isSynced,
                revision: revision,
                serverReceiptTime: serverReceiptTime,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SamplesTable, Sample>(table),
                  $$SamplesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({syncJobsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (syncJobsRefs) db.syncJobs],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (syncJobsRefs)
                    await $_getPrefetchedData<Sample, $SamplesTable, SyncJob>(
                      currentTable: table,
                      referencedTable: $$SamplesTableReferences
                          ._syncJobsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$SamplesTableReferences(db, table, p0).syncJobsRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.sampleId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$SamplesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SamplesTable,
      Sample,
      $$SamplesTableFilterComposer,
      $$SamplesTableOrderingComposer,
      $$SamplesTableAnnotationComposer,
      $$SamplesTableCreateCompanionBuilder,
      $$SamplesTableUpdateCompanionBuilder,
      (Sample, $$SamplesTableReferences),
      Sample,
      PrefetchHooks Function({bool syncJobsRefs})
    >;
typedef $$SyncJobsTableCreateCompanionBuilder = SyncJobsCompanion Function({
  required String id,
  required String sampleId,
  required String operation,
  required DateTime createdAt,
  Value<int> retryCount,
  Value<String?> lastError,
  Value<bool> isCompleted,
  Value<int> rowid,
});
typedef $$SyncJobsTableUpdateCompanionBuilder = SyncJobsCompanion Function({
  Value<String> id,
  Value<String> sampleId,
  Value<String> operation,
  Value<DateTime> createdAt,
  Value<int> retryCount,
  Value<String?> lastError,
  Value<bool> isCompleted,
  Value<int> rowid,
});

final class $$SyncJobsTableReferences
    extends BaseReferences<_$AppDatabase, $SyncJobsTable, SyncJob> {
  $$SyncJobsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $SamplesTable _sampleIdTable(_$AppDatabase db) =>
      db.samples.createAlias('sync_jobs__sample_id__samples__id');

  $$SamplesTableProcessedTableManager get sampleId {
    final $_column = $_itemColumn<String>('sample_id')!;

    final manager = $$SamplesTableTableManager(
      $_db,
      $_db.samples,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_sampleIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$SyncJobsTableFilterComposer
    extends Composer<_$AppDatabase, $SyncJobsTable> {
  $$SyncJobsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isCompleted => $composableBuilder(
    column: $table.isCompleted,
    builder: (column) => ColumnFilters(column),
  );

  $$SamplesTableFilterComposer get sampleId {
    final $$SamplesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.sampleId,
      referencedTable: $db.samples,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SamplesTableFilterComposer(
            $db: $db,
            $table: $db.samples,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SyncJobsTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncJobsTable> {
  $$SyncJobsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isCompleted => $composableBuilder(
    column: $table.isCompleted,
    builder: (column) => ColumnOrderings(column),
  );

  $$SamplesTableOrderingComposer get sampleId {
    final $$SamplesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.sampleId,
      referencedTable: $db.samples,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SamplesTableOrderingComposer(
            $db: $db,
            $table: $db.samples,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SyncJobsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncJobsTable> {
  $$SyncJobsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<bool> get isCompleted => $composableBuilder(
    column: $table.isCompleted,
    builder: (column) => column,
  );

  $$SamplesTableAnnotationComposer get sampleId {
    final $$SamplesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.sampleId,
      referencedTable: $db.samples,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SamplesTableAnnotationComposer(
            $db: $db,
            $table: $db.samples,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SyncJobsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncJobsTable,
          SyncJob,
          $$SyncJobsTableFilterComposer,
          $$SyncJobsTableOrderingComposer,
          $$SyncJobsTableAnnotationComposer,
          $$SyncJobsTableCreateCompanionBuilder,
          $$SyncJobsTableUpdateCompanionBuilder,
          (SyncJob, $$SyncJobsTableReferences),
          SyncJob,
          PrefetchHooks Function({bool sampleId})
        > {
  $$SyncJobsTableTableManager(_$AppDatabase db, $SyncJobsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncJobsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncJobsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncJobsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> sampleId = const Value.absent(),
                Value<String> operation = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<bool> isCompleted = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncJobsCompanion(
                id: id,
                sampleId: sampleId,
                operation: operation,
                createdAt: createdAt,
                retryCount: retryCount,
                lastError: lastError,
                isCompleted: isCompleted,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String sampleId,
                required String operation,
                required DateTime createdAt,
                Value<int> retryCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<bool> isCompleted = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => SyncJobsCompanion.insert(
                id: id,
                sampleId: sampleId,
                operation: operation,
                createdAt: createdAt,
                retryCount: retryCount,
                lastError: lastError,
                isCompleted: isCompleted,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SyncJobsTable, SyncJob>(table),
                  $$SyncJobsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({sampleId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (sampleId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.sampleId,
                        referencedTable: $$SyncJobsTableReferences
                            ._sampleIdTable(db),
                        referencedColumn: $$SyncJobsTableReferences
                            ._sampleIdTable(db)
                            .id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$SyncJobsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncJobsTable,
      SyncJob,
      $$SyncJobsTableFilterComposer,
      $$SyncJobsTableOrderingComposer,
      $$SyncJobsTableAnnotationComposer,
      $$SyncJobsTableCreateCompanionBuilder,
      $$SyncJobsTableUpdateCompanionBuilder,
      (SyncJob, $$SyncJobsTableReferences),
      SyncJob,
      PrefetchHooks Function({bool sampleId})
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$SamplesTableTableManager get samples =>
      $$SamplesTableTableManager(_db, _db.samples);
  $$SyncJobsTableTableManager get syncJobs =>
      $$SyncJobsTableTableManager(_db, _db.syncJobs);
}

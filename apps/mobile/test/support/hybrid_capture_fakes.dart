import 'dart:async';
import 'dart:typed_data';

import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/ml_service.dart';
import 'package:quill_grade/core/services/diameter_service.dart';
import 'package:quill_grade/core/ml/diameter_config.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';

class MemoryPhotos extends CapturePhotoStorage {
  final saved = <String>{};
  final deleted = <String>[];
  int writes = 0;
  @override
  Future<String> save(Uint8List bytes, String prefix) async {
    final path = '$prefix-${++writes}.jpg';
    saved.add(path);
    return path;
  }

  @override
  Future<void> delete(String path) async {
    deleted.add(path);
    saved.remove(path);
  }
}

class TestAuth implements AuthService {
  @override
  AppUser get currentUser => AppUser(uid: 'test-user');
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

MLGradeResult testGrade({double diameterMm = 6.8}) => MLGradeResult(
  predictedGrade: 'ALBA',
  modelProbability: 0.9,
  diameterMm: diameterMm,
  modelVersion: 'hybrid_v2',
  probabilities: const {'ALBA': 0.9},
);

class TestAnalysis extends MLService {
  int calls = 0;
  double? lastDiameterMm;
  Object? error;
  Completer<MLGradeResult>? pending;
  @override
  Future<MLGradeResult> analyzeSample({
    required String sideImage,
    required String endImage,
    required double diameterMm,
  }) async {
    calls++;
    lastDiameterMm = diameterMm;
    if (error != null) throw error!;
    return pending != null
        ? pending!.future
        : testGrade(diameterMm: diameterMm);
  }
}

class TestDiameter extends DiameterService {
  int calls = 0;
  String? endImage;
  Object? error;
  Completer<DiameterEstimate>? pending;
  @override
  Future<DiameterEstimate> estimate(String endImage) async {
    calls++;
    this.endImage = endImage;
    if (error != null) throw error!;
    return pending != null
        ? pending!.future
        : const DiameterEstimate(diameterMm: 9.25, modelVersion: 'diameter_v1');
  }
}

import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import '../../core/database/repositories/sample_repository.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/cinnamon_validator_service.dart';
import '../../core/services/ml_service.dart';
import '../../core/ml/hybrid_config.dart';
import '../../core/ml/diameter_config.dart';
import '../../core/services/diameter_service.dart';
import '../../core/services/image_only_service.dart';
import '../../core/ml/image_only_config.dart';

enum CaptureStatus {
  idle,
  capturing,
  validating,
  awaitingMeasurement,
  awaitingImageOnlyPrediction,
  estimatingDiameter,
  grading,
  reviewPrediction,
  committing,
  success,
  invalid,
  uncertain,
  modelError,
  error,
}

enum ScanStep { sideView, endView }

enum GradingMode { imageOnly, hybrid }

extension GradingModeLabel on GradingMode {
  String get label => switch (this) {
    GradingMode.imageOnly => '4-Class Image-Only',
    GradingMode.hybrid => '7-Class Hybrid',
  };
}

@immutable
class CaptureValidationState {
  final CaptureStatus status;
  final ScanStep currentStep;
  final String? sidePhotoPath;
  final String? endPhotoPath;
  final String? sampleId;
  final CinnamonValidationResult? validationResult;
  final String? errorMessage;
  final MLGradeResult? gradeResult;
  final DiameterEstimate? diameterEstimate;
  final DiameterSource diameterSource;
  final GradingMode gradingMode;
  final ImageOnlyGradeResult? imageOnlyResult;

  const CaptureValidationState({
    this.status = CaptureStatus.idle,
    this.currentStep = ScanStep.sideView,
    this.sidePhotoPath,
    this.endPhotoPath,
    this.sampleId,
    this.validationResult,
    this.errorMessage,
    this.gradeResult,
    this.diameterEstimate,
    this.diameterSource = DiameterSource.aiEstimated,
    this.gradingMode = GradingMode.hybrid,
    this.imageOnlyResult,
  });

  bool get isProcessing =>
      status == CaptureStatus.capturing ||
      status == CaptureStatus.validating ||
      status == CaptureStatus.committing ||
      status == CaptureStatus.estimatingDiameter ||
      status == CaptureStatus.grading;

  bool get canSelectGradingMode =>
      status == CaptureStatus.idle &&
      currentStep == ScanStep.sideView &&
      sidePhotoPath == null &&
      endPhotoPath == null;

  CaptureValidationState copyWith({
    CaptureStatus? status,
    ScanStep? currentStep,
    String? sidePhotoPath,
    String? endPhotoPath,
    String? sampleId,
    CinnamonValidationResult? validationResult,
    String? errorMessage,
    bool clearValidation = false,
    MLGradeResult? gradeResult,
    bool clearGrade = false,
    DiameterEstimate? diameterEstimate,
    bool clearEstimate = false,
    DiameterSource? diameterSource,
    ImageOnlyGradeResult? imageOnlyResult,
  }) => CaptureValidationState(
    status: status ?? this.status,
    currentStep: currentStep ?? this.currentStep,
    sidePhotoPath: sidePhotoPath ?? this.sidePhotoPath,
    endPhotoPath: endPhotoPath ?? this.endPhotoPath,
    sampleId: sampleId ?? this.sampleId,
    gradeResult: clearGrade ? null : gradeResult ?? this.gradeResult,
    diameterEstimate: clearEstimate
        ? null
        : diameterEstimate ?? this.diameterEstimate,
    diameterSource: diameterSource ?? this.diameterSource,
    gradingMode: gradingMode,
    imageOnlyResult: clearGrade
        ? null
        : imageOnlyResult ?? this.imageOnlyResult,
    validationResult: clearValidation
        ? null
        : validationResult ?? this.validationResult,
    errorMessage: clearValidation ? null : errorMessage ?? this.errorMessage,
  );
}

/// Injectable camera boundary. Production never substitutes simulated images.
final capturePhotoProvider =
    Provider<Future<XFile> Function(CameraController?)>((ref) {
      return (camera) async {
        if (camera == null || !camera.value.isInitialized) {
          throw StateError(
            'Camera is unavailable. Please reopen the camera and retry.',
          );
        }
        return camera.takePicture();
      };
    });

final capturePhotoStorageProvider = Provider<CapturePhotoStorage>(
  (ref) => CapturePhotoStorage(),
);

class CapturePhotoStorage {
  Future<String> save(Uint8List bytes, String prefix) async {
    final directory = Directory(
      p.join((await getApplicationDocumentsDirectory()).path, 'quills'),
    );
    await directory.create(recursive: true);
    final file = File(
      p.join(
        directory.path,
        '${prefix}_${DateTime.now().microsecondsSinceEpoch}.jpg',
      ),
    );
    try {
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    } catch (_) {
      await delete(file.path);
      rethrow;
    }
  }

  Future<void> delete(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) await file.delete();
    } catch (e) {
      debugPrint('[CaptureController] Temporary photo cleanup failed: $e');
    }
  }
}

final captureValidationControllerProvider =
    NotifierProvider.autoDispose<
      CaptureValidationController,
      CaptureValidationState
    >(CaptureValidationController.new);

class CaptureValidationController extends Notifier<CaptureValidationState> {
  late CapturePhotoStorage _storage;
  final Set<String> _ownedPhotos = {};
  Uint8List? _retryBytes;
  int _generation = 0;
  bool _disposed = false;
  bool _busy = false;

  @override
  CaptureValidationState build() {
    _storage = ref.read(capturePhotoStorageProvider);
    ref.onDispose(() {
      _disposed = true;
      _generation++;
      _retryBytes = null;
      // A commit already in flight owns its files until it either rolls back
      // or succeeds. Do not delete a committed sample's side photo on exit.
      if (!_busy) _discardOwnedPhotos();
    });
    return const CaptureValidationState();
  }

  bool _active(int generation) => !_disposed && generation == _generation;

  bool selectGradingMode(GradingMode mode) {
    if (_disposed || _busy || !state.canSelectGradingMode) return false;
    state = CaptureValidationState(gradingMode: mode);
    return true;
  }

  Future<bool> processCapture(CameraController? cameraController) async {
    if (_busy || state.status != CaptureStatus.idle) return false;
    return _process(() async {
      final photo = await ref.read(capturePhotoProvider)(cameraController);
      try {
        return await photo.readAsBytes();
      } finally {
        await _storage.delete(photo.path);
      }
    });
  }

  /// Retry the exact failed image without taking another camera photo.
  Future<bool> retryValidation() async {
    if (_busy ||
        state.status != CaptureStatus.modelError ||
        _retryBytes == null) {
      return false;
    }
    final bytes = _retryBytes!;
    return _process(() async => bytes);
  }

  Future<bool> _process(Future<Uint8List> Function() readPhoto) async {
    _busy = true;
    final generation = ++_generation;
    final step = state.currentStep;
    String? newPath;
    var startGradingFlow = false;
    state = state.copyWith(
      status: CaptureStatus.capturing,
      clearValidation: true,
    );
    try {
      final bytes = await readPhoto();
      if (!_active(generation)) return false;
      state = state.copyWith(status: CaptureStatus.validating);
      CinnamonValidationResult result;
      try {
        result = await ref
            .read(cinnamonValidatorServiceProvider)
            .classify(bytes);
      } catch (e) {
        // Fail closed even when a platform/plugin implementation throws.
        debugPrint('[CaptureController] Validation failed: $e');
        result = const CinnamonValidationResult.modelError();
      }
      if (!_active(generation)) return false;
      if (!result.accepted) {
        _retryBytes = result.status == CinnamonValidationStatus.modelError
            ? bytes
            : null;
        final status = switch (result.status) {
          CinnamonValidationStatus.invalid => CaptureStatus.invalid,
          CinnamonValidationStatus.uncertain => CaptureStatus.uncertain,
          CinnamonValidationStatus.modelError => CaptureStatus.modelError,
          CinnamonValidationStatus.valid => throw StateError(
            'Inconsistent validation result.',
          ),
        };
        state = state.copyWith(
          status: status,
          validationResult: result,
          errorMessage: result.rejectionReason,
        );
        return false;
      }
      _retryBytes = null;
      newPath = await _storage.save(
        bytes,
        step == ScanStep.sideView ? 'quill_side' : 'quill_end',
      );
      if (!_active(generation)) return false;
      if (step == ScanStep.sideView) {
        _ownedPhotos.add(newPath);
        state = CaptureValidationState(
          gradingMode: state.gradingMode,
          currentStep: ScanStep.endView,
          sidePhotoPath: newPath,
          validationResult: result,
        );
        newPath = null;
        return true;
      }

      final sidePath = state.sidePhotoPath;
      if (sidePath == null || !_ownedPhotos.contains(sidePath)) {
        throw StateError('A validated side photo is required.');
      }
      _ownedPhotos.add(newPath);
      state = state.copyWith(
        status: state.gradingMode == GradingMode.imageOnly
            ? CaptureStatus.awaitingImageOnlyPrediction
            : CaptureStatus.awaitingMeasurement,
        endPhotoPath: newPath,
        validationResult: result,
      );
      newPath = null;
      startGradingFlow = true;
      return true;
    } catch (e) {
      if (_active(generation)) {
        state = state.copyWith(
          status: CaptureStatus.error,
          clearValidation: true,
        );
        state = state.copyWith(errorMessage: e.toString());
      }
      return false;
    } finally {
      if (newPath != null) await _storage.delete(newPath);
      _busy = false;
      if (_disposed) {
        _discardOwnedPhotos();
      } else if (startGradingFlow && _active(generation)) {
        // Start exactly once after a validated end photo is owned and capture
        // releases its lock. The selected review dialog shows progress/cancel.
        if (state.gradingMode == GradingMode.imageOnly) {
          unawaited(gradeImageOnly());
        } else {
          unawaited(estimateDiameter());
        }
      }
    }
  }

  /// Both owned paths can only be set by successful cinnamon validation.
  bool get _hasValidatedPair =>
      state.sidePhotoPath != null &&
      state.endPhotoPath != null &&
      _ownedPhotos.contains(state.sidePhotoPath) &&
      _ownedPhotos.contains(state.endPhotoPath);

  Future<bool> estimateDiameter() async {
    if (_busy ||
        state.gradingMode != GradingMode.hybrid ||
        !_hasValidatedPair ||
        (state.status != CaptureStatus.awaitingMeasurement &&
            state.status != CaptureStatus.reviewPrediction)) {
      return false;
    }
    _busy = true;
    final generation = ++_generation;
    state = state.copyWith(
      status: CaptureStatus.estimatingDiameter,
      clearGrade: true,
      clearEstimate: true,
      clearValidation: true,
      diameterSource: DiameterSource.aiEstimated,
    );
    try {
      final estimate = await ref
          .read(diameterServiceProvider)
          .estimate(state.endPhotoPath!);
      if (!_active(generation)) return false;
      if (HybridConfig.diameterError(estimate.diameterMm) != null ||
          estimate.modelVersion != 'diameter_v1') {
        throw const DiameterException(
          'Diameter model returned an invalid estimate. Please use a caliper.',
        );
      }
      state = state.copyWith(
        status: CaptureStatus.awaitingMeasurement,
        diameterEstimate: estimate,
      );
      return true;
    } catch (e) {
      if (_active(generation)) {
        state = state.copyWith(
          status: CaptureStatus.awaitingMeasurement,
          errorMessage: e is DiameterException
              ? e.message
              : 'Diameter estimation failed. Please retry or use a caliper.',
        );
      }
      return false;
    } finally {
      _busy = false;
      if (_disposed) _discardOwnedPhotos();
    }
  }

  Future<bool> gradeWithDiameter(
    double diameterMm, {
    DiameterSource source = DiameterSource.caliperMeasured,
  }) async {
    if (_busy ||
        state.gradingMode != GradingMode.hybrid ||
        !_hasValidatedPair ||
        (state.status != CaptureStatus.awaitingMeasurement &&
            state.status != CaptureStatus.reviewPrediction)) {
      return false;
    }
    final error =
        HybridConfig.diameterError(diameterMm) ??
        (source == DiameterSource.aiEstimated &&
                (state.diameterEstimate == null ||
                    state.diameterEstimate!.diameterMm != diameterMm)
            ? 'Please obtain and select an experimental estimate first.'
            : null);
    if (error != null) {
      state = state.copyWith(
        status: CaptureStatus.awaitingMeasurement,
        clearGrade: true,
        errorMessage: error,
      );
      return false;
    }
    _busy = true;
    final generation = ++_generation;
    state = state.copyWith(
      status: CaptureStatus.grading,
      diameterSource: source,
      clearGrade: true,
      clearValidation: true,
    );
    try {
      final result = await ref
          .read(mlServiceProvider)
          .analyzeSample(
            sideImage: state.sidePhotoPath!,
            endImage: state.endPhotoPath!,
            diameterMm: diameterMm,
          );
      if (!_active(generation)) return false;
      if (result.diameterMm != diameterMm) {
        throw const HybridException(
          'Grading returned a different diameter. Please retry.',
        );
      }
      state = state.copyWith(
        status: CaptureStatus.reviewPrediction,
        gradeResult: result,
      );
      return true;
    } catch (e) {
      if (_active(generation)) {
        state = state.copyWith(
          status: CaptureStatus.awaitingMeasurement,
          clearGrade: true,
          errorMessage: e is HybridException
              ? e.message
              : 'Hybrid grading failed. Please retry or retake the photos.',
        );
      }
      return false;
    } finally {
      _busy = false;
      if (_disposed) _discardOwnedPhotos();
    }
  }

  void changeDiameter() {
    if (_busy ||
        state.gradingMode != GradingMode.hybrid ||
        !_hasValidatedPair) {
      return;
    }
    state = state.copyWith(
      status: CaptureStatus.awaitingMeasurement,
      clearGrade: true,
      clearValidation: true,
    );
  }

  Future<bool> gradeImageOnly() async {
    if (_busy ||
        state.gradingMode != GradingMode.imageOnly ||
        !_hasValidatedPair ||
        (state.status != CaptureStatus.awaitingImageOnlyPrediction &&
            state.status != CaptureStatus.reviewPrediction)) {
      return false;
    }
    _busy = true;
    final generation = ++_generation;
    state = state.copyWith(
      status: CaptureStatus.grading,
      clearGrade: true,
      clearValidation: true,
    );
    try {
      final result = await ref
          .read(imageOnlyServiceProvider)
          .analyzeSample(
            sideImage: state.sidePhotoPath!,
            endImage: state.endPhotoPath!,
          );
      if (!_active(generation)) return false;
      state = state.copyWith(
        status: CaptureStatus.reviewPrediction,
        imageOnlyResult: result,
      );
      return true;
    } catch (e) {
      if (_active(generation)) {
        state = state.copyWith(
          status: CaptureStatus.awaitingImageOnlyPrediction,
          clearGrade: true,
          errorMessage: e is ImageOnlyException
              ? e.message
              : '4-Class prediction failed. Please retry or retake the photos.',
        );
      }
      return false;
    } finally {
      _busy = false;
      if (_disposed) _discardOwnedPhotos();
    }
  }

  Future<bool> confirmPrediction() async {
    if (_busy ||
        state.status != CaptureStatus.reviewPrediction ||
        (state.gradingMode == GradingMode.imageOnly
            ? state.imageOnlyResult == null
            : state.gradeResult == null) ||
        !_hasValidatedPair) {
      return false;
    }
    _busy = true;
    final generation = ++_generation;
    final side = state.sidePhotoPath!;
    final end = state.endPhotoPath!;
    final result = state.gradeResult;
    final imageOnlyResult = state.imageOnlyResult;
    final mode = state.gradingMode;
    state = state.copyWith(
      status: CaptureStatus.committing,
      clearValidation: true,
    );
    try {
      final userId =
          ref.read(authServiceProvider).currentUser?.uid ?? 'inspector-1';
      final repository = ref.read(sampleRepositoryProvider);
      final sampleId = mode == GradingMode.imageOnly
          ? await repository.createImageOnlySample(
              userId,
              imageOnlyResult!,
              sidePhotoLocalPath: side,
              endPhotoLocalPath: end,
              isCurrent: () => _active(generation),
            )
          : await repository.createHybridSample(
              userId,
              result!,
              sidePhotoLocalPath: side,
              endPhotoLocalPath: end,
              isCurrent: () => _active(generation),
              diameterSource: state.diameterSource,
              diameterEstimate: state.diameterEstimate,
            );
      _ownedPhotos.removeAll([side, end]);
      if (!_active(generation)) return false;
      state = state.copyWith(status: CaptureStatus.success, sampleId: sampleId);
      return true;
    } catch (_) {
      if (_active(generation)) {
        state = state.copyWith(
          status: CaptureStatus.reviewPrediction,
          errorMessage:
              'Could not save the prediction offline. Please retry saving.',
        );
      }
      return false;
    } finally {
      _busy = false;
      if (_disposed) _discardOwnedPhotos();
    }
  }

  void retakeEndPhoto() {
    if (_busy || !_hasValidatedPair) return;
    final end = state.endPhotoPath!;
    _ownedPhotos.remove(end);
    unawaited(_storage.delete(end));
    state = CaptureValidationState(
      gradingMode: state.gradingMode,
      currentStep: ScanStep.endView,
      sidePhotoPath: state.sidePhotoPath,
    );
  }

  void _discardOwnedPhotos() {
    for (final path in _ownedPhotos) {
      unawaited(_storage.delete(path));
    }
    _ownedPhotos.clear();
  }

  void retakeSidePhoto() => resetAll();

  /// Retake the current step while retaining a previously validated side photo.
  void resetToReady() {
    if (state.status == CaptureStatus.committing || _hasValidatedPair) return;
    _generation++;
    _retryBytes = null;
    state = state.copyWith(status: CaptureStatus.idle, clearValidation: true);
  }

  void resetAll() {
    if (state.status == CaptureStatus.committing) return;
    _generation++;
    _retryBytes = null;
    _discardOwnedPhotos();
    state = CaptureValidationState(gradingMode: state.gradingMode);
  }
}

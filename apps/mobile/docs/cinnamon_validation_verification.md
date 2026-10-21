# Cinnamon validation implementation and verification

Implemented in apps/mobile on 2026-10-17.

## Behavior

Only completed TFLite inference can authorize a capture. Removed CaptureValidationController's QuillValidatorService import, both heuristic fallback calls (including forced simulated specimen acceptance), and the QuillValidationResult bridge. The heuristic service files remain intact for diagnostics and have no callers in the production capture path.

CinnamonValidationStatus exposes valid, invalid, uncertain, and modelError (VALID, INVALID, UNCERTAIN, MODEL_ERROR). Only a unique top valid_cinnamon score at or above the configured cutoff is accepted. High-scoring hands and other objects are invalid. Low scores and ties are uncertain. Loading, asset, tensor, preprocessing, inference, and malformed-output failures cannot produce VALID.

The existing camera screen, navigation, AlertDialog, and green/cream styling are reused. Model errors display the requested message and Retry Validation / Retake Photo / Cancel actions. Retry uses the same bytes. Retake clears the failed photo but retains a validated side photo. Cancel invalidates pending asynchronous work and cleans temporary photos. Shutter taps are guarded in the UI and controller. Camera absence no longer fabricates bytes or exposes an accepting specimen selector.

No SQLite sample exists until both photos pass and analysis finishes. The existing repository gains one transactional create-and-save method, with cancellation checks; database tables and schema are unchanged. Invalid, uncertain, and model-error captures neither create rows nor sync jobs. Firebase synchronization and grading/measurement implementations are unchanged.

## Model inspection

The binary and label file were not changed. The actual bundled FlatBuffer is 2,090,732 bytes, SHA-256 cfe752fece71760140af7d898be7315fa6ae42da98d57b72c38f493231e138ab. It has float32 [1,224,224,3] input, float32 [1,3] output, and a final SOFTMAX. The supplied labels map indices 0/1/2 to valid_cinnamon / cinnamon_with_hand / other_objects.

Preprocessing now center-crops, resizes, and uses RGB /127.5 -1, matching the documented Teachable Machine origin and Google's converter. The binary lacks normalization and class-name metadata: model/label provenance and training preprocessing still need comparison against the original export or golden predictions. See assets/models/README.md for the primary source and full model contract.

The default 0.80 threshold remains configurable, with runtime validation of the configured value. Scores are not presented as calibrated certainty.

## Verification executed

- flutter pub get: passed. Added SDK integration_test and a direct dev dependency on the already resolved camera_platform_interface for fake-camera widget tests.
- dart format: completed for every changed Dart file.
- flutter test test/cinnamon_validator_service_test.dart test/capture_validation_integration_test.dart test/sample_repository_test.dart: 37 passed at the initial checkpoint.
- Final flutter test: 45 passed, including all existing tests.
- Final flutter analyze: no errors or warnings; exit 1 due to 11 informational notices in untouched files:
  - app_database.dart: one super-parameter suggestion.
  - connection_web.dart: one print lint.
  - sync_manager.dart: one unnecessary import and one deprecated API.
  - sign_in_screen.dart: three deprecated withOpacity uses.
  - sign_up_screen.dart: four deprecated withOpacity uses.
- python tool/inspect_validator.py: passed; actual model tensor/operator inspection.
- flutter devices: only Windows, Chrome, and Edge; no connected Android/iOS hardware.

Unit/service tests use fake native model outputs and real image preprocessing. Controller integration tests use a fake camera/validator and a real in-memory Drift database. Widget tests exercise the real ScanScreen with a fake camera platform and real router. They cover valid/invalid/uncertain/model-error outcomes, cutoff boundaries/configuration, malformed assets/tensors/output, missing/loading/inference errors, no heuristic access, duplicate taps, persistence prevention, retry/retake/cancel, late results, transaction rollback, and bundled asset loading.

The separately supplied integration_test/cinnamon_validator_device_test.dart uses the real native interpreter. It was NOT run because no mobile device is connected. It must not be counted among the 45 passing host tests.

## Remaining physical-device checks

Run with an attached Android/iOS device in airplane mode:

    flutter test integration_test/cinnamon_validator_device_test.dart -d <device-id>

This verifies installed asset loading and repeatable offline runtime execution, not model accuracy. Then test labelled photos of all three classes in both side/end views, blur, lighting, rotation, hands, and unrelated objects. Compare the original export's reference predictions and calibrate the acceptance cutoff based on false accepts. Verify rapid taps, back/cancel during capture, model-error recovery, and offline accepted samples syncing after reconnect.

## Exact authored/configuration files changed or added

Paths below are relative to apps/mobile:

1. lib/core/services/cinnamon_validator_service.dart
2. lib/core/ml/model_config.dart
3. lib/core/ml/image_preprocessor.dart
4. lib/features/scan/capture_validation_controller.dart
5. lib/features/scan/scan_screen.dart
6. lib/features/scan/validation_dialog.dart (new)
7. lib/core/database/repositories/sample_repository.dart
8. test/cinnamon_validator_service_test.dart
9. test/capture_validation_integration_test.dart
10. test/scan_screen_validation_test.dart (new)
11. test/support/validation_fakes.dart (new)
12. integration_test/cinnamon_validator_device_test.dart (new)
13. tool/inspect_validator.py (new)
14. assets/models/README.md
15. pubspec.yaml
16. pubspec.lock
17. docs/cinnamon_validation_verification.md (this report, new)

Flutter also regenerated ignored package/build metadata and the ignored Android/iOS plugin registrants to register integration_test:
- android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java
- ios/Runner/GeneratedPluginRegistrant.m
- .flutter-plugins-dependencies and .dart_tool/build outputs

No Git repository is present in this workspace, so a git diff/status was unavailable.

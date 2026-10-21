# Experimental diameter V1 integration

Implemented in the existing `apps/mobile/` application on 2026-10-18. This extends Hybrid V2; it does not establish physical measurement accuracy or validate the full automated grading pipeline on held-out examples.

## Model and configuration inspection

Both supplied assets exist and were inspected without changing their bytes. The existing `assets/models/` declaration includes them automatically; no dependency additions or upgrades were necessary.

| Item | Verified value |
| --- | --- |
| Model | `assets/models/quillgrade_diameter_v1.tflite` |
| Model bytes | 3,913,172 |
| Model SHA-256 | `fc0b5b954628da071423ac39b00d2a847643e2ef771d4c26c65bb964eb8410d5` |
| Configuration | `assets/models/diameter_config_v1.json` |
| Config SHA-256 | `8f8da59add24afd452e46d747da3251f90cb49ad2f4e62aefb6c7b06953f1193` |
| Input list slot / graph tensor ID | 0 / 0 |
| Input | `serving_default_end_image:0`, float32 `[1,224,224,3]` |
| Output list slot / graph tensor ID | 0 / 220 |
| Output | `StatefulPartitionedCall_1:0`, float32 `[1,1]` |
| Target mean / standard deviation | 14.438356399536133 / 6.741237163543701, loaded from JSON |
| Version / output / unit | `diameter_v1` / `normalized_diameter` / `mm` |

Static inspection command, from `apps/mobile/`:

```powershell
python tool/inspect_validator.py assets/models/quillgrade_diameter_v1.tflite
```

The graph includes scaling by approximately 1/127.5 and adding -1. The app supplies RGB float32 pixels in the 0–255 range with no extra normalization. Runtime tensor count, names, shapes and types are checked before invocation. Native interpreter/options are created, invoked and released in a worker isolate with two CPU threads, using the existing `tflite_flutter` dependency.

`DiameterService` reuses `HybridImagePreprocessor`: EXIF transpose, RGB conversion, aspect-preserving bilinear resizing to 224×224 with centered white padding. The existing 21 Pillow-generated cases cover portrait/landscape, alpha removal, scaling, and JPEG/PNG orientations. The Pillow-version and JPEG-decoder limitations in the [Hybrid report](hybrid_v2_integration.md#preprocessing-verification-and-limits) still apply.

Conversion is explicitly:

```text
normalized regression output
  -> output * diameter_config.target_std + diameter_config.target_mean
  -> selected diameter in millimeters
  -> (mm - hybrid_config.diameter_mean) / hybrid_config.diameter_std
  -> Hybrid V2 probabilities
```

A negative normalized regression output can represent a valid below-mean diameter and is not itself rejected. NaN/infinite outputs, incorrect output lengths, and nonpositive/nonfinite or float32-overflowing millimeter results are rejected. No unverified physical minimum/maximum was invented: the supplied JSON contains no validated operating range. A finite positive estimate can still be physically inaccurate.

## Existing camera and dialog behavior

Both photos still require a confirmed VALID result from the fail-closed cinnamon model. Diameter inference cannot authorize cinnamon acceptance. Invalid/uncertain/model-error handling is unchanged.

After successful end-view validation, the capture controller immediately starts diameter inference exactly once. The existing green-and-cream AlertDialog opens during estimation and displays progress. AI estimation is the default path; the caliper field is initially hidden. A successful estimate is labelled `Experimental Estimate`; it does not automatically run grading or save a sample.

- `Use AI Estimate` directly runs Hybrid V2 with the full-precision denormalized millimeter value; no caliper field is validated or required on this path. Hybrid V2 continues applying its own separate JSON normalization.
- `Enter Caliper Measurement Instead` explicitly switches to optional manual input, where `Predict Grade` validates the entered value. `Return to AI Estimate` restores the AI path. Editing or switching the selected input invalidates any previous grade and requires a fresh prediction.
- `Retry Diameter Estimate` recomputes the estimate and invalidates any old grade. A failed automatic attempt shows an error, keeps AI mode selected, and disables `Use AI Estimate` until a valid estimate exists. Manual entry remains an explicit optional action.
- `Retake End Photo` keeps the validated side photo and discards the end photo, estimate and grade.
- `Cancel` or navigation back clears temporary state; late results are ignored. In-flight native work finishes in its isolate and releases resources; cancellation is logical, not a forced native-thread termination.
- Repeated capture, diameter inference, grading and confirmation taps are guarded. Only explicit `Confirm & Save` after successful grading creates a database record.

The default-flow correction also updates `scan_screen.dart` to open the dialog for both `estimatingDiameter` and `awaitingMeasurement`. It prevents the old side-view-success branch from being used while end-view estimation is in progress. A successful end-view validation retry triggers the same automatic path. Retaking the end photo triggers a new estimate after that replacement photo passes validation. Router guards were inspected: they only enforce authentication/onboarding, with no caliper-specific route or guard. The grade/diameter preview remains in the dialog before confirmation; `/result/:id` displays the confirmed stored result.

The result screen displays the persisted source, labelling AI results as an experimental estimate without a physical scale reference. It never calls an AI estimate a calibrated measurement. The dialog displays the supplied small-sample MAE and warns about distance, angle, lighting and phone hardware. Softmax values remain model probabilities, not certified correctness.

## Offline storage and Firebase compatibility

Drift version 3 adds four nullable columns, preserving existing rows and jobs:

| Column | Meaning |
| --- | --- |
| `diameter_source` | `ai_estimated` or `caliper_measured` for new confirmed samples |
| `diameter_model_version` | `diameter_v1` when an estimate was obtained |
| `estimated_diameter_mm` | Successful experimental estimate, including when overridden manually |
| `measured_diameter_mm` | Actual caliper input when selected; null for AI-only results |

The existing `diameter_mm` is the final selected input to Hybrid V2. `model_version` remains the grade model version (`hybrid_v2`). `measurement_method` is `experimental_image_regression` or the existing `digital_caliper_manual`. New records remain `needs_review=true`, `is_synced=false`.

Historical metadata remains null rather than inventing values. Version-2 caliper records retain their old method/value and display as caliper measurements. The tests upgrade both real version-1 and version-2 SQLite schemas and preserve existing dimensions, prediction fields, sync state, revisions, and queued jobs.

The existing Firestore payload adds the four nullable metadata values and retains the previous fields. No network is needed for model inference or confirmation/storage. No Firebase account writes or live sync were tested. Existing sync scheduling is preserved, including the pre-existing Workmanager background callback placeholder documented in the Hybrid report.

## Automated verification

- `flutter pub get`: passed; no dependency version upgrades were made.
- `dart run build_runner build`: passed; regenerated Drift bindings.
- `dart format`: completed on changed Dart files.
- `flutter analyze`: passed, no issues.
- `flutter test`: 119 passed after the default-AI workflow correction, including all existing cinnamon validation, Hybrid V2 and Pillow preprocessing regressions.
- `flutter build apk --release --target-platform android-arm64`: passed with the default-AI workflow (exit 0). Output: `build/app/outputs/flutter-apk/app-release.apk`, 56,499,144 bytes (53.9 MiB).
- The rebuilt APK's three TFLite models and both grading/diameter JSON configurations match their source bytes. These assets were not edited for the default-flow correction.
- Focused diameter service tests: 12 passed again after extending the malformed-configuration assertion.
- `flutter devices`: Windows, Chrome and Edge only; no Android device attached.

The build reports existing Java native-access and Firebase/Workmanager Kotlin Gradle Plugin compatibility warnings, but exits successfully. No signing or plugin-version changes were made. The APK uses the project's existing debug signing configuration and is a testing artifact, not a production-signed release.

Host unit tests use a fake native runner and check assets/configuration, denormalization, the mm-to-Hybrid chain, tensor contract rejection, invalid numeric output, missing/corrupt model/configuration, failed-load retry, image-load errors, inference exceptions, duplicate work and disposal.

Controller/widget tests cover validated-photo gating, explicit AI selection, manual override, retry, cancellation with a late estimate, duplicate taps, end retake, result-source display, no persistence before confirmation, SQLite metadata and sync payload mapping. They do not execute native TFLite.

Default-flow regressions additionally verify automatic inference without an estimate-button tap, no caliper form on the AI path, the millimeter argument received by grading, errors without silent manual selection, explicit manual fallback, automatic re-estimation after end retake, exactly one estimate after end-view validation retry, and system-back cancellation during automatic estimation.

`integration_test/diameter_model_device_test.dart` contains separate real-native smoke tests for model initialization/tensor validation, preprocessing, deterministic repeatability, the diameter-to-Hybrid chain, corrupt models and invalid image bytes. It uses the existing background image only as a runtime fixture, not a labelled accuracy sample. These tests have not been executed on Android.

## Physical Android checks still required

Install on a physical arm64 device, enable airplane mode, then run the native tests:

```powershell
flutter test integration_test/diameter_model_device_test.dart -d <android-device-id>
flutter test integration_test/hybrid_model_device_test.dart -d <android-device-id>
flutter test integration_test/cinnamon_validator_device_test.dart -d <android-device-id>
```

Also exercise real camera orientation, lighting/distances, cancellation/back navigation during both models, rapid taps, app background/resume, retake cleanup, memory/latency/thermal behavior, manual override, confirmation offline, restart with saved samples, upgrade of an installed v2 database, and existing Firebase sync after connectivity returns. The project's existing release build uses debug signing; configure a release key separately before distribution.

## Numerical verification still required

The supplied evaluation numbers are user-reported, not reproduced here: diameter test MAE 2.159 mm, RMSE 2.999 mm, baseline MAE 5.638 mm, only 16 held-out samples. No scale reference was present during training. These do not establish reliability across phones, camera geometry or lighting, and no production/certified accuracy is claimed.

Before declaring the full automated flow validated:

1. Export the original held-out side/end images, sample IDs, actual caliper values and expert grades, with the exact Colab Pillow/TensorFlow versions and model/config hashes. No such images/full output fixtures are available in this workspace.
2. For every same held-out example, save the raw normalized diameter output and its denormalized millimeter value. Compare native Android output to the Colab values and compare the preprocessed pixel arrays separately.
3. Run Hybrid V2 twice with identical side/end pixels: once with actual caliper mm, once with estimated mm. Apply Hybrid's own JSON normalization in each case.
4. Save all seven probabilities in ALBA, C4, C5, EXTRA, H1, H2, M4 order for both runs. Compare full vectors, not only winning labels. Establish and record platform tolerances using real fixtures, rather than assuming them from synthetic data.
5. Report per-sample diameter error, paired grade changes, probability changes, each path's grade accuracy/confusion matrix against expert labels, diameter MAE/RMSE, sample count and uncertainty. Do not treat a grade-label agreement as evidence of numerical equivalence or physical calibration.

`tool/export_hybrid_colab_fixture.py` remains available to export a real Hybrid reference for a supplied diameter. No expected vectors were invented and no paired held-out comparison has been claimed as completed.

## Files modified for this task

All paths below are relative to `apps/mobile/`:

- Added `lib/core/ml/diameter_config.dart`.
- Added `lib/core/services/diameter_service.dart`.
- Updated `lib/features/scan/capture_validation_controller.dart`.
- Updated `lib/features/scan/scan_screen.dart` for automatic inference navigation.
- Updated `lib/features/scan/hybrid_grading_dialog.dart`.
- Updated `lib/features/scan/result_screen.dart`.
- Updated `lib/core/database/tables.dart`.
- Updated `lib/core/database/app_database.dart`.
- Regenerated `lib/core/database/app_database.g.dart`.
- Updated `lib/core/database/repositories/sample_repository.dart`.
- Updated `lib/core/sync/sync_manager.dart`.
- Added `test/diameter_service_test.dart`.
- Updated `test/support/hybrid_capture_fakes.dart`.
- Updated `test/capture_validation_integration_test.dart`.
- Updated `test/hybrid_grading_flow_test.dart`.
- Updated `test/hybrid_migration_test.dart`.
- Added `integration_test/diameter_model_device_test.dart`.
- Added `docs/diameter_v1_integration.md`.
- Added a follow-up link in `docs/hybrid_v2_integration.md`.

The supplied model/configuration assets, cinnamon validator, Hybrid V2 model/service/preprocessor, route definitions, OpenCV modules and dependency declarations were not modified. Flutter/Gradle/Drift also refreshed build intermediates and generated local tool metadata.

For the subsequent default-AI correction, the files changed were `lib/features/scan/capture_validation_controller.dart`, `lib/features/scan/scan_screen.dart`, `lib/features/scan/hybrid_grading_dialog.dart`, `test/capture_validation_integration_test.dart`, `test/hybrid_grading_flow_test.dart`, `test/support/hybrid_capture_fakes.dart`, and this report. No additional database migration or sync change was needed.

# Cinnamon validation model

The capture workflow uses only CinnamonValidatorService. QuillValidatorService remains available for diagnostics, but is neither imported nor called by CaptureValidationController. No simulator selection can authorize a capture.

## Inspected bundled asset

Run `python tool/inspect_validator.py` from apps/mobile to inspect the FlatBuffer without loading native libraries.

- File: `cinnamon_validator.tflite`, 2,090,732 bytes.
- SHA-256: `cfe752fece71760140af7d898be7315fa6ae42da98d57b72c38f493231e138ab`.
- Input: `serving_default_sequential_1_input:0`, float32, `[1, 224, 224, 3]`.
- Output: `StatefulPartitionedCall:0`, float32, `[1, 3]`; final operator is SOFTMAX.
- First operators: PAD, CONV_2D, DEPTHWISE_CONV_2D, CONV_2D. There is no input normalization operation before the first convolution.
- Only `min_runtime_version` metadata is present. The binary does not embed class names or normalization metadata.
- pubspec.yaml bundles `assets/models/`. A unit test loads the actual packaged model header and labels.

The accompanying indexed label file maps:

| Output index | Label |
| --- | --- |
| 0 | valid_cinnamon |
| 1 | cinnamon_with_hand |
| 2 | other_objects |

The loader verifies indices, unique expected names, and output count; inconsistent assets fail closed. The training project's class-name provenance cannot be independently proved from this binary. Keep model and labels from the same export; confirm mapping with labelled reference images before deployment.

## Preprocessing and threshold

RGB images are center-cropped, resized to 224 x 224, and normalized with `pixel / 127.5 - 1`. This follows the documented Teachable Machine origin of the asset and [Google's export converter](https://github.com/googlecreativelab/teachablemachine-community/blob/master/snippets/converter/image/api.py). The previous /255 preprocessing did not match that convention. Because the binary lacks normalization metadata, final confirmation requires comparison with the original export or golden predictions from the training project.

The runtime accepts only the verified float32 input/output contract. Quantized, differently shaped, or label-mismatched replacements produce MODEL_ERROR until preprocessing/configuration is deliberately updated.

The 0.80 cutoff is provisional, configurable in ValidationConfig and through the CinnamonValidatorService constructor/setter, and checked in release builds. Scores are not assumed to be calibrated probabilities. Evaluate false accept rates on held-out valid cinnamon, cinnamon with hands, and unrelated objects, across both capture views, lighting, blur, backgrounds, and target devices before choosing a deployment threshold.

## Outcomes

- VALID: unique highest-scoring class is valid_cinnamon and its score meets the cutoff.
- INVALID: highest-scoring class is cinnamon_with_hand or other_objects at the cutoff or above.
- UNCERTAIN: highest score is below the cutoff or tied; request a clearer photo.
- MODEL_ERROR: model/labels unavailable, loading failure, incompatible tensors, preprocessing/inference exception, or malformed output. Never accepted.

CPU inference uses only packaged assets and requires no Firebase or network access. Retry Validation reruns the same retained bytes; Retake Photo discards those bytes; Cancel resets the scan. Neither rejected images nor partial two-photo scans create sample rows or sync jobs.

## Real device verification

```sh
flutter test integration_test/cinnamon_validator_device_test.dart -d <device-id>
```

Run on Android/iOS hardware with airplane mode enabled. The integration test uses the actual native interpreter, loads the installed assets, runs inference twice, and also checks a missing model. Its image fixture is the existing cinnamon background image: it checks runtime compatibility, not classification accuracy. Dart HTTP is blocked during the offline test; airplane mode is still needed to prove device-wide disconnection.

Separately capture representative labelled photos in both views; check orientation/cropping, acceptance policy, retakes, retry/cancel, rapid taps, and navigation during capture. Test a build with a missing/corrupt model. Verify that accepted samples remain available offline and follow the existing Firebase sync process after reconnection.

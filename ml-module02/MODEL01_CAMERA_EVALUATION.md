# Model 01: per-camera error analysis

**Date:** 22 October 2026
**Model:** `ml-module02/models/cinnamon_quality_mobilenetv2.keras` (service version `mobilenetv2-5ef47ee59f34`)
**Classes:** `Suspected Mold`, `good_quality`

## Purpose

The model's reported Colab result is 82.98% test accuracy on 47 images (validation 82.61%). This
analysis checks whether that accuracy comes from visible cinnamon condition or from other
differences between the two classes of photographs, in particular the camera used.

## Method

- **Images:** all 306 photographs in the source dataset (`Good_quality`: 129, `Suspected_Mold`: 177).
- **Camera:** read from each photograph's EXIF metadata (manufacturer field).
- **Inference:** each photograph was corrected for EXIF orientation, resized so its longest side is
  1,600 px (to stay under the service's 5 MiB upload limit), saved as JPEG and sent to the running
  inference service (`POST /classify` on port 8002). The service then resizes to 224 × 224 px, as in
  normal use.
- **Scoring:** a prediction counts as correct when it matches the folder label.

**Important:** the exact training/validation/test split used in Colab was not available, so this
set includes images the model was trained on. These figures therefore overstate real performance.
They are used here only to compare groups, not as an accuracy estimate.

## Results

| Class | Camera | Correct | Accuracy |
| --- | --- | ---: | ---: |
| Good quality | Apple iPhone | 107 / 113 | 95% |
| Good quality | No EXIF (`CIN001` images) | 16 / 16 | 100% |
| Suspected mold | Samsung Galaxy A26 | 88 / 88 | 100% |
| Suspected mold | Apple iPhone | 23 / 89 | **26%** |
| **All images** | | **234 / 306** | **76%** |

## Interpretation

- **The camera is confounded with the label.** Every Samsung photograph in the dataset is labelled
  Suspected mold, and they were taken on a different date (18 October) with a different background
  and distance from the iPhone photographs (15 October).
- **The model has largely learned this shortcut.** It labels all Samsung photographs as mould, but
  identifies only 26% of iPhone photographs of mould, even though some of those images were used in
  training.
- **The headline accuracy is therefore not evidence of mould detection.** A test set that contains
  Samsung mould photographs rewards camera recognition.

## Limitations of this analysis

- It includes training images, so all figures are optimistic.
- Camera make is used as a proxy for the whole capture setup (device, date, background, distance and
  lighting); these factors cannot be separated with the current data.
- Folder labels are visual judgements, not laboratory confirmation. A separate audit
  ([DATASET_AUDIT.md](DATASET_AUDIT.md)) also found 19 images that appear in both class folders.

## Recommended next steps

1. Photograph good and mouldy quills with the **same device, background, distance and lighting**.
2. Record a **physical sample ID** in each file name (for example `CIN002_01.jpg`) so all photographs of
   one quill stay in the same split.
3. Resolve the 19 images that appear in both class folders.
4. Retrain, evaluate once on a held-out set of **independent physical samples**, and repeat this
   per-camera check.

A camera-controlled retraining using only the iPhone photographs (run `model01_20261020-1055`, on the
`module02-image-classifier` branch) classified all 20 of its held-out test images correctly
(validation 85%). That test set is small, and the model did not generalise to the Samsung
photographs (3 / 88 detected as mould), so it is a promising direction rather than a validated result.

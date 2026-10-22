> For the existing Colab model with `["Suspected Mold", "good_quality"]` and unchanged CameraWebServer firmware, use [ESP32_CAM_INTEGRATION.md](ESP32_CAM_INTEGRATION.md). This integration requires copying the trusted model locally, not retraining. Earlier training scripts and audit notes below are retained as historical research tooling.

# Module 02 — visible-condition image baseline (MobileNetV2)

Classifies a stored-cinnamon photo into one of four **mutually exclusive** classes:
`good`, `discolored`, `physical_damage`, `suspected_surface_growth` (order fixed in `src/common.py`).
This is task (A), current visible condition, only. It does not forecast future degradation and
does not diagnose mould or food safety. "Suspected surface growth" needs expert/lab confirmation.

## Data

Use the **Module 02 defect-labelled images** (SharePoint folder). The Kaggle *cinnamon quill grades*
dataset has grade labels (a Module 03 task) and must not be mixed into these classes.

Put the images in class folders, outside git:

```
<data-dir>/good/*.jpg
<data-dir>/discolored/*.jpg
<data-dir>/physical_damage/*.jpg
<data-dir>/suspected_surface_growth/*.jpg
<data-dir>/uncertain/   # ambiguous images are skipped, never forced into a class
```

## Run

```powershell
cd ml-module02
python -m venv .venv ; .venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 1. Inventory (integrity check, sha256, duplicate warning). The regex must pull the physical
#    sample ID out of the file name; without it splits are NOT leakage-safe.
python src/build_inventory.py --data-dir D:\data\cinnamon --sample-regex "^(CIN-S\d+)_"

# 2. Group-safe 70/15/15 split by sample (or --group-by batch_id) with recorded seed
python src/make_splits.py --seed 42

# 3. Train (frozen backbone; add --fine-tune-epochs 10 after reviewing validation results)
python src/train.py --class-weight

# 4. Evaluate ONCE on the untouched test manifest
python src/evaluate.py

pytest tests
```

**Current dataset (Colab):** the `CinnaSense_Dataset` Drive folder has two classes, `Good_quality` and
`Suspected_Mold`. Train it with the self-contained
[notebooks/cinnasense_m02_image_model_colab.ipynb](notebooks/cinnasense_m02_image_model_colab.ipynb),
which maps them to `good` / `suspected_surface_growth`, groups near-duplicate photos before a group-safe
split, and saves artifacts to `MyDrive/CinnaSense_models/<model_version>/`. The scripts above assume the
full four-class layout. Outputs land in `experiments/mobilenetv2_baseline/` (`model.keras`, `class_indices.json`,
`config.json`, `history.json`, `test_report.json`, `test_errors.csv`, `confusion_matrix.png`).

## Rules this pipeline enforces

- Split by `sample_id`/`batch_id`, never by image; overlap is asserted in `make_splits`, `train`, `evaluate`.
- Raw 0-255 RGB in; `preprocess_input` runs once inside the model.
- Only flip and small rotation augmentation, active in training only; no colour jitter.
- Selection uses validation macro-F1; the test set is evaluated once.
- Reported numbers come only from `test_report.json`. Report the number of independent test samples
  next to every score; with few samples use group cross-validation rather than one split.
- Keep `data/`, `experiments/` and `.venv/` out of git.

## Next (not done here)

Baselines for E1/E3 (colour-histogram + classical classifier; random-image vs sample-wise split),
calibration plots, and a FastAPI endpoint `POST /api/v1/inference/visible-condition` that loads
`model.keras` and returns class probabilities plus `model_version`.


For the reviewed two-class image-condition pipeline, dataset conflict audit, separate inference service and dashboard integration, see [IMAGE_CONDITION_GUIDE.md](IMAGE_CONDITION_GUIDE.md). The earlier baseline scripts remain available here. No trained-model accuracy is claimed by the new pipeline.

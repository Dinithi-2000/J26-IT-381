# Local dataset audit (20 October 2026)

Read-only SHA-256 audit of the supplied Downloads folders. Source files were not modified.

| Dataset | Observed labels | Images |
|---|---|---:|
| OneDrive condition folder | Good_quality | 129 |
| OneDrive condition folder | Suspected_Mold | 177 |
| YOLO v2 | Quill only | 1040 |
| YOLO v3 | Quill only | 1076 |

The condition folder has **306 files but only 250 distinct SHA-256 hashes**. There are **54 exact-duplicate groups**, of which **19 contain conflicting class labels**. For example, `IMG_2584.jpeg` occurs with identical bytes in both condition folders. Label review must resolve each conflict; do not choose the label from the folder name automatically.

All **1040 distinct YOLO v2 images are also present byte-for-byte in v3**. Do not combine the versions as independent datasets. Both `data.yaml` files declare a single `Quill` class, so they cannot supply good/mold labels. They are reserved for a future localization/cropping experiment, not silently mixed into condition training. Changing to detector crops later requires matching training and inference preprocessing and new evaluation.

Only 14 Good_quality filenames suggest `CIN001`; the other Good_quality filenames and the Suspected_Mold filenames do not establish physical sample identity. No physical IDs have been invented. No trustworthy held-out physical-sample split can be claimed yet.

Local generated review files (ignored by Git to keep research image metadata private):

- `data/local-audit/review_manifest.csv`: all image paths, provisional labels, hashes and blank sample IDs.
- `data/local-audit/label_conflicts.csv`: conflicting duplicate rows to inspect first.
- `data/local-audit/audit.json`: exact duplicate/conflict groups.
- `data/local-audit/detection-audit.json`: overlap between YOLO versions.

Review steps: resolve conflicting labels using the real sample and annotation protocol; retain one image per exact hash in the manifest; assign the same physical sample ID to every view/capture of that specimen, including across folders or dates; verify labels and set `label_verified=true`. Remove uncertain rows from the reviewed manifest rather than inventing labels or independent IDs. Keep originals intact and save your decisions separately.

Training refuses unreviewed labels, missing physical IDs, changed files, duplicate image bytes, or splits without both classes. A minimum of three independent samples per class is only a technical minimum; many more independent samples and a separate held-out ESP32-CAM collection are needed for useful research evidence.

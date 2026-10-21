# Original Model 01 research — preserved implementations

This archive consolidates research recovered from the nested repository and
historical classifier branches. **It does not replace or participate in the
active application's imports, routing, tests or model selection.**

The active Model 01 remains `../models/cinnamon_quality_mobilenetv2.keras`, served
by `../src/cinnasense_quality` on port 8002. Model 02 and price prediction remain
in the main `ml-service` on port 8000. Use the main application, not one of the
archived application snapshots, for current development.

## What was recovered

| Folder | Files | Source and purpose |
| --- | ---: | --- |
| `nested-current-source/` | 84 | Nested checkout at `9eb5ef7`, excluding live `.env`, dependencies, build output and Git internals; includes the original notebook and identical price/Model 02 artifacts |
| `nested-standalone-stash-e8777c1/` | 91 | Complete tracked stash snapshot: original `quality-service`, `ConditionClassifier.jsx`, `conditionService.js`, image page and Vite proxy |
| `nested-standalone-index-6e246d3/` | 91 | Stash's staged snapshot, retained separately to preserve staged/unstaged distinctions |
| `nested-classifier-branch-9de8efc/` | 116 | Earlier integrated classifier, its matching model/labels/metadata, Node/React integration and ESP32-CAM uploader firmware |
| `parent-camera-classifier-d6179c3/` | 116 | Later camera-controlled model version and its matching application/preprocessing snapshot |
| `notebook-versions/` | 2 | Original notebook at `06ab859` and updated notebook at `9eb5ef7` |
| `cached-python/` | 3 | Original ignored Python caches, copied byte-for-byte; not executed or used to invent missing source |

The [convenient root notebook copy](../../CinnaSense_Image_Model_01.ipynb) is also
available at the main repository root. Both historical notebook versions remain
here so later notebook changes do not replace yesterday's version.

Every recovered source file has its destination, origin, byte size and SHA-256
recorded in [preservation-manifest.json](preservation-manifest.json). This manifest
also records all 19 checkout differences and their reconciliation decisions.
It does not contain secret values.

## Model versions are not interchangeable

See [MODEL_VERSIONS.json](MODEL_VERSIONS.json) for exact hashes and contracts.

| Version | Weight bytes | SHA-256 prefix | Label order |
| --- | ---: | --- | --- |
| Earlier integrated `model01-mobilenetv2-20261020-0219` | 9,628,687 | `a0b2b616b8f3` | `Good_quality`, `Suspected_Mold` |
| Camera-controlled `model01-mobilenetv2-20261020-1055` | 24,389,658 | `47a4cb3916a5` | `Good_quality`, `Suspected_Mold` |
| Current active Colab Model 01, outside this archive | 9,659,605 | `5ef47ee59f34` | `Suspected Mold`, `good_quality` |

The branch models retain their original filenames under each snapshot's
`ml-service/models/quality_model01/`, with `labels.json`, `model_metadata.json`
and `app/quality_classifier.py`. Historical metadata specifies image preparation,
including padding/JPEG handling; the current active service uses its own RGB
resize contract. Do not swap labels, weights or preprocessing across versions.
Historical metrics are copied research records, not newly validated claims.

The original standalone service expects
`quality-service/models/cinnamon_condition_mobilenetv2.keras`. **That exact
artifact was not found in either checkout or recovered stash.** Its source,
labels and metrics were preserved, but another weight file has not been
substituted. Its original `data/analyses.db` history was also not found.

The original notebook exports to Google Drive's `CinnaSense_Models` folder. Check
the original Colab/Drive/downloads when locating missing exports; do not retrain
or fabricate an artifact merely to fill the missing filename.

## Original interfaces preserved as research

- Standalone stash: FastAPI port 8001, `/classify`, `/esp32/upload`,
  `/esp32/capture`, `/analyses`, `/analyses/summary`, `/model/metrics`, `/health`.
  Uses SQLite history and the `/condition-api` Vite proxy. The original React
  component includes evaluation metrics/confusion matrix and analysis history.
- Integrated branch snapshots: Python `/quality/health` and
  `/quality/classify`; Node `/api/quality` routes; `ImageScreening.jsx` and
  `imageAnalysisService.js`.
- Existing firmware: each classifier branch contains
  `firmware/esp32cam/esp32cam_uploader/esp32cam_uploader.ino`, its README and
  `secrets.example.h`. These are recovered historical files, not new firmware
  development. They were not flashed or activated.

Do not launch an archived Node application with production database credentials
or reuse its default port alongside current services. Any future comparison run
needs a separate compatible environment, distinct port and isolated storage.

## Configuration, Git and safety

No nested `.git` directory or live `.env` was copied into this archive. Historical
configuration examples remain with their source snapshots. Private environments
and all Git history/stashes are preserved in the protected complete external
backups, and the original nested working files, models, branches and stashes are
retained unchanged. The final audit observed one appended remote-HEAD reflog
entry; see the root consolidation report for the preserved metadata exception.

Current main live configuration and all existing API/data contracts were retained.
The nested checkout's older placeholder UI/services were preserved here instead
of overwriting working dashboard/backend integrations. Original SQLite, older
MongoDB `ImageAnalysis` records and current image/risk collections were not merged
or migrated. No database records were changed for consolidation.

Large `.keras` files and cached `.pyc` files remain ignored by the main Git rules.
They exist locally and in verified backups. Do not assume a future Git clone alone
contains them; arrange explicit artifact backup/versioning before publishing.
No automatic staging, commit, push, stash application or stash removal occurred.

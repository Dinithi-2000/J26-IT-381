# CinnaSense AI project consolidation

The main development project remains `C:\Github Project\J26-IT-381` on
`GamageIT23481244`. The original nested repository is retained at
`C:\Github Project\J26-IT-381\J26-IT-381` and must not be deleted until separately
approved.

## Verified complete backups

Protected external backup directory:

```text
C:\Github Project\CinnaSense-backups\consolidation-20261021-085249
```

| Backup | Files | Bytes | Verification |
| --- | ---: | ---: | --- |
| `main-complete/` | 50,992 | 2,890,278,905 | Every file SHA-256 verified |
| `nested-complete/` | 286 | 61,232,143 | Every file SHA-256 verified |

The main backup also includes the nested repository as it existed inside the
main folder; the separate nested backup provides an independent complete copy.
Nothing was excluded: Git internals, refs/stashes, ignored files, environments,
dependencies, notebooks, models, caches and existing runtime backups are included.
`BACKUP_VERIFICATION.json` and the two SHA-256 manifests record the verification.
Backup access is restricted to the current Windows account, SYSTEM and administrators
because it includes private environments. Windows long-path and read-only Git
object handling were required; verification completed before project recovery.

## Copied and recovered work

- Copied the unique original `CinnaSense_Image_Model_01.ipynb` to the main root.
- Recovered **503 archival files** under
  [ml-module02/original-model01](ml-module02/original-model01/README.md).
- Preserved the nested current source tree, full stash working/index snapshots,
  both historical classifier branch snapshots, two notebook versions and three
  ignored compiled Python caches.
- Recovered the original standalone service/training source, original React
  condition classifier/service, image metrics/history interfaces, and existing
  ESP32-CAM uploader firmware.
- Preserved both historical `.keras` variants with their correct labels,
  preprocessing implementation and model metadata. Active weights were not
  overwritten or renamed.
- Added a complete per-file source/hash inventory and model registry.

## Reconciliation decisions

All **19 differing checkout paths** are listed with decisions in
[preservation-manifest.json](ml-module02/original-model01/preservation-manifest.json).
Each nonprivate nested version exists in `nested-current-source/`, preserving its
exact contents without overwriting the active main application.

| Area | Decision |
| --- | --- |
| Original standalone Model 01 | Preserve its complete stash snapshots, SQLite interfaces, React UI, metadata and caches separately; do not silently activate a different model |
| Earlier/later classifier branches | Preserve complete source/weight snapshots independently, including `/api/quality` contracts and firmware |
| Latest Model 01 service and image UI | Keep current `ml-module02/src/cinnasense_quality`, trained model, labels, image backend and dashboard unchanged |
| Model 02 | Keep current RandomForest loader/routes, authenticated Node client, retry-safe persistence and React risk workspace unchanged |
| Shared quality UI and API client | Retain functioning main backend/authentication/persistent-registration implementation; preserve nested placeholder versions for provenance |
| Price prediction and other modules | Existing matching implementations and artifacts retained; historical copies remain inside their research snapshots |
| MongoDB/environment configuration | Keep working main values, including aligned Model 02 token; do not copy nested live environments into tracked archives or replace current credentials |
| Documentation and Git ignore rules | Retain current documentation/privacy rules; add this report and root README navigation to the archive |

No Git history merge, branch switch, stash pop/drop, reset or clean was performed.
The main repository and active branch remain the development authority. Both
repositories' full Git histories and stashes remain in their protected backups
and original locations. No nested `.git` directory was imported into the archive.

## Existing files changed by consolidation

Only the root `README.md` was extended with navigation to this report/archive.
Application source, dependencies, live environments, model weights, labels,
backend routes, firmware and existing tests were not edited. Archive/source
files were created at new paths. No credentials were placed in tracked archives.

## Remaining issues

- The standalone stash expects `cinnamon_condition_mobilenetv2.keras`, which was
  not found. Its original SQLite `analyses.db` was also not found. They were not
  fabricated, replaced with other weights or represented as recovered.
- The nested training cache is not identical to compiling the stashed training
  source. Both are preserved; the cache was not executed or presented as recovered
  Python source.
- Historical model variants have different label order, image preparation and
  training records. A future model-selection decision needs an isolated comparison
  and explicit approval. Existing active-model regressions do not establish that
  all historical models are equivalent.
- Parent device-key configuration was already malformed JSON during inspection.
  It is retained unchanged. This needs a separate reviewed configuration correction
  before real device ingestion; test credentials must remain isolated.
- Historical standalone dependencies have not been installed or changed. Its
  missing model prevents claiming that standalone service is runnable as-is.
- Archived weights/caches remain ignored by Git. Verified filesystem backups
  preserve them, but a future clone alone will not necessarily contain them.

The final regression and preservation results are recorded in
`ml-module02/original-model01/verification-results.json` after verification.
No commit, push, production-data migration or firmware development is part of
this consolidation. Keep the nested repository until separate approval.

## Final verification

- **83 automated tests passed, zero skipped:** 19 frontend, 39 backend including
  real isolated MongoDB persistence, 1 real-ML end-to-end workflow, 10 Model 01
  Python and 14 Model 02/price contract tests.
- Production frontend build passed. Active Model 02, Node/Atlas and price
  prediction remained functional. Test data was restricted to a local MongoDB
  database and cleaned afterward; no test records were written to Atlas.
- Model 01 still classified the baseline photograph as `good_quality`. Its score
  after restart was `0.8355658054351807`, compared with the earlier
  `0.8355661034584045`: an absolute difference of approximately `2.98e-7`, within
  the recorded `1e-6` numerical tolerance. Weights, labels and preprocessing
  source remain byte-identical. No inference behavior was edited to force an
  exact floating-point match.
- All 503 recovered source files matched their preservation-manifest hashes;
  recovered `.keras` archives also passed internal ZIP CRC checks. No private
  environment value was found in the archive.
- Existing main source/configuration/model files are unchanged. Only the root
  README was extended; its original contents are preserved as an exact prefix.
  Main branch remains `GamageIT23481244`.
- All 286 nested files were compared against the complete backup. **Working
  files, models, branches and stashes are unchanged.** One metadata exception was
  observed: `.git/logs/refs/remotes/origin/HEAD` gained a `remote set-head` entry
  during the session (27 entries became 28). Prior entries remain intact. No
  recovery command wrote into the nested repository; this audit-log append was
  not reversed. Both pre-session and observed post-session versions are preserved
  in the protected backup. The repository was not deleted, moved, reset or merged.

Historical services were preserved rather than activated. Their exact pinned
environments were not recreated or used to downgrade current dependencies. The
missing standalone weight file remains the main blocker for running that original
service. Hardware capture was not flashed or physically verified.

The current Model 01 environment has FastAPI 0.151.0, Uvicorn 0.54.0 and
python-multipart 0.0.32; the archived standalone requirements pin 0.115.12,
0.34.0 and 0.0.20 respectively. These are compatibility differences, not evidence
that an archived service was successfully tested. No historical environment was
installed over the working services. The temporary isolated MongoDB was stopped
after cleanup; the active frontend, Node/Atlas backend and both ML services remain
available.

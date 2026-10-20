# CinnaSense AI Module 02: image-condition prototype

Research title: Smart Dehydration and Quality Preservation System for Cinnamon Processing.

This component implements **Model 01**, current visible image condition, using the user-approved two classes **Good Quality** and **Suspected Mold**. It does not implement Model 02 future degradation prediction, physical damage/discoloration classification, a cinnamon detector, or confirmation of mold. The supplied YOLO datasets have only `Quill` labels and are not silently repurposed as condition labels.

## Current status

Implemented: read-only dataset audit, reviewed-manifest validation, group-disjoint splitting, MobileNetV2 training/evaluation code, Colab notebook, artifact validation and inference service, authenticated Express image storage/proxy, and React upload/classification history UI.

**No trained artifact or measured accuracy was produced locally.** The current source labels conflict: the same image bytes appear in both classes. Physical sample IDs are missing for most images. Training intentionally refuses this input until it is reviewed. TensorFlow/FastAPI/Pillow are not installed in the local Python environment, and the audit observed approximately 70 MB free on C:. No large package installation, image copying or model download was attempted.

See [DATASET_AUDIT.md](DATASET_AUDIT.md) for counts and exact limitations. The existing checkout also has a nested `J26-IT-381/` copy; changes are in the outer workspace, not that nested repository. The integrated branch includes the Module 02 sensor/sample backend and newer Module 01 workspace. Image-condition classification uses separate routes and storage alongside them.

## 1. Review the dataset

Generated local files:

- `data/local-audit/review_manifest.csv`
- `data/local-audit/label_conflicts.csv`
- `data/local-audit/audit.json`

They are ignored by Git and point to original images through **relative paths**. The originals were not changed.

Review the 19 conflicting duplicate groups first. Resolve labels from the actual sample/annotation protocol; do not automatically choose the folder label. Keep only one row per exact image hash. Set a verified physical `sample_id` for every retained photo; every view of the same specimen, including across dates and folders, must use the same ID. Filename suggestions are not verified identities. Do not manufacture a distinct sample ID for each photograph. Mark `label_verified=true` only after inspection. Exclude uncertain images instead of inventing labels. Save as `data/reviewed_manifest.csv`.

Technical minimum: three independent specimens per class with class-covered train/validation/test subsets; this is not a claim that three is scientifically sufficient. Collect substantially more independent samples and a separate ESP32-CAM test collection. Exact hashes do not detect resized/near duplicates, so manual specimen grouping is still essential.

To generate another audit template without overwriting reviewed annotations (PowerShell, repository root):

```powershell
$env:PYTHONPATH = "$PWD\ml-module02\src"
python -m cinnasense_quality.dataset --root 'C:\Users\USER\Downloads\OneDrive_1_10-20-2026' --output ml-module02/data/new-audit
```

The provided Kaggle grade dataset and local YOLO exports are not condition-class training data. The local YOLO metadata credits [Roboflow v2](https://universe.roboflow.com/yashnick-ravindrarajah/cinnamon-quill-detection/dataset/2) and [v3](https://universe.roboflow.com/yashnick-ravindrarajah/cinnamon-quill-detection/dataset/3), license CC BY 4.0. Retain their attribution if used later for detection. The referenced [Kaggle page](https://www.kaggle.com/datasets/kaveendahelitha40/cinnamon-quill-grades-classification-image-dataset) is not treated as evidence of good/mold labels.

## 2. Train in Google Colab

Open [CinnaSense_Model01_Training.ipynb](CinnaSense_Model01_Training.ipynb) in Colab and select a GPU runtime. Upload the `ml-module02` source folder and condition photos to your own Google Drive. Upload the reviewed CSV as well. Adjust the three path variables in the first code cell, then run the cells in order. Do not upload `.env` files or secrets.

The notebook installs the optional training dependencies, validates the review manifest, splits whole physical samples, trains and evaluates, then downloads an artifact ZIP. It does not bypass the annotation gate.

Architecture: ImageNet MobileNetV2 without its original head, global average pooling, dropout and a two-class softmax head. Head training is followed by optional fine tuning of the last convolution layers while batch normalization remains frozen. Pose augmentation is deliberately mild; color-changing augmentation is avoided for this task. Training and serving both use EXIF-aware RGB conversion, bilinear 224x224 resize and embedded [-1,1] scaling consistent with [TensorFlow MobileNetV2 preprocessing](https://www.tensorflow.org/api_docs/python/tf/keras/applications/mobilenet_v2/preprocess_input). Pixel scaling is part of the saved model, so serving must not apply it twice.

Validation selects weights. Test images are used only once after that selection. Output files:

```text
artifacts/<run-name>/
??? model.keras
??? metadata.json
??? evaluation.json
??? training_history.json
??? train.csv
??? validation.csv
??? test.csv
```

`evaluation.json` contains actual held-out accuracy, per-class precision/recall/F1 and confusion matrix; nothing is hardcoded. Metadata records label order, preprocessing, trained time, model version and SHA-256. Do not repeatedly tune against the held-out test report. A softmax score is not calibrated confidence, confirmed-mold probability or future risk. Randomly splitting photographs from one specimen is not an acceptable validation substitute.

Equivalent command after installing training dependencies on a machine with adequate storage:

```powershell
python -m pip install -e './ml-module02[training]'
python -m cinnasense_quality.train --root 'PATH_TO_PHOTOS' --manifest ml-module02/data/reviewed_manifest.csv --output ml-module02/artifacts/condition-v1 --epochs 12 --fine-tune-epochs 5
```

Keep Python 3.11/3.12 in a separate environment for predictable package compatibility. ImageNet weight download and GPU training require network/compute access in the selected training environment. No claim is made that the unexecuted TensorFlow training path has been runtime-validated locally.

## 3. Start the separate image inference service

Extract the trained Colab ZIP into a new local artifact folder. Preserve metadata/evaluation files alongside `model.keras`. Only load artifacts you trained or trust. The service checks model hash, class order and input/output shapes; file hash validation is consistency checking, not a signature or proof of accuracy. It does not download a replacement model when artifacts are missing.

Use a separate terminal and a volume with enough storage. From the repository root:

```powershell
py -3.11 -m venv .venv-quality
.\.venv-quality\Scripts\Activate.ps1
python -m pip install -e './ml-module02[api]'
$env:MODULE02_IMAGE_MODEL_DIR = (Resolve-Path 'ml-module02/artifacts/condition-v1').Path
$env:MODULE02_IMAGE_SERVICE_TOKEN = Read-Host 'Inference service token (32+ random characters)'
python -m uvicorn cinnasense_quality.api:app --host 127.0.0.1 --port 8002
```

Use your actual extracted run folder in Resolve-Path. The `.env.example` documents variable names; this service takes shell environment variables and does not automatically load that file. Set the same inference token in the Express environment. Generate separate operator, per-device and service secrets, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

FastAPI endpoints:

- `GET http://127.0.0.1:8002/health`: 503 `MODEL_UNAVAILABLE` without a compatible artifact, otherwise prototype model/version/classes.
- `POST /classify`: JPEG/PNG binary bytes, at most 5 MiB, `X-Quality-Service-Token` required. Image decode, format and 20-million-pixel limits apply. Returns only a real loaded model result. No browser CORS is enabled; Express calls this service.

The existing price service remains at port 8000 and its files are unchanged.

## 4. Configure Express and use the dashboard

Add the variables from `server/.env.module02-image.example` to **your existing** `server/.env`; preserve its MongoDB, price-service and other settings:

```env
MODULE02_OPERATOR_TOKEN=YOUR_SEPARATE_RANDOM_OPERATOR_SECRET
MODULE02_DEVICE_KEYS={"ESP32-CAM-01":"YOUR_SEPARATE_RANDOM_CAMERA_SECRET"}
MODULE02_IMAGE_SERVICE_URL=http://127.0.0.1:8002
MODULE02_IMAGE_SERVICE_TOKEN=SAME_RANDOM_SERVICE_SECRET_AS_PYTHON
# Optional persistent absolute folder, default server/storage/module02-condition
MODULE02_IMAGE_UPLOAD_DIR=
```

Do not use these placeholders as real secrets. Never put MongoDB/device secrets in React environment variables. Then start MongoDB and, from the repository root:

```powershell
npm run dev
```

Visit `http://localhost:5173/module-02/images`. Turn **demo mode off**. The new **Image condition prototype** panel works alongside the Module 02 sample/sensor service. Enter your research sample ID and operator token, select an actual image and submit. Images use a separate `module02_image_condition_analyses` MongoDB collection and generated filenames on disk, not base64 documents. Existing sample/price collections are not modified. This image API validates the syntax of an associated sample ID but does not register or check it against a sample registry in this checkout. Use your actual research IDs consistently.

If the model/service is absent, the image may still be stored with `analysisStatus=model_unavailable`; no class or score is invented. Start the real service/artifact and use **Retry analysis**. The history displays the latest analysis attempt per stored image, model version, score and timestamp. Reanalysis updates that image record; immutable per-attempt model audit history is not implemented. The older demo illustration/defect panels remain clearly separate from this real-image workflow. Camera image storage is not the same as a confirmed active hardware connection.

## 5. ESP32-CAM HTTP contract (no firmware changed)

Flow: **ESP32-CAM JPEG -> authenticated Express upload -> local file + MongoDB metadata -> FastAPI Model 01 -> stored result -> dashboard history**.

```http
POST /api/module-02/image-classification/images?sampleId=CIN-001
Content-Type: image/jpeg
X-Device-Id: ESP32-CAM-01
X-Device-Key: <camera's configured secret>

<raw JPEG bytes from camera framebuffer>
```

The body is raw file bytes, not multipart/base64. The default capture timestamp is server receipt time; optionally supply a URL-encoded ISO `capturedAt` timestamp with timezone. Filename paths from clients are never accepted. This endpoint does not deduplicate device retries; callers should avoid blindly resending successful uploads. No ESP32 firmware or camera streaming was installed/tested.

Manual testing from PowerShell:

```powershell
$key = Read-Host 'Camera key'
Invoke-RestMethod 'http://localhost:5000/api/module-02/image-classification/images?sampleId=CIN-001' -Method Post -Headers @{'X-Device-Id'='ESP32-CAM-01';'X-Device-Key'=$key} -ContentType image/jpeg -InFile '.\sample.jpg'
Invoke-RestMethod 'http://localhost:5000/api/module-02/image-classification/history?sampleId=CIN-001&page=1&limit=12'
```

Express endpoints:

| Method | Path after `/api/module-02/image-classification` | Purpose |
|---|---|---|
| GET | `/status` | Inference health, available without MongoDB |
| POST | `/images?sampleId=...` | Store image/request classification; operator Bearer token or device headers |
| GET | `/history?sampleId=...&page=1&limit=12` | Paginated stored images/results; limit max 100 |
| POST | `/:imageId/analyze` | Retry a stored image; operator Bearer token only |
| GET | `/:imageId/file` | Retrieve the stored file |

Uploads return 201 when stored, including when the model is unavailable; inspect `analysisStatus` and `errorCode`. Classification status is not a fake prediction. Bad IDs 400; invalid credentials 401; device reanalysis 403; missing records/files 404; oversized uploads 413; unsupported signatures/types 415; database unavailable 503. Without inference results, records remain pending/unavailable/failed. JSON errors use `{error:{code,message}}`.

Authentication is a research API token mechanism, **not user-account authorization**. GET histories/images are public to clients that can reach the API. Before public hosting add proper user access controls, TLS, storage quotas/rate limits and backups. Existing CORS/Helmet middleware remains. Image signatures are screened at upload, with full image decoding at inference; when the model is absent, signature screening alone does not guarantee a fully decodable image. Local storage is intended for a single development server. Process crashes can leave orphan files; backup and cleanup operations are not automated here.

## 6. Tests and verification limits

```powershell
$env:PYTHONPATH = "$PWD\ml-module02\src"
python -m unittest discover -s ml-module02/tests -p test_dataset_review.py -v
npm run test:images --workspace server
npm run build
```

The five Python tests run without TensorFlow and verify annotation gates, conflicting duplicates, changed files, sample-disjoint reproducible splitting and absent-artifact behavior. Five Express HTTP test cases use isolated in-memory persistence and test-only model outputs to verify auth, storage, history, type/size/path limits, database-failure cleanup and upstream response validation. They do not touch your real MongoDB or claim trained-model accuracy. TensorFlow/FastAPI runtime, actual MongoDB persistence, ESP32 hardware and visual browser behavior need their configured environments; no successful live classification is claimed.

Modified integration files: `server/src/server.js`, `server/package.json`, `client/src/pages/ImageAnalysis.jsx`, `client/src/styles/quality.css`, `.gitignore`, root README. New isolated components: `server/src/module02-image/`, `server/test/image-classification.test.js`, frontend `ImageClassifierPanel.jsx` and `imageClassificationService.js`, plus `ml-module02` training/inference package, tests and notebook. Existing Module 01 and Module 04 implementation files are preserved.

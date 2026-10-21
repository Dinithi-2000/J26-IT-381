# ESP32-CAM + existing Model 01 integration

All changes are on local branch **GamageIT23481244**. Nothing was pushed or merged. CameraWebServer firmware is unchanged. No model was retrained or downloaded from Google Drive.

## Architecture reused

The checkout has React/Vite in `client`, Express/Mongoose in `server`, the existing XGBoost FastAPI price service in `ml-service`, and an existing Model 01 FastAPI image service/package in `ml-module02`. There is no `quality-service` directory in this checkout. This work extends the existing image service, Express image routes, MongoDB image collection and dashboard panel. It does not add another application or duplicate collection.

```text
React /module-02/images
  -> Express port 5000 (operator authentication + registered sample)
  -> existing Python image API port 8002
  -> configurable ESP32-CAM /capture GET (no firmware change)
  -> same JPEG bytes stored and submitted to Model 01
  -> existing module02_image_condition_analyses collection + local image files
  -> dashboard image, raw class label, score, per-class scores and history
```

The existing price service stays on port 8000. Module 04 endpoints/model code and Module 01 functionality are preserved. This is current-image classification only, not the future multi-parameter storage-degradation model.

## 1. Required runtime and dependencies

Vite's installed engine requires Node **20.19+ in the 20.x line or 22.12+**. Python 3.11/3.12 is a practical choice for a separate TensorFlow environment; Python 3.13 can also be used with a compatible TensorFlow build. Match your Colab TensorFlow/Keras version if model loading fails. The code does not disable Keras safe loading to work around serialization problems.

From the outer repository root, not the nested `J26-IT-381` copy:

```powershell
npm install
python -m venv .venv-quality
.\.venv-quality\Scripts\Activate.ps1
python -m pip install -e './ml-module02[api,test]'
```

If `python` points to an incompatible version, create the environment with the installed compatible executable instead (for example `py -3.11 -m venv .venv-quality`). TensorFlow installation requires adequate disk space. No new Node dependency was added. The existing price Python dependencies remain separate in `ml-service/requirements.txt`.

## 2. Place the existing trained model locally

Manually copy your own `MyDrive/CinnaSense_Models/cinnamon_quality_mobilenetv2.keras` into:

```text
ml-module02/models/cinnamon_quality_mobilenetv2.keras
ml-module02/models/class_names.json
```

Create the folder and label file template:

```powershell
New-Item -ItemType Directory -Force ml-module02/models
Copy-Item ml-module02/class_names.example.json ml-module02/models/class_names.json
```

`class_names.json` must contain exactly:

```json
["Suspected Mold", "good_quality"]
```

Do not sort or rename those labels. The output index is interpreted in this training order. `good_quality` is retained in prediction records; historical `Good Quality` records remain supported. The default version is a fingerprint of the actual model file; `MODULE02_IMAGE_MODEL_VERSION` can supply an explicit experiment version.

The classifier converts decoded images to RGB, resizes to **224 x 224**, and creates **float32 raw pixels in [0,255]**. It does **not** divide by 255, call MobileNetV2 preprocessing or add another rescaling layer. Preprocessing is already inside your saved model. EXIF orientation is applied before resizing. Only trusted `.keras` files are loaded, with `compile=False` and `safe_mode=True`; startup checks input/output shape and class order. Model loading occurs once during application startup; restart after replacing artifacts/configuration.

For a valid external Colab model, the older pipeline's metadata/evaluation files are not required. An optional legacy `MODULE02_IMAGE_MODEL_DIR` is still supported when `MODULE02_IMAGE_MODEL_PATH` is unset. That older mode retains its own metadata/hash/evaluation contract.

Your reported training accuracy **89.77%**, validation accuracy **82.61%**, and test accuracy **82.98% on 47 images** are user-supplied experiment results, not independently reproduced here. They are not hardcoded as dashboard confidence or service health. Suspected Mold is a visual suspicion, not lab-confirmed mold or food-safety certification.

## 3. Configure the Python image service

Copy the example only if you do not already have this file; otherwise merge its keys manually:

```powershell
Copy-Item ml-module02/.env.example ml-module02/.env
```

Edit `ml-module02/.env`:

```env
MODULE02_IMAGE_MODEL_PATH=models/cinnamon_quality_mobilenetv2.keras
MODULE02_CLASS_NAMES_PATH=models/class_names.json
MODULE02_IMAGE_MODEL_VERSION=
MODULE02_IMAGE_SERVICE_TOKEN=YOUR_RANDOM_32_OR_MORE_CHARACTER_SERVICE_SECRET
ESP32_CAM_URL=http://172.20.10.5/capture
ESP32_CAM_TIMEOUT_SECONDS=8
MODULE02_ALLOWED_ORIGIN=http://localhost:5173
```

Relative model paths resolve against `ml-module02`, not the terminal working directory. Absolute paths are also accepted. The service reads `ml-module02/.env` without overriding shell variables. The camera IP appears only in configuration/examples, not application logic. Update it after Wi-Fi reconnection if necessary. URLs must be direct HTTP(S), without embedded username/password or redirects. Camera requests bypass system HTTP proxies so the configured local-network endpoint is contacted directly.

Generate a service secret, then a **different operator secret**, with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never use the literal placeholder or put secrets into React/Vite variables. Python CORS allows only `MODULE02_ALLOWED_ORIGIN`; the normal dashboard flow uses Express, so the inference token remains server-side. Camera endpoints require the inference-service token. The public health endpoint exposes readiness/classes/version, not configured paths or camera credentials.

## 4. Configure Express

Merge these values into your existing `server/.env`, preserving MongoDB and price settings:

```env
MODULE02_OPERATOR_TOKEN=YOUR_SEPARATE_RANDOM_OPERATOR_SECRET
MODULE02_IMAGE_SERVICE_URL=http://127.0.0.1:8002
MODULE02_IMAGE_SERVICE_TOKEN=SAME_RANDOM_SERVICE_SECRET_AS_PYTHON
```

Keep your existing MongoDB URI and `CLIENT_URL=http://localhost:5173`. Neither the camera URL nor model path belongs in the browser. Existing device-key upload functionality is retained, but laptop-triggered camera fetches require an operator token and do not require changing the camera firmware. Reads still follow the existing local research API access policy; public deployment requires user authorization, HTTPS, quotas and protected image/history access.

Images are stored in the existing image-condition collection and local storage directory. The new source field (`esp32_cam` or `manual_upload`) is additive; no collection is dropped or migrated destructively. New uploads/captures now require an existing, nonarchived sample from Module 02 Sample Management. Unknown IDs return 404; archived samples return 409. Old image/history records remain readable.

## 5. Start services

Terminal 1, repository root, with the quality environment activated:

```powershell
.\.venv-quality\Scripts\Activate.ps1
python -m uvicorn cinnasense_quality.api:app --host 127.0.0.1 --port 8002
```

Terminal 2, repository root (MongoDB local or Atlas must be available):

```powershell
npm run dev
```

This starts Express on 5000 and Vite on 5173 using the existing root scripts. The image service does not require the price service to work. Start the price service separately using `ml-service/README.md` only when using Module 04. Do not replace its ML_SERVICE_URL with the quality URL.

## 6. Local testing procedure

1. Connect the laptop and camera to a network that allows peer access. Confirm the current camera `/capture` URL in your laptop browser.
2. Start the Python service. Open `http://127.0.0.1:8002/health`. Expect `status=ready` and classes in the documented order. A missing artifact returns HTTP 503 MODEL_UNAVAILABLE; no dummy prediction is substituted.
3. Start Express/Vite. Open `http://localhost:5173/module-02/samples`, turn demo off and register a real sample using your operator token.
4. Open `/module-02/images`. In **Image condition prototype**, select/enter that registered sample ID and enter your operator token.
5. Click **Check camera connection**. This performs one real capture/decode check through Python. It is not proof of a continuously connected device.
6. Click **Capture and predict**. The latest-result panel shows the stored image, source, raw class label, uncalibrated score and both class scores. History uses the same stored image bytes; the browser does not fetch a different camera frame for the preview.
7. Use the file selector and **Store image and request classification** to test a manually captured JPEG/PNG. Maximum upload is 5 MiB and decoded image size is limited to 20 million pixels. File type/signature are checked at Express and decoding is checked in Python. GIF/SVG/HTML are rejected.
8. Stop or disconnect the camera, check again and confirm an actionable error. Manual uploads should still work with a loaded model and available database.
9. If the model is missing, images may be stored with `model_unavailable`, never fake scores. Place the model, restart Python, then retry analysis using the operator token. Reanalysis replaces the latest result for that stored image; this is not an immutable per-attempt audit log.

Direct PowerShell tests (operator calls through Express):

```powershell
$operatorToken = Read-Host 'Operator token'
$headers = @{Authorization="Bearer $operatorToken"}
Invoke-RestMethod http://localhost:5000/api/module-02/image-classification/camera/status -Headers $headers
Invoke-RestMethod 'http://localhost:5000/api/module-02/image-classification/camera?sampleId=CIN-001' -Method Post -Headers $headers
Invoke-RestMethod 'http://localhost:5000/api/module-02/image-classification/images?sampleId=CIN-001' -Method Post -Headers $headers -ContentType image/jpeg -InFile '.\sample.jpg'
```

Use an actually registered sample ID. To test Python independently of MongoDB:

```powershell
$serviceToken = Read-Host 'Inference service token'
$serviceHeaders = @{'X-Quality-Service-Token'=$serviceToken}
Invoke-RestMethod http://127.0.0.1:8002/camera/status -Headers $serviceHeaders
Invoke-RestMethod http://127.0.0.1:8002/classify/camera -Method Post -Headers $serviceHeaders
Invoke-RestMethod http://127.0.0.1:8002/classify -Method Post -Headers $serviceHeaders -ContentType image/jpeg -InFile '.\sample.jpg'
```

Python direct predictions include both the existing camelCase fields and compatible `predicted_class`, `score`, `class_scores`, and `source` fields. Scores are not calibrated mold probabilities. Direct `/classify/camera` returns classification JSON without persisting a photo; use the Express camera flow for durable dashboard image/history references.

## Reused and new API paths

| API | Method/path | Behavior |
|---|---|---|
| Python existing | GET `/health` | Model readiness or MODEL_UNAVAILABLE |
| Python new | GET `/camera/status` | Authenticated point-in-time JPEG capture/decode check |
| Python new | GET `/camera/capture` | Authenticated exact JPEG bytes and capture-response timestamp |
| Python existing | POST `/classify` | Authenticated raw JPEG/PNG manual inference |
| Python new | POST `/classify/camera` | Authenticated camera capture + model inference, no persistence |
| Express new | GET `/api/module-02/image-classification/camera/status` | Operator camera check, available without MongoDB |
| Express new | POST `/api/module-02/image-classification/camera?sampleId=...` | Registered sample capture, stored image and classification attempt |

Existing upload, history, file and retry routes are reused. Camera/ML calls use bounded reads, timeouts and no browser-supplied destination URL. The timestamp describes the laptop service receiving a camera response, not a separately synchronized sensor clock. The camera remains protected only by its existing local network/firmware configuration; no claim is made that adding operator auth to Express protects the camera's own web server.

## Troubleshooting

- **CAMERA_UNREACHABLE / CAMERA_TIMEOUT:** camera power and current IP, laptop Wi-Fi/hotspot, client isolation, firewall and `/capture` path. Configure the Python `.env` and restart. Camera errors do not expose private environment values. No automatic retry loop repeatedly captures images.
- **MODEL_UNAVAILABLE:** check the two files, relative/absolute paths, exact label order, `.keras` extension and compatible TensorFlow/Keras runtime. Health `reason` can distinguish invalid labels/shapes. Only load your trusted model; do not disable `safe_mode` to accept unknown serialized code. A model saved with unsafe Lambda serialization may need a safe export from its original training environment; no retraining or replacement weights are performed here.
- **TensorFlow installation/DLL errors:** compatible Python and TensorFlow versions, adequate disk space and required runtime libraries. Use a separate virtual environment; keep the price service dependencies independent.
- **AUTH_UNCONFIGURED / 401:** use the same service secret on Python and Express, a different operator secret in the dashboard, and at least 32 characters. Shell variables override `.env`, so restart with the intended environment.
- **DATABASE_UNAVAILABLE:** check your existing MongoDB/Atlas access configuration. Direct Python inference and authenticated camera status can still be tested independently of the database. Do not print your URI in logs or screenshots.
- **404 sample not found / 409 archived:** register/select an active sample in Module 02 before capture/upload.
- **Image stored but no prediction:** inspect analysisStatus/errorCode. Fix the model/service, then retry. No risk/confidence is invented when inference fails.

## Automated verification and limits

```powershell
$env:PYTHONPATH = "$PWD\ml-module02\src"
python -m unittest discover -s ml-module02/tests -p test_camera_integration.py -v
python -m unittest discover -s ml-module02/tests -p test_dataset_review.py -v
npm run test:images --workspace server
npm test --workspace server
npm run build
```

Camera/model tests use real Pillow/NumPy preprocessing and test-only model/camera fixtures; no physical hardware is required. They assert raw float32 pixel scale (including 255), class order, one-time loading, API response shape, camera errors, image validation, authentication and CORS. Express tests use isolated persistence, avoiding your production database.

Actual results: 10 Python camera/API/inference tests, 5 existing dataset tests, 7 Express image tests and 14 existing backend/client regression tests passed (36 total); frontend build passed. One real MongoDB integration test was skipped because no dedicated test database was configured. The installed Starlette test client emitted an httpx deprecation warning, not a test failure. A real one-shot capture check against the supplied camera address returned CAMERA_UNREACHABLE from this environment. The Drive model was not supplied locally, so its real weights, reported accuracy and physical-camera classification are not verified. No claim of a completed live hardware/model deployment is made.

Sources for library behavior: [TensorFlow safe model loading](https://www.tensorflow.org/api_docs/python/tf/keras/models/load_model) and [Pillow image decoding/conversion](https://pillow.readthedocs.io/en/stable/reference/Image.html). No external model or dataset was downloaded.


## Files created and modified

Created: `ml-module02/src/cinnasense_quality/camera.py`, `ml-module02/tests/test_camera_integration.py`, `ml-module02/class_names.example.json`, and this guide.

Updated Python files: `inference.py`, `api.py`, `pyproject.toml`, `.env.example`, `README.md`, `IMAGE_CONDITION_GUIDE.md`.

Updated Express files: `server/src/module02-image/{routes,service,model}.js`, `server/test/image-classification.test.js`, `server/.env.module02-image.example`.

Updated frontend files: `client/src/components/ImageClassifierPanel.jsx`, `client/src/services/imageClassificationService.js`, `client/src/pages/ImageAnalysis.jsx`, `client/src/styles/quality.css`.

Updated project files: root `README.md` and `.gitignore`. No actual environment secrets, datasets or model weights are added. Existing `ml-service` price code, sensor backend and firmware are unchanged.

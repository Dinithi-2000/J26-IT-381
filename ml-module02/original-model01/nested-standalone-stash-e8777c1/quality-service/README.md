# Quality image service (Module 02, Model 01)

MobileNetV2 visible-condition classifier + FastAPI service + SQLite history, consumed by the
dashboard's Image Analysis page.

## Train
```
pip install -r requirements.txt
python training/train_mobilenet.py --data-dir "<folder with one sub-folder per class>"
```
Writes `models/` (model, `labels.json`, `metrics.json`). Classes are whatever sub-folders exist, so
add `Discolored/` and `Physical_Damage/` folders and re-run to get all four classes. Files are split
group-wise (by sample/burst inferred from file names) to limit leakage.

## Run
```
set ESP32_CAM_URL=http://<camera-ip>      (IP printed by the CameraWebServer sketch; PowerShell: $env:ESP32_CAM_URL="http://...")
uvicorn app.main:app --port 8001
cd ../client && npm run dev               (dashboard proxies /condition-api -> :8001)
```
- `POST /esp32/capture?sample_id=CIN-001` service fetches `<ESP32_CAM_URL>/capture` and classifies it
- `POST /classify?sample_id=CIN-001` multipart `file` (dashboard upload)
- `POST /esp32/upload?sample_id=CIN-001` raw JPEG body, if the camera is later set to push instead
- `GET /analyses`, `GET /analyses/summary`, `GET /model/metrics`, `GET /health`

The PC and the ESP32-CAM must be on the same network.

## Known limitations
- Only **Good Quality** and **Suspected Mold** have training data so far.
- Training images are phone photos; ESP32-CAM (OV2640) images look different. Collect ESP32-CAM
  images under fixed lighting/background and retrain before trusting live results.
- The YOLO "Quill" datasets are single-class detection data; they are not used for classification.
- Storage is SQLite for now; MongoDB is the planned store.
- Do not commit Wi-Fi credentials from the camera sketch.

"""CinnaSense AI - Module 02, Model 01: image-based visible condition service.

Receives cinnamon images (dashboard upload or ESP32-CAM POST), classifies them
with the trained MobileNetV2 model, stores the result and serves history to the
dashboard. Results are image-based indications only.
"""
import io
import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", ROOT / "models"))
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "analyses.db"
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.6"))
MAX_BYTES = 25 * 1024 * 1024
IMG_SIZE = 224

DISPLAY = {
    "Good_quality": "Good Quality",
    "Suspected_Mold": "Suspected Mold",
    "Discolored": "Discolored",
    "Physical_Damage": "Physical Damage",
}
state = {"model": None, "labels": [], "error": None}


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@asynccontextmanager
async def lifespan(_app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with closing(db()) as c, c:
        c.execute("""CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY, sample_id TEXT NOT NULL, source TEXT NOT NULL,
            created_at TEXT NOT NULL, image_file TEXT NOT NULL, predicted TEXT NOT NULL,
            score REAL NOT NULL, uncertain INTEGER NOT NULL, scores TEXT NOT NULL,
            model_version TEXT NOT NULL)""")
    try:
        import tensorflow as tf
        state["model"] = tf.keras.models.load_model(MODEL_DIR / "cinnamon_condition_mobilenetv2.keras")
        state["labels"] = json.loads((MODEL_DIR / "labels.json").read_text())
    except Exception as exc:  # noqa: BLE001 - reported via /health, never faked
        state["error"] = f"{type(exc).__name__}: {exc}"
        print("MODEL_UNAVAILABLE:", state["error"])
    yield


app = FastAPI(title="CinnaSense Quality Image Service", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def classify(raw: bytes, sample_id: str, source: str) -> dict:
    if state["model"] is None:
        raise HTTPException(503, f"Model unavailable: {state['error']}")
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413 if raw else 400, "Image is empty or larger than 25 MB.")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
        img = img.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(422, "Not a readable image.") from exc
    arr = np.asarray(img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR), dtype="float32")[None]
    probs = state["model"].predict(arr, verbose=0)[0]
    top = int(probs.argmax())
    key = state["labels"][top]
    score = float(probs[top])
    aid = uuid.uuid4().hex[:12]
    fname = f"{aid}.jpg"
    img.save(UPLOAD_DIR / fname, quality=90)
    row = {
        "id": aid, "sampleId": sample_id, "source": source,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "imageUrl": f"/uploads/{fname}",
        "predictedCondition": DISPLAY.get(key, key.replace("_", " ")),
        "score": round(score, 4), "uncertain": score < MIN_CONFIDENCE,
        "scores": {DISPLAY.get(k, k): round(float(p), 4) for k, p in zip(state["labels"], probs)},
        "modelVersion": "mobilenetv2-" + "-".join(state["labels"]).lower(),
        "status": "Completed",
    }
    with closing(db()) as c, c:
        c.execute("INSERT INTO analyses VALUES (?,?,?,?,?,?,?,?,?,?)", (
            aid, sample_id, source, row["createdAt"], fname, row["predictedCondition"],
            row["score"], int(row["uncertain"]), json.dumps(row["scores"]), row["modelVersion"]))
    return row


def to_dict(r: sqlite3.Row) -> dict:
    return {"id": r["id"], "sampleId": r["sample_id"], "source": r["source"], "createdAt": r["created_at"],
            "imageUrl": f"/uploads/{r['image_file']}", "predictedCondition": r["predicted"],
            "score": r["score"], "uncertain": bool(r["uncertain"]), "scores": json.loads(r["scores"]),
            "modelVersion": r["model_version"], "status": "Completed"}


@app.get("/health")
def health():
    ok = state["model"] is not None
    return {"status": "ok" if ok else "unavailable", "classes": state["labels"], "error": state["error"]}


@app.post("/classify")
async def classify_upload(file: UploadFile = File(...), sample_id: str = Query("UNASSIGNED", max_length=40)):
    return classify(await file.read(), sample_id, "dashboard-upload")


@app.post("/esp32/upload")
async def esp32_upload(request: Request, sample_id: str = Query("UNASSIGNED", max_length=40)):
    """ESP32-CAM posts the raw JPEG as the request body (Content-Type: image/jpeg)."""
    return classify(await request.body(), sample_id, "esp32-cam")


@app.get("/analyses")
def list_analyses(sample_id: str | None = None, limit: int = Query(50, ge=1, le=500)):
    q, args = "SELECT * FROM analyses", []
    if sample_id:
        q += " WHERE sample_id = ?"
        args.append(sample_id)
    with closing(db()) as c:
        rows = c.execute(q + " ORDER BY created_at DESC LIMIT ?", (*args, limit)).fetchall()
    return [to_dict(r) for r in rows]


@app.get("/analyses/summary")
def summary():
    with closing(db()) as c:
        rows = c.execute("SELECT predicted, COUNT(*) n FROM analyses GROUP BY predicted").fetchall()
    return {"total": sum(r["n"] for r in rows), "byCondition": {r["predicted"]: r["n"] for r in rows}}


@app.get("/model/metrics")
def model_metrics():
    path = MODEL_DIR / "metrics.json"
    if not path.exists():
        raise HTTPException(404, "No evaluation metrics found.")
    return json.loads(path.read_text())


@app.post("/esp32/capture")
def esp32_capture(sample_id: str = Query("UNASSIGNED", max_length=40)):
    """Pull one frame from the ESP32-CAM running the stock CameraWebServer (GET /capture).

    The camera address comes only from the ESP32_CAM_URL environment variable
    (e.g. http://192.168.1.60), never from the request, so this cannot be pointed at other hosts.
    """
    import urllib.error
    import urllib.request
    base = os.getenv("ESP32_CAM_URL", "").rstrip("/")
    if not base:
        raise HTTPException(503, "ESP32_CAM_URL is not set on the quality service.")
    try:
        with urllib.request.urlopen(f"{base}/capture", timeout=10) as r:
            raw = r.read(MAX_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise HTTPException(502, f"Could not reach the ESP32-CAM at {base}: {exc}") from exc
    return classify(raw, sample_id, "esp32-cam")

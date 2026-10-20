"""Evaluate a trained model on the held-out test manifest. Run this once, after model selection."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, f1_score

from common import CLASSES
from train import load_manifest, make_dataset


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", type=Path, default=Path("experiments/mobilenetv2_baseline"))
    ap.add_argument("--manifests", type=Path, default=Path("data/manifests"))
    args = ap.parse_args()

    # The saved class map must match the code's class order, or predictions would be mislabelled.
    saved = json.loads((args.model_dir / "class_indices.json").read_text())
    assert [c for c, _ in sorted(saved.items(), key=lambda kv: kv[1])] == CLASSES, "class order mismatch"

    model = tf.keras.models.load_model(str(args.model_dir / "model.keras"))
    test_df = load_manifest(args.manifests / "test.csv")
    train_ids = set(load_manifest(args.manifests / "train.csv")["sample_id"])
    assert not train_ids & set(test_df["sample_id"]), "sample_id overlap train/test"

    probs = model.predict(make_dataset(test_df, 32, False, 0))
    y_true, y_pred = test_df["y"].to_numpy(), probs.argmax(axis=1)
    labels = list(range(len(CLASSES)))
    report = classification_report(y_true, y_pred, labels=labels, target_names=CLASSES, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    brier = float(np.mean(np.sum((probs - np.eye(len(CLASSES))[y_true]) ** 2, axis=1)))
    out = {
        "n_test_images": int(len(test_df)),
        "n_test_samples": int(test_df["sample_id"].nunique()),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", labels=labels, zero_division=0)),
        "brier_score": brier,
        "per_class": {c: report[c] for c in CLASSES},
        "confusion_matrix": cm.tolist(),
        "note": "Test images from few independent samples give wide uncertainty; do not over-read a single score.",
    }
    (args.model_dir / "test_report.json").write_text(json.dumps(out, indent=2))
    test_df.assign(pred=[CLASSES[i] for i in y_pred], confidence=probs.max(axis=1))[y_true != y_pred] \
        .to_csv(args.model_dir / "test_errors.csv", index=False)

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    for ax, mat, title in ((axes[0], cm, "Counts"), (axes[1], cm / np.maximum(cm.sum(1, keepdims=True), 1), "Row-normalised")):
        ax.imshow(mat, cmap="Blues")
        ax.set_xticks(labels, CLASSES, rotation=30, ha="right")
        ax.set_yticks(labels, CLASSES)
        ax.set_title(title); ax.set_xlabel("Predicted"); ax.set_ylabel("True")
        for i in labels:
            for j in labels:
                ax.text(j, i, f"{mat[i, j]:.2f}" if title != "Counts" else int(mat[i, j]), ha="center", va="center")
    fig.tight_layout()
    fig.savefig(args.model_dir / "confusion_matrix.png", dpi=150)
    print(json.dumps({k: out[k] for k in ("n_test_images", "n_test_samples", "macro_f1", "brier_score")}, indent=2))


if __name__ == "__main__":
    main()

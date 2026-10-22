"""Train the Model 01 MobileNetV2 visible-condition classifier.

Expected layout: one sub-folder per class under --data-dir, e.g.
    Good_quality/  Suspected_Mold/  Discolored/  Physical_Damage/
Any sub-folder present is used, so adding the missing classes later only needs
new folders and a re-run.

Images of the same physical sample must not straddle train/val/test, so files
are split by *group*. Groups are inferred from file names (see group_of); this
is an approximation of "same physical sample" and should be replaced by real
sample IDs when they are available.
"""
import argparse
import json
import random
import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

IMG_SIZE = 224
EXTS = {".jpg", ".jpeg", ".png"}


def group_of(path: Path) -> str:
    name = path.stem
    m = re.match(r"(CIN\d+)_\d+", name)            # CIN001_03 -> CIN001
    if m:
        return m.group(1)
    m = re.match(r"(\d{8}_\d{4})\d{2}", name)      # 20261018_084936 -> same minute
    if m:
        return m.group(1)
    m = re.match(r"IMG_(\d+)", name)               # phone shots: blocks of 5 frames
    if m:
        return f"IMG_{int(m.group(1)) // 5}"
    return name


def collect(data_dir: Path):
    classes = sorted(d.name for d in data_dir.iterdir() if d.is_dir())
    items = []  # (path, class_idx, group)
    for idx, cls in enumerate(classes):
        for p in sorted((data_dir / cls).iterdir()):
            if p.suffix.lower() in EXTS:
                items.append((p, idx, f"{cls}:{group_of(p)}"))
    return classes, items


def group_split(items, seed, val_frac=0.15, test_frac=0.15):
    by_class = defaultdict(lambda: defaultdict(list))
    for it in items:
        by_class[it[1]][it[2]].append(it)
    rng = random.Random(seed)
    split = {"train": [], "val": [], "test": []}
    for groups in by_class.values():
        keys = list(groups)
        rng.shuffle(keys)
        total = sum(len(groups[k]) for k in keys)
        n = {"test": 0, "val": 0}
        for k in keys:
            if n["test"] < total * test_frac:
                dest = "test"
            elif n["val"] < total * val_frac:
                dest = "val"
            else:
                dest = "train"
            if dest != "train":
                n[dest] += len(groups[k])
            split[dest].extend(groups[k])
    return split


def make_ds(items, training, batch, cw=None):
    paths = [str(p) for p, _, _ in items]
    labels = [l for _, l, _ in items]

    def load(path, label):
        img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
        img = tf.image.resize(img, (IMG_SIZE, IMG_SIZE))
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    if training:
        ds = ds.shuffle(len(paths), seed=1)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if cw:  # per-sample weights (class_weight= is unreliable with tf.data inputs)
        table = tf.constant([cw[i] for i in range(len(cw))], tf.float32)
        ds = ds.map(lambda x, y: (x, y, tf.gather(table, y)))
    ds = ds.batch(batch)
    return ds.prefetch(tf.data.AUTOTUNE)


def build(num_classes):
    aug = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.15),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomBrightness(0.2),
        tf.keras.layers.RandomContrast(0.2),
    ])
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights="imagenet")
    base.trainable = False
    inputs = tf.keras.Input((IMG_SIZE, IMG_SIZE, 3))
    x = aug(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)  # [-1, 1]; baked into the model
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs), base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True, type=Path)
    ap.add_argument("--out-dir", default=Path(__file__).parent.parent / "models", type=Path)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--finetune-epochs", type=int, default=8)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    tf.keras.utils.set_random_seed(a.seed)

    classes, items = collect(a.data_dir)
    split = group_split(items, a.seed)
    counts = {s: {classes[c]: sum(1 for _, l, _ in v if l == c) for c in range(len(classes))}
              for s, v in split.items()}
    print("split counts:", json.dumps(counts, indent=1))

    n_tr = np.bincount([l for _, l, _ in split["train"]], minlength=len(classes))
    cw = {i: len(split["train"]) / (len(classes) * max(n, 1)) for i, n in enumerate(n_tr)}
    train = make_ds(split["train"], True, a.batch, cw)
    val, test = (make_ds(split[s], False, a.batch) for s in ("val", "test"))
    model, base = build(len(classes))
    cb = [tf.keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True, monitor="val_loss")]

    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(train, validation_data=val, epochs=a.epochs, callbacks=cb)

    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(train, validation_data=val, epochs=a.finetune_epochs, callbacks=cb)

    y_true = np.array([l for _, l, _ in split["test"]])
    # make_ds(training=False) keeps order, so predictions line up with split["test"]
    y_prob = model.predict(test)
    y_pred = y_prob.argmax(1)
    labels = list(range(len(classes)))
    report = classification_report(y_true, y_pred, labels=labels, target_names=classes,
                                   output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels).tolist()
    print(classification_report(y_true, y_pred, labels=labels, target_names=classes, zero_division=0))
    print("confusion matrix:", cm)

    a.out_dir.mkdir(parents=True, exist_ok=True)
    model.save(a.out_dir / "cinnamon_condition_mobilenetv2.keras")
    (a.out_dir / "labels.json").write_text(json.dumps(classes, indent=1))
    (a.out_dir / "metrics.json").write_text(json.dumps({
        "classes": classes, "split_counts": counts, "test_report": report,
        "confusion_matrix": cm, "test_images": len(y_true), "seed": a.seed,
        "note": "Group split inferred from file names; test set is small. Held-out test "
                "images only; not a validated storage-degradation classifier.",
    }, indent=1))
    print("saved to", a.out_dir)


if __name__ == "__main__":
    main()

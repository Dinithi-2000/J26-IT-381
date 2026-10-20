"""MobileNetV2 transfer-learning baseline (spec section 6).

Inputs are raw RGB pixels on a 0-255 scale; mobilenet_v2.preprocess_input runs INSIDE the
model exactly once. Saves model, class-index JSON, config and training history.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import f1_score
from tensorflow.keras import layers

from common import CLASSES, IMAGE_SIZE


def load_manifest(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["y"] = df["label"].map({c: i for i, c in enumerate(CLASSES)})
    if df["y"].isna().any():
        raise SystemExit(f"Unknown labels in {path}")
    return df


def make_dataset(df: pd.DataFrame, batch_size: int, shuffle: bool, seed: int) -> tf.data.Dataset:
    def _load(p, y):
        img = tf.io.decode_image(tf.io.read_file(p), channels=3, expand_animations=False)
        img = tf.image.resize(img, IMAGE_SIZE)  # float32, still 0-255
        img.set_shape((*IMAGE_SIZE, 3))
        return img, y
    ds = tf.data.Dataset.from_tensor_slices((df["file_path"].to_numpy(), df["y"].to_numpy().astype("int32")))
    if shuffle:
        ds = ds.shuffle(len(df), seed=seed, reshuffle_each_iteration=True)
    return ds.map(_load, num_parallel_calls=tf.data.AUTOTUNE).batch(batch_size).prefetch(tf.data.AUTOTUNE)


def build_model(num_classes: int, dropout: float, lr: float) -> tuple[tf.keras.Model, tf.keras.Model]:
    base = tf.keras.applications.MobileNetV2(input_shape=(*IMAGE_SIZE, 3), include_top=False, weights="imagenet")
    base.trainable = False
    inputs = tf.keras.Input((*IMAGE_SIZE, 3))
    x = layers.RandomFlip("horizontal")(inputs)  # training-only; inactive at inference
    x = layers.RandomRotation(0.05)(x)  # no colour jitter: colour is itself a signal
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)
    model.compile(optimizer=tf.keras.optimizers.Adam(lr), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model, base


class MacroF1(tf.keras.callbacks.Callback):
    """Logs validation macro-F1 each epoch as val_macro_f1."""
    def __init__(self, ds, y_true):
        super().__init__()
        self.ds, self.y_true = ds, y_true

    def on_epoch_end(self, epoch, logs=None):
        pred = np.argmax(self.model.predict(self.ds, verbose=0), axis=1)
        logs["val_macro_f1"] = f1_score(self.y_true, pred, average="macro", labels=range(len(CLASSES)), zero_division=0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifests", type=Path, default=Path("data/manifests"))
    ap.add_argument("--out-dir", type=Path, default=Path("experiments/mobilenetv2_baseline"))
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--fine-tune-epochs", type=int, default=0, help="0 disables fine-tuning")
    ap.add_argument("--fine-tune-layers", type=int, default=30, help="top N backbone layers to unfreeze")
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--dropout", type=float, default=0.3)
    ap.add_argument("--class-weight", action="store_true", help="balance classes by inverse frequency")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    tf.keras.utils.set_random_seed(args.seed)
    train_df, val_df = load_manifest(args.manifests / "train.csv"), load_manifest(args.manifests / "validation.csv")
    assert not set(train_df["sample_id"]) & set(val_df["sample_id"]), "sample_id overlap train/validation"
    train_ds = make_dataset(train_df, args.batch_size, True, args.seed)
    val_ds = make_dataset(val_df, args.batch_size, False, args.seed)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    model, base = build_model(len(CLASSES), args.dropout, args.lr)
    ckpt = str(args.out_dir / "best.keras")
    callbacks = [
        MacroF1(val_ds, val_df["y"].to_numpy()),  # must come first so later callbacks see val_macro_f1
        tf.keras.callbacks.EarlyStopping(monitor="val_macro_f1", mode="max", patience=5, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(ckpt, monitor="val_macro_f1", mode="max", save_best_only=True),
    ]
    class_weight = None
    if args.class_weight:
        counts = train_df["y"].value_counts()
        class_weight = {int(c): float(len(train_df) / (len(counts) * n)) for c, n in counts.items()}

    history = model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks, class_weight=class_weight)
    hist = {k: [float(v) for v in vals] for k, vals in history.history.items()}

    if args.fine_tune_epochs > 0:
        base.trainable = True
        for layer in base.layers[:-args.fine_tune_layers]:
            layer.trainable = False
        for layer in base.layers:  # keep BatchNorm statistics frozen
            if isinstance(layer, layers.BatchNormalization):
                layer.trainable = False
        model.compile(optimizer=tf.keras.optimizers.Adam(args.lr / 10), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        ft = model.fit(train_ds, validation_data=val_ds, epochs=args.fine_tune_epochs, callbacks=callbacks, class_weight=class_weight)
        hist.update({f"ft_{k}": [float(v) for v in vals] for k, vals in ft.history.items()})

    model.save(str(args.out_dir / "model.keras"))
    (args.out_dir / "class_indices.json").write_text(json.dumps({c: i for i, c in enumerate(CLASSES)}, indent=2))
    (args.out_dir / "history.json").write_text(json.dumps(hist, indent=2))
    (args.out_dir / "config.json").write_text(json.dumps({
        **{k: (str(v) if isinstance(v, Path) else v) for k, v in vars(args).items()},
        "tensorflow": tf.__version__,
        "preprocessing": "raw RGB 0-255, resized to 224x224; mobilenet_v2.preprocess_input applied inside the model",
        "train_images": len(train_df), "validation_images": len(val_df),
    }, indent=2))
    print(f"Saved model and artifacts to {args.out_dir}")


if __name__ == "__main__":
    main()

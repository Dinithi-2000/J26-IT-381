"""Build the cinnamon reference used to reject photos that are not cinnamon.

The classifier only knows two classes, so it labels any photo (a circuit board, a face) as one
of them. The reference stores the model's feature embeddings of known cinnamon photos; at
inference a photo whose k-nearest-neighbour similarity falls below the threshold is rejected.

    python -m cinnasense_quality.reference --data "C:/path/to/dataset" --out models/cinnamon_reference.npz
"""
import argparse
import hashlib
from pathlib import Path

DEFAULT_THRESHOLD = 0.55  # calibrated 22 Oct 2026: blocks ~99% of 286 non-cinnamon photos
DEFAULT_K = 5
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def build(data_dir, model_path, out_path, threshold=DEFAULT_THRESHOLD, k=DEFAULT_K):
    import numpy as np
    import tensorflow as tf
    from PIL import Image
    from .inference import EMBEDDING_LAYER, image_pixels

    model_path = Path(model_path)
    model = tf.keras.models.load_model(model_path, compile=False, safe_mode=True)
    embed = tf.keras.Model(model.inputs[0], model.get_layer(EMBEDDING_LAYER).output)
    seen, paths = set(), []
    for path in sorted(Path(data_dir).rglob("*")):
        if path.suffix.lower() in IMAGE_SUFFIXES:
            digest = hashlib.md5(path.read_bytes()).hexdigest()
            if digest not in seen:
                seen.add(digest); paths.append(path)
    if len(paths) < k:
        raise SystemExit(f"Need at least {k} distinct cinnamon photos; found {len(paths)}.")
    batches = []
    for start in range(0, len(paths), 32):
        pixels = []
        for path in paths[start:start + 32]:
            with Image.open(path) as image:
                pixels.append(image_pixels(image))
        vectors = np.asarray(embed(np.stack(pixels), training=False))
        batches.append(vectors / np.linalg.norm(vectors, axis=1, keepdims=True))
    embeddings = np.concatenate(batches).astype(np.float16)
    np.savez_compressed(out_path, embeddings=embeddings, threshold=np.float32(threshold), k=np.int32(k),
                        model_sha256=hashlib.sha256(model_path.read_bytes()).hexdigest())
    return len(paths)


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="folder of cinnamon training photos (searched recursively)")
    parser.add_argument("--model", default=root / "models/cinnamon_quality_mobilenetv2.keras")
    parser.add_argument("--out", default=root / "models/cinnamon_reference.npz")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--k", type=int, default=DEFAULT_K)
    args = parser.parse_args()
    count = build(args.data, args.model, args.out, args.threshold, args.k)
    print(f"Saved {count} cinnamon reference embeddings to {args.out} (threshold {args.threshold}, k {args.k}).")


if __name__ == "__main__":
    main()

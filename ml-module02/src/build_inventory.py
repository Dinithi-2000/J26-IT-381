"""Scan a class-folder dataset and write the dataset inventory CSV (spec 5.2).

Expected layout:  <data-dir>/<class_name>/<image files>
Class folder names must be in common.CLASSES. Folders named uncertain/review are skipped.

sample_id is REQUIRED for leakage-safe splitting. Images of the same physical sample must
share a sample_id. Derive it from the file name with --sample-regex (first capture group),
e.g. --sample-regex "^(CIN-S\\d+)_". Without it, every image gets its own sample_id and the
script warns loudly, because the resulting split would not be leakage-safe.
"""
import argparse
import hashlib
import re
import sys
from pathlib import Path

import pandas as pd
from PIL import Image

from common import CLASSES, IMAGE_EXTENSIONS

SKIP_DIRS = {"uncertain", "review", "uncertain_review"}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build(data_dir: Path, sample_regex: str | None, batch_regex: str | None) -> pd.DataFrame:
    s_re = re.compile(sample_regex) if sample_regex else None
    b_re = re.compile(batch_regex) if batch_regex else None
    rows, bad = [], []
    for class_dir in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        name = class_dir.name.lower()
        if name in SKIP_DIRS:
            continue
        if name not in CLASSES:
            print(f"WARNING: skipping folder '{class_dir.name}' (not in {CLASSES})", file=sys.stderr)
            continue
        for path in sorted(class_dir.rglob("*")):
            if path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            try:
                with Image.open(path) as img:
                    img.verify()
            except Exception as exc:  # corrupted or unreadable image
                bad.append((str(path), str(exc)))
                continue
            sample = batch = None
            if s_re and (m := s_re.search(path.name)):
                sample = m.group(1)
            if b_re and (m := b_re.search(path.name)):
                batch = m.group(1)
            rows.append({
                "image_id": f"IMG-{len(rows) + 1:05d}",
                "sample_id": sample,
                "batch_id": batch,
                "file_path": str(path.resolve()),
                "label": name,
                "sha256": sha256_of(path),
            })
    df = pd.DataFrame(rows)
    if df.empty:
        sys.exit("No images found.")
    if df["sample_id"].isna().any():
        print("WARNING: sample_id missing for some images; each such image is treated as its own "
              "sample. Splits will NOT be leakage-safe if one physical sample has several photos.",
              file=sys.stderr)
        df["sample_id"] = df["sample_id"].fillna(df["image_id"])
    dupes = df[df.duplicated("sha256", keep=False)]
    if len(dupes):
        print(f"WARNING: {len(dupes)} images are byte-identical duplicates (same sha256). "
              "Duplicates across classes or splits distort results; review them.", file=sys.stderr)
    for path, err in bad:
        print(f"WARNING: unreadable image skipped: {path} ({err})", file=sys.stderr)
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("data/annotations/image_labels.csv"))
    ap.add_argument("--sample-regex")
    ap.add_argument("--batch-regex")
    args = ap.parse_args()
    df = build(args.data_dir, args.sample_regex, args.batch_regex)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df)} rows to {args.out}")
    print(df["label"].value_counts().to_string())
    print(f"Distinct sample_ids: {df['sample_id'].nunique()}")


if __name__ == "__main__":
    main()

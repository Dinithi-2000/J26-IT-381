"""Group-safe 70/15/15 split by sample_id (or batch_id), with recorded seed (spec 5.4).

All images sharing the group key land in exactly one partition. Group assignment is
stratified greedily by each group's majority class so rare classes reach every partition
when the data allows it. Fails loudly if any group appears in two partitions.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def split_groups(df: pd.DataFrame, group_col: str, seed: int, fractions=(0.70, 0.15, 0.15)) -> dict[str, str]:
    rng = np.random.default_rng(seed)
    groups = df.groupby(group_col).agg(label=("label", lambda s: s.mode().iloc[0]), n=("label", "size")).reset_index()
    names = ["train", "validation", "test"]
    assignment: dict[str, str] = {}
    for _, cls_groups in groups.groupby("label"):
        ids = cls_groups[group_col].to_numpy().copy()
        rng.shuffle(ids)
        total = len(ids)
        n_val = int(round(total * fractions[1]))
        n_test = int(round(total * fractions[2]))
        if total >= 3:  # guarantee at least one group in each partition when possible
            n_val, n_test = max(n_val, 1), max(n_test, 1)
        n_val = min(n_val, total)
        n_test = min(n_test, total - n_val)
        parts = {"validation": ids[:n_val], "test": ids[n_val:n_val + n_test], "train": ids[n_val + n_test:]}
        for name in names:
            for gid in parts[name]:
                assignment[gid] = name
    return assignment


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, default=Path("data/annotations/image_labels.csv"))
    ap.add_argument("--out-dir", type=Path, default=Path("data/manifests"))
    ap.add_argument("--group-by", choices=["sample_id", "batch_id"], default="sample_id")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = pd.read_csv(args.inventory)
    if args.group_by not in df or df[args.group_by].isna().any():
        raise SystemExit(f"{args.group_by} is missing for some rows; cannot make a group-safe split.")
    assignment = split_groups(df, args.group_by, args.seed)
    df["split"] = df[args.group_by].map(assignment)

    # Leakage guard: every group in exactly one partition.
    per_group = df.groupby(args.group_by)["split"].nunique()
    assert (per_group == 1).all(), "Group leakage detected across partitions."

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name in ("train", "validation", "test"):
        df[df["split"] == name].drop(columns="split").to_csv(args.out_dir / f"{name}.csv", index=False)
    counts = df.groupby(["split", "label"]).size().unstack(fill_value=0)
    summary = {
        "seed": args.seed,
        "group_by": args.group_by,
        "groups_per_split": df.groupby("split")[args.group_by].nunique().to_dict(),
        "images_per_split": df["split"].value_counts().to_dict(),
        "class_counts": json.loads(counts.to_json(orient="index")),
    }
    (args.out_dir / "split_summary.json").write_text(json.dumps(summary, indent=2))
    print(counts.to_string())
    print(json.dumps({k: summary[k] for k in ("seed", "groups_per_split")}))
    missing = [c for c in df["label"].unique() if any(counts.get(c, pd.Series(dtype=int)).get(s, 0) == 0 for s in counts.index)]
    if missing:
        print(f"WARNING: classes missing from some partitions: {missing}. Collect more independent samples.")


if __name__ == "__main__":
    main()

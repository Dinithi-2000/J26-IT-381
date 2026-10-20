"""Dataset audit and reviewed, group-disjoint splits. No ML dependencies."""
import argparse
import csv
import hashlib
import json
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

LABELS = {"Good_quality": "Good Quality", "Suspected_Mold": "Suspected Mold"}
EXTENSIONS = {".jpg", ".jpeg", ".png"}
FIELDS = ["image_path", "label", "sample_id", "suggested_sample_id", "label_verified", "sha256"]

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def audit(root, output):
    root, output = Path(root).resolve(), Path(output)
    rows = []
    for folder, label in LABELS.items():
        for path in sorted((root / folder).rglob("*")):
            if path.is_file() and path.suffix.lower() in EXTENSIONS:
                match = re.match(r"(CIN\d+)[_-]", path.stem, re.I)
                rows.append(dict(image_path=path.relative_to(root).as_posix(), label=label,
                    sample_id="", suggested_sample_id=match.group(1).upper() if match else "",
                    label_verified="false", sha256=digest(path)))
    if not rows:
        raise ValueError("No condition-labeled JPEG/PNG images found.")
    output.mkdir(parents=True, exist_ok=True)
    manifest = output / "review_manifest.csv"
    if manifest.exists():
        raise ValueError("Review manifest already exists; choose a new output folder to preserve annotations.")
    with manifest.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS); writer.writeheader(); writer.writerows(rows)
    hashes = defaultdict(list)
    for row in rows:
        hashes[row["sha256"]].append(row["image_path"])
    report = {"classes": dict(Counter(row["label"] for row in rows)), "total": len(rows),
        "unique_image_hashes": len(hashes),
        "exact_duplicate_groups": [names for names in hashes.values() if len(names) > 1],
        "conflicting_label_groups": [[row["image_path"] for row in rows if row["sha256"] == sha] for sha in hashes if len({row["label"] for row in rows if row["sha256"] == sha}) > 1],
        "review_required": True, "physical_sample_identity_inferred": False,
        "limitations": ["Filename suggestions are not verified physical sample IDs.",
          "Hash checks detect exact duplicates only. Review resized copies, bursts and repeated physical samples together.",
          "Folder labels are provisional, not laboratory confirmation of mold."]}
    conflicts = [row for row in rows if len({item["label"] for item in rows if item["sha256"] == row["sha256"]}) > 1]
    with (output / "label_conflicts.csv").open("w", newline="", encoding="utf-8") as stream:
        writer=csv.DictWriter(stream,fieldnames=FIELDS);writer.writeheader();writer.writerows(conflicts)
    (output / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report

def load_reviewed(manifest, root):
    root = Path(root).resolve()
    with Path(manifest).open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if not rows:
        raise ValueError("Manifest is empty.")
    hashes = {}
    for row in rows:
        if row.get("label") not in LABELS.values() or row.get("label_verified", "").lower() != "true":
            raise ValueError("Every label must be reviewed and label_verified=true.")
        if not row.get("sample_id", "").strip():
            raise ValueError("Every photo needs a verified physical sample_id; timestamps are not sample IDs.")
        path = (root / row["image_path"]).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            raise ValueError("Invalid or missing image path.")
        actual = digest(path)
        if row.get("sha256") and row["sha256"] != actual:
            raise ValueError("Image changed since review; re-audit/review it.")
        row["sha256"] = actual
        if actual in hashes:
            raise ValueError("Exact duplicate images found. Deduplicate the manifest before training.")
        hashes[actual] = row
        row["sample_id"] = row["sample_id"].strip()
    return rows

def split_groups(rows, seed=381):
    groups = defaultdict(list)
    for row in rows:
        groups[row["sample_id"]].append(row)
    classes = sorted(set(row["label"] for row in rows))
    if len(classes) != 2:
        raise ValueError("This prototype requires both reviewed condition classes.")
    for label in classes:
        if sum(any(row["label"] == label for row in group) for group in groups.values()) < 3:
            raise ValueError(f"{label}: need at least three independent physical samples for train/validation/test. More are strongly recommended.")
    rng, keys, best, best_loss = random.Random(seed), sorted(groups), None, float("inf")
    totals = Counter(row["label"] for row in rows)
    # Search whole-sample assignments, never split a sample's photos across subsets.
    for _ in range(4000):
        rng.shuffle(keys)
        minimum = 1 if any({row["label"] for row in group} == set(classes) for group in groups.values()) else len(classes)
        n_test, n_val = max(minimum, round(len(keys)*.15)), max(minimum, round(len(keys)*.15))
        subsets = [keys[n_test+n_val:], keys[n_test:n_test+n_val], keys[:n_test]]
        candidates = [[row for key in subset for row in groups[key]] for subset in subsets]
        counts = [Counter(row["label"] for row in subset) for subset in candidates]
        if any(not count[label] for count in counts for label in classes):
            continue
        loss = sum(abs(count[label]/totals[label]-fraction) for count, fraction in zip(counts,[.7,.15,.15]) for label in classes)
        if loss < best_loss:
            best, best_loss = candidates, loss
    if best is None:
        raise ValueError("Cannot construct class-covered group splits. Collect more independent samples.")
    return dict(zip(["train","validation","test"],best))

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--root", required=True); parser.add_argument("--output", required=True)
    args=parser.parse_args(); print(json.dumps(audit(args.root,args.output),indent=2))

if __name__ == "__main__": main()

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from make_splits import split_groups  # noqa: E402


def _inventory(n_groups=40, per_group=5):
    classes = ["good", "discolored", "physical_damage", "suspected_surface_growth"]
    rows = [{"sample_id": f"S{g:03d}", "label": classes[g % 4], "image_id": f"I{g}-{k}"}
            for g in range(n_groups) for k in range(per_group)]
    return pd.DataFrame(rows)


def test_every_sample_in_exactly_one_partition():
    df = _inventory()
    df["split"] = df["sample_id"].map(split_groups(df, "sample_id", seed=1))
    assert df["split"].notna().all()
    assert (df.groupby("sample_id")["split"].nunique() == 1).all()


def test_split_is_reproducible_and_seed_sensitive():
    df = _inventory()
    assert split_groups(df, "sample_id", 7) == split_groups(df, "sample_id", 7)
    assert split_groups(df, "sample_id", 7) != split_groups(df, "sample_id", 8)


def test_all_partitions_get_every_class_when_enough_samples():
    df = _inventory()
    df["split"] = df["sample_id"].map(split_groups(df, "sample_id", seed=3))
    assert df.groupby("split")["label"].nunique().eq(4).all()

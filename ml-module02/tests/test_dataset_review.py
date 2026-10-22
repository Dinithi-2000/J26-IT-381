import csv
import tempfile
import unittest
from pathlib import Path
from cinnasense_quality.dataset import audit,load_reviewed,split_groups,FIELDS
from cinnasense_quality.inference import Classifier,ModelUnavailable

class DatasetTests(unittest.TestCase):
    def test_audit_reports_conflicting_duplicates_without_deleting_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/"photos"
            for name in ["Good_quality","Suspected_Mold"]:
                (root/name).mkdir(parents=True);(root/name/"same.jpg").write_bytes(b"identical")
            report=audit(root,Path(directory)/"audit")
            self.assertEqual(report["total"],2);self.assertEqual(report["unique_image_hashes"],1)
            self.assertEqual(len(report["conflicting_label_groups"]),1)
            self.assertEqual(len(list(root.rglob("*.jpg"))),2)
            with self.assertRaisesRegex(ValueError,"reviewed"):
                load_reviewed(Path(directory)/"audit/review_manifest.csv",root)
            with self.assertRaisesRegex(ValueError,"already exists"):audit(root,Path(directory)/"audit")
    def test_reviewed_manifest_rejects_missing_groups_changed_files_and_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/"photo.jpg").write_bytes(b"image")
            manifest=root/"manifest.csv"
            def save(rows):
                with manifest.open("w",newline="") as stream:
                    writer=csv.DictWriter(stream,fieldnames=FIELDS);writer.writeheader();writer.writerows(rows)
            row=dict(image_path="photo.jpg",label="Good Quality",label_verified="true",sample_id="",suggested_sample_id="",sha256="")
            save([row])
            with self.assertRaisesRegex(ValueError,"physical sample_id"):load_reviewed(manifest,root)
            row["sample_id"]="CIN001";row["sha256"]="wrong";save([row])
            with self.assertRaisesRegex(ValueError,"changed"):load_reviewed(manifest,root)
            row["sha256"]="";save([row,row])
            with self.assertRaisesRegex(ValueError,"duplicate"):load_reviewed(manifest,root)
            row["image_path"]="../outside.jpg";save([row])
            with self.assertRaisesRegex(ValueError,"Invalid"):load_reviewed(manifest,root)
    def test_splits_are_reproducible_class_covered_and_sample_disjoint(self):
        rows=[{"label":label,"sample_id":f"{label}-{i}","image_path":f"{label}-{i}-{view}.jpg"} for label in ["Good Quality","Suspected Mold"] for i in range(12) for view in range(3)]
        splits=split_groups(rows)
        self.assertEqual(splits,split_groups(rows))
        sets=[{row["sample_id"] for row in subset} for subset in splits.values()]
        self.assertFalse(sets[0]&sets[1] or sets[0]&sets[2] or sets[1]&sets[2])
        for subset in splits.values():self.assertEqual({row["label"] for row in subset},{"Good Quality","Suspected Mold"})
        self.assertEqual(sum(len(part) for part in splits.values()),len(rows))
    def test_insufficient_independent_samples_cannot_train(self):
        with self.assertRaisesRegex(ValueError,"independent"):
            split_groups([{"sample_id":"one","label":"Good Quality"},{"sample_id":"two","label":"Suspected Mold"}])
    def test_absent_artifact_has_no_fabricated_predictions(self):
        with tempfile.TemporaryDirectory() as directory:
            classifier=Classifier(directory)
            with self.assertRaises(ModelUnavailable):classifier.load()
            with self.assertRaises(ModelUnavailable):classifier.predict(b"image")
            self.assertIsNone(classifier.model)

if __name__=="__main__":unittest.main()

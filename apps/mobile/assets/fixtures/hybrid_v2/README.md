# Optional real Colab fixtures

No full-probability fixtures are available yet. This directory intentionally has
no invented predictions. Export one case with tool/export_hybrid_colab_fixture.py
in Colab, then copy its files directly into this directory.

Run:
```
flutter test integration_test/hybrid_model_device_test.dart -d DEVICE_ID --dart-define=HYBRID_FIXTURE_ASSET=assets/fixtures/hybrid_v2/manifest.json
```

The test verifies the exact model hash, class order, normalization, preprocessing
tensors, and all seven probabilities. Without the dart-define, that comparison is
explicitly skipped. The default probability absolute tolerance is 1e-4; it is a
test bound, not a measured equivalence claim. Investigate failures instead of
silently relaxing it. The host synthetic Pillow fixtures test preprocessing only.

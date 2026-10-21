# QuillGrade Mobile App

QuillGrade is a Flutter mobile application for Ceylon cinnamon measurement and assisted grading. It provides an offline-first architecture for capturing photos, analyzing dimensions locally via OpenCV, running a TFLite model to estimate grades, and syncing the structured results to Firebase Firestore when connectivity is restored.

## Getting Started

1. Ensure you have Flutter installed (version 3.13.4+).
2. Run `flutter pub get` to install dependencies.
3. To test the app, run `flutter run` on an Android Emulator or physical device.

## Architecture & Stack
- **UI Framework**: Flutter (Material 3)
- **State Management**: Riverpod (`flutter_riverpod`)
- **Navigation**: GoRouter
- **Local Database**: SQLite via Drift (`drift`, `sqlite3_flutter_libs`)
- **Background Sync**: Android WorkManager (`workmanager`)
- **Cloud Database**: Firebase Firestore & Storage
- **Machine Learning**: `tflite_flutter` (stubbed pending model drop-in)

## Machine Learning Integration (Pending)
To complete the OpenCV and TFLite implementation:
1. Open `lib/core/services/ml_service.dart`.
2. Replace the `mockWidth` and `mockHeight` variables by integrating your OpenCV Dart FFI logic on the captured `_endImage`.
3. Drop your compiled `.tflite` model into `assets/models/` and uncomment the `Interpreter.fromAsset` lines inside the `initializeModel` method.

## Running Tests
Unit tests focus on the offline persistence layer.
```bash
flutter test
```

# QuillGrade System Architecture

## Overview
QuillGrade is designed as an offline-first mobile application tailored for agricultural field work where connectivity is unreliable. The core purpose is to digitize and automate the measurement and grading of Ceylon cinnamon.

## Key Constraints
1. **Offline-First:** Field agents must be able to capture photos and perform analysis entirely offline.
2. **Deterministic Grading:** A custom OpenCV bounding-box script alongside a TFLite model is used for local assessment.
3. **Data Integrity:** SQLite is the single source of truth locally. Firebase Firestore acts strictly as a sync destination for aggregation, not a live datastore.

## Component Breakdown

### 1. Presentation Layer (Flutter/Riverpod)
- All UI routes and logic reside in `apps/mobile/lib/features`.
- Global state such as Authentication and Settings is managed via `Riverpod` in `apps/mobile/lib/core`.
- The onboarding flow is persisted locally using `SharedPreferences`.

### 2. Machine Learning Layer (`ml_service.dart`)
- Acts as a bridge between Flutter and native analysis tools.
- Expected to invoke a Dart FFI wrapper for OpenCV dimension measurements on the end-view cut.
- Expected to load a TFLite classification model to analyze the side-view appearance.

### 3. Data Persistence Layer (Drift / SQLite)
- Housed in `apps/mobile/lib/core/database`.
- Primary storage for captured measurements, local image paths, and timestamp metadata.
- Allows fully isolated testing using `NativeDatabase.memory()`.

### 4. Synchronization Layer (WorkManager)
- Driven by `apps/mobile/lib/core/sync/sync_manager.dart`.
- Checks for pending SQLite records flagged with `isSynced = false`.
- Connects to Firebase Firestore (`firebase/firestore.rules`) securely using the device's Auth token and uploads JSON representations of the data when a network is available.

## Future ML Integration Steps
The `ml/` and `firebase/` folders in the root repository are meant to store the training scripts and backend deployment configurations. Before full launch:
1. Train the grading model in `ml/`.
2. Convert it to `.tflite`.
3. Drop the asset into `apps/mobile/assets/models/`.
4. Deploy the rules using `firebase deploy --only firestore,storage`.

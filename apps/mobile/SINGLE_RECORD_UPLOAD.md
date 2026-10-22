# Step 8: explicit single-record metadata upload

This implementation adds a debug-only action at **Settings → Upload one sample
(DEV)**. It does not use SyncManager, Firestore, Workmanager, a queue, or automatic
retries. Use this action for Step 8; the older sync dashboard is not part of this
flow.

## Run on Android

Use the same backend origin that passed the auth-check diagnostic. Both dialogs
now share the `BACKEND_BASE_URL` configuration and an address edited in either
dialog is retained for the current app session. For USB development, explicitly
configure ADB reverse before using loopback:

```powershell
adb reverse tcp:5000 tcp:5000
adb reverse --list
flutter run --debug --dart-define=BACKEND_BASE_URL=http://127.0.0.1:5000 --dart-define=BACKEND_ADB_REVERSE=true
```

Alternatively use a reachable LAN origin with `BACKEND_BASE_URL`; the reverse
flag is unnecessary for LAN addresses. Use the existing backend and its Firebase
Admin/MongoDB configuration. No secrets or tokens belong in these commands.

1. Sign in with the real inspector account.
2. Open **Upload one sample (DEV)** and check the backend address.
3. Select one eligible record, then tap **Review one upload**.
4. Check the display ID and revision, then tap **Confirm one upload**.
5. Stop after that single upload and inspect its result.

Opening the dialog, selecting a row, or cancelling confirmation sends no upload.
Only owned, unsynced, supported records with valid stored grading metadata are
eligible. Records belonging to `demo-inspector-1`, `inspector-1`, or another
account are never migrated or reassigned. If no eligible records exist, sign in
and capture a new record through the existing capture flow; do not edit ownership.

## Mapping and acknowledgment

`mapGradingUpload` preserves the SQLite UUID, display ID, authenticated owner,
grade, model version, capture instant, revision, and available measurement data.
It sends `modelProbability` unchanged in 0–1 units. The backend performs the sole
percentage conversion, including its existing one-decimal rounding. A 4-Class
record may have no diameter; a 7-Class record must have one. Missing confidence
or unsupported metadata makes a record ineligible. No full probability vector,
photo URL, storage key, or local file path is fabricated or uploaded.

The service refreshes the Firebase ID token, checks ownership again, then sends
one `POST /api/grading/sync`. Redirects and concurrent uploads are rejected. Only
HTTP 200/201 with an acknowledged receipt matching UUID, display ID, owner, and
revision can succeed. The receipt must contain a valid UTC server timestamp;
the client never substitutes its own current time.

Before acknowledging locally, a SQLite transaction compares the complete current
row with the selected snapshot and rechecks the account. Only `isSynced` and
`serverReceiptTime` are written. No schema, capture data, model data, photo paths,
or photo files are changed. No sync jobs are created.

## Failure and remaining limitations

- HTTP errors, invalid receipts, lost connections, and timeouts leave the selected
  record pending. A timeout can occur after MongoDB has saved it. Retry the same
  UUID and revision explicitly; the existing backend returns its original receipt.
- A changed account or edited local snapshot prevents acknowledgment. Reload
  and investigate before retrying. The existing backend's idempotency contract
  identifies content by UUID and revision, not a payload hash; future editing
  workflows must advance revision when metadata changes.
- The existing SQLite DateTime column retains seconds, so fractional milliseconds
  in the validated server timestamp are not retained locally. No schema change
  was made.
- The backend's optional organization field is not fabricated by this mapper.
  Organization stamping and dashboard visibility are outside this step.
- Local HTTP over ADB/LAN uses the existing debug configuration. Use a trusted
  development connection; remote deployments should use HTTPS.
- The legacy sync dashboard remains separate and unchanged. It is not the route
  for this first upload.

## Verification status

Tests exercise both model contracts, null diameter, cross-owner and legacy-owner
rejection, fresh token retrieval, one-row acknowledgment, exact receipt matching,
HTTP errors, offline failure, timeout, duplicate retry, in-flight exclusion,
account changes, concurrent local edits, and explicit UI confirmation/cancellation.
Identical JSON fixtures are checked by Flutter's mapper and Express ingestion
tests; each repository retains its own copy so its tests can run independently.
Backend tests use isolated in-memory model fixtures; they are not proof of real
MongoDB persistence.

Verification completed: `flutter analyze --no-pub` reported no issues,
`flutter test --no-pub` passed all 302 tests, and `npm.cmd test` passed all 90
backend tests.

During implementation a physical Android device was connected and port 5000 was
listening. **No real upload was initiated and no real MongoDB acknowledgment was
verified.** The new code has not been installed or exercised on that phone during
this task. Complete the explicit on-device confirmation flow to verify persistence.

## Files changed in Step 8

Under `mobile/apps/mobile/`:

- `lib/core/database/repositories/sample_repository.dart`
- `lib/core/services/auth_service.dart`
- `lib/core/services/backend_connection.dart`
- `lib/core/sync/grading_upload_mapper.dart`
- `lib/core/sync/single_sample_upload_service.dart`
- `lib/features/settings/settings_screen.dart`
- `lib/features/settings/single_sample_upload_dialog.dart`
- `test/fixtures/grading_upload.json`
- `test/single_sample_upload_test.dart`
- `test/single_sample_upload_dialog_test.dart`
- `SINGLE_RECORD_UPLOAD.md`

Under `webdashboard/server/`:

- `test/gradingApi.test.js`
- `test/fixtures/mobileGradingUpload.json`

No backend production code changed in Step 8. Earlier workspace modifications
were retained. No commit, push, deployment, role/rule change, or automatic sync
was performed.

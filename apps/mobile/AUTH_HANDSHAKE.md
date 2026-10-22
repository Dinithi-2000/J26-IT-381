# Step 6: read-only Android authentication check

In a **debug build**, open Settings → Backend Handshake Diagnostic. Sign in with
the real Firebase inspector account first. Press **Test Handshake** once. The
diagnostic refreshes the Firebase ID token and sends only
`GET /api/grading/auth-check`. It never calls the grading sync endpoint.

The Express route requires Firebase verification (including revocation checking)
and the inspector role. HS256 and anonymous tokens are rejected. Its successful
response contains only:

```json
{"authenticated":true,"role":"inspector","organization":{"verified":true}}
```

`organization.verified` means the trusted identity belongs to `matara-plant-01`.
Missing or different organizations return `false`, which the mobile diagnostic
treats as a failure. No UID, email, token, or organization identifier is returned.

## Backend and phone configuration

Use the existing Firebase Admin configuration in `webdashboard/server/.env`.
Do not enable legacy HMAC authentication or change Firebase claims for this check.
Start the existing backend from `webdashboard/server` with `npm.cmd start`.
The configured `PORT` defaults to `5000`.

With the phone and backend PC on the same trusted Wi-Fi network, launch from
`mobile/apps/mobile`, replacing the example IP with the PC's reachable LAN IP:

```powershell
flutter run --debug --dart-define=BACKEND_BASE_URL=http://192.168.1.10:5000
```

The dialog also accepts a backend origin URL, so the address can be changed
without rebuilding. No default loopback address is provided. Use HTTPS for a
remote backend. Local cleartext HTTP is enabled in the Android debug manifest
only; release builds do not expose or execute this diagnostic.

For an explicitly configured USB connection instead:

```powershell
adb devices
adb reverse tcp:5000 tcp:5000
adb reverse --list
flutter run --debug --dart-define=BACKEND_BASE_URL=http://127.0.0.1:5000 --dart-define=BACKEND_ADB_REVERSE=true
```

Set the reverse flag only after the mapping is configured for the connected
device. Loopback URLs are otherwise rejected. The flag does not create the
mapping itself. Remove the temporary mapping afterward with
`adb reverse --remove tcp:5000`.

## Evidence and limitations

A real handshake requires an on-device **STATUS: PASS**, category `passed`,
HTTP `200`, and the corresponding backend GET access log. Never copy tokens,
Firebase claims, account screens, or full device logs into a report. Automated
tests use fixture tokens and a mocked Firebase Admin verifier; their PASS does
not establish a real Android-to-Express handshake.

During this implementation ADB reported no connected devices and no backend
listener was found on port 5000. The real handshake is **pending**.

Run automated checks with `flutter analyze --no-pub`, `flutter test --no-pub`,
and (from `webdashboard/server`) `npm.cmd test`. Existing backend regression
tests exercise POST routes against isolated in-memory fixtures; they do not
write real grading records. The new handshake tests send GET requests only and
forbid grading model access.

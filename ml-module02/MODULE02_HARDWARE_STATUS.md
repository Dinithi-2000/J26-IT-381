# Module 02 hardware status

The Module 02 provider owns one five-second polling loop for the selected cinnamon
record. It calls the existing GET `/api/module-02/readings/latest?sampleId=...`.
No backend endpoints, database schemas, authentication, firmware or models change.
Module 01 was inspected only for its sidebar styling.

## Status rules

- Before the first response: **Checking**.
- **ESP32-S3 Connected** requires `dataOrigin: REAL_SENSOR`, exact device ID
  `ESP32S3-WEIGHT-01`, the selected sample ID, and valid recent `recordedAt` AND
  `createdAt` timestamps. Future timestamps never establish connectivity.
- **HX711 Load Cell Online** additionally requires `sensorStatus.weight: online`
  and a finite, in-range measured weight.
- RGB remains **Offline** without recent genuine color status, display RGB and raw
  RGBC evidence. Illustrative RGB values cannot make it online.
- Once either timestamp exceeds the freshness threshold, previously genuine
  telemetry becomes **Stale**. API failures show **Disconnected** because the
  connection cannot be verified, while retaining the last known real weight.
- Missing, illustrative, mismatched-device or mismatched-sample readings cannot
  produce Connected. A successful GET or working Wi-Fi alone is insufficient.

Connected describes recent accepted device telemetry, not a continuous socket or
proof that hardware remains powered at this instant. Capture/receipt age is never
reset simply because an API request succeeds.

## Configurable freshness

The existing latest-reading response supplies `deviceStatus.offlineAfterSeconds`.
That value comes from **`MODULE02_OFFLINE_SECONDS` in `server/.env`**, currently
300 seconds. For example, to use 60 seconds, set that existing value to 60 and
restart Node; no frontend configuration or secret is required. This task leaves
the current configuration unchanged. Invalid/missing thresholds fall back to 300.
The status is reevaluated on the five-second polling cadence.

Each telemetry request has a 4.5-second timeout. Requests do not overlap. Selection
changes abort old work and clear the previous selection's status. Late responses
cannot replace the new selection. Unmounting removes all timers and pending work.
Historical measurements remain available during a telemetry API outage.

## Verify with your physical device

1. Start the existing Node backend and frontend, then open
   **http://localhost:5173/module-02**.
2. Register/select a genuine cinnamon record. The three illustrative records do
   not establish hardware connectivity. Configure that actual record ID in the
   ESP32's private `secrets.h`.
3. Upload/start the HX711 firmware and complete its genuine tare/reference-check
   procedure. Arm its 15-second uploads using `S`.
4. Confirm **HTTP 201** in Serial Monitor. In Atlas `test.module02_sensor_readings`,
   verify the actual `measurementId`, device ID, raw counts, `REAL_SENSOR` origin,
   calculated `weightGrams` and real timestamps. Do not insert fake test readings.
5. Within roughly five seconds of acceptance, the selected record should show
   **ESP32-S3 Connected**, **HX711 Load Cell Online**, **RGB Sensor Offline**,
   the latest real weight and measurement time. Polled observations also update
   the overview's weight/history display without a full-page refresh.
6. Stop transmissions or power off the ESP32. The panel remains fresh only until
   the configured threshold expires, then shows **Stale** on the next check.
7. Switch to an illustrative record: it must show Disconnected and no real weight.
   Switch back; the poller checks that selected record independently. An API outage
   must never leave a green Connected indication.

The frontend retains the most recent 200 loaded/polled observations. A manual
Refresh stored records loads history again, including captures missed while the
page was closed or offline. Model 02 inputs retain their own explicit refresh and
prediction flow; weight connectivity does not supply missing environmental/RGB data.

## Software verification

```powershell
node --test client/test/module02-telemetry.test.js
npm test --workspace client
npm run build --workspace client
```

Polling/connection tests use local mocks and a deterministic clock. They do not
create records in Atlas. Physical acceptance must be verified separately with the
actual device as above; software tests alone do not establish a hardware connection.

Verified for this change: 8 telemetry tests plus 31 frontend tests passed, and
the frontend build passed. A live browser using the actual Atlas-backed API
confirmed five-second polling, selected-record cleanup and no further polling
after leaving Module 02. All three current records were illustrative, so the
browser correctly showed ESP32-S3 Disconnected, HX711 Offline and RGB Offline.
No production measurements were inserted to simulate a hardware connection.

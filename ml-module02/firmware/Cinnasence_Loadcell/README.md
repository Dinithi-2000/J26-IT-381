# Module 02: ESP32-S3 HX711 + LCD upload

**Status: firmware prepared; genuine hardware-to-Atlas acceptance is not yet
verified.** No board has been flashed by this task. Compilation and local
contract tests are software checks, not physical calibration evidence.

Verified software results: ESP32-S3 compilation passed with the installed 3.3.12
core and explicit Bogde driver (988,153 bytes flash; 47,760 bytes static RAM).
The build used dummy credentials in a private, ignored build copy: **do not flash
that verification binary**. Compile/upload the source with your own `secrets.h`.
Two firmware contract tests and eight existing sensor tests passed; two opt-in
database/live-service tests were skipped. No measurements were sent to Atlas.

This is an extension of the owner's supplied working `Cinnasence_Loadcell.ino`.
The original external sketch is untouched. Pins and normal display are retained:

| Part | Configuration |
| --- | --- |
| Board | ESP32-S3 Dev Module |
| HX711 | Bogde HX711; DT 16, SCK 17 |
| LCD | 16x2, address 0x27; SDA 8, SCL 9 |
| Scale factor | **-204.7352** signed counts/gram, unchanged |
| Reference mass | **112.0 g**, physically required for the reference check |
| Backend | `http://172.20.10.3:5000` |
| Upload | `POST /api/module-02/readings`, every 15 seconds when armed |
| Device | `ESP32S3-WEIGHT-01` |

## 1. Prepare private configuration

1. Open this folder and copy `secrets.example.h` to **`secrets.h`** beside the
   `.ino`. The folder's `.gitignore` excludes that exact file.
2. Fill in your existing hotspot name/password. Privately copy the device key
   for `ESP32S3-WEIGHT-01` from `server/.env` into `DEVICE_KEY`. Do not use an
   operator or Python service token. Do not share a screenshot of either file.
3. Set `SAMPLE_ID` to an **actual registered, non-archived cinnamon record**.
   Use the existing Cinnamon records page to register the actual group first,
   with its true storage start date and measured initial combined weight. Do
   not use `CIN-*` or other illustrative records. Nothing registers a record
   automatically, and this template deliberately supplies no invented ID.
4. Keep `BACKEND_URL` as shown while your laptop has IP 172.20.10.3. It is the
   laptop address, not the ESP32 address (172.20.10.7). Update it if DHCP changes.

Before sharing code, run from the project root:

```powershell
git check-ignore ml-module02/firmware/Cinnasence_Loadcell/secrets.h
git ls-files ml-module02/firmware/Cinnasence_Loadcell/secrets.h
```

The first command should print the ignored path; the second should print nothing.
No live `secrets.h` is included in this deliverable. Arduino build outputs contain
configured credentials: keep them private too. HTTP is plain text on the local
hotspot; do not expose this endpoint to the public internet.

## 2. Upload with Arduino IDE

1. Keep a copy of your original working external sketch.
2. Open this folder's **`Cinnasence_Loadcell.ino`** in Arduino IDE.
3. Select **ESP32S3 Dev Module** and the correct USB COM port. Retain the USB CDC,
   flash and other board settings that worked with your original sketch. Set
   **Core Debug Level: None** so library debug logging cannot print HTTP headers. If the
   serial port is missing, check the data-capable USB cable and your board's
   established USB CDC setting.
4. Use **HX711 Arduino Library by Bogdan Necula / Bogde**, plus your existing
   `LiquidCrystal_I2C` library. No ArduinoJson installation is needed: JSON uses
   the ESP32 core's bundled cJSON. This build targets the installed ESP32 core
   3.3.12.
5. Click **Verify**, then **Upload**. Open Serial Monitor at **115200 baud**.

Both Bogde and Rob Tillaart HX711 libraries are installed on this laptop. If
Arduino chooses the wrong HX711, compile with the explicit Bogde library path
below, or resolve the duplicate in your local Arduino installation. Do not
change the sketch to use a different driver. The LCD library declares AVR
compatibility and emits a warning; physical ESP32 behavior must still be tested
with the library that already worked on your board.

## 3. Genuine tare and reference check — required after each reset

Serial commands are single letters; a newline is optional.

1. Start with the **empty tray**. Boot preserves the original 3-second automatic
   tare prompt, then records 20 actual HX711 counts and sets the integer mean as
   the tare offset. Network tasks run independently.
2. Wait for **`[TIME] NTP synchronized`**. If boot tare happened before time was
   available, its timestamp is deliberately left unknown. Empty the tray and
   send **`T`** again. This records a genuine new `tareRaw` and `tareAt`; it does
   not backdate the boot tare.
3. Place **only your actual 112.0 g reference mass** on the tray, allow it to
   settle, then send **`C`**. The next stable 10-count window is checked against
   the reference using the unchanged -204.7352 factor. A successful check records
   its actual synchronized UTC completion time.
4. Remove the reference mass. Place the four cinnamon quills belonging to the
   configured registered record. Send **`S`** to arm uploads. The first capture
   is queued after 15 seconds. Weight is the combined total of all four quills.
5. Send **`P`** to pause. The LCD keeps displaying weight. Sending **`T`** resets
   calibration readiness and requires a fresh `C` check and `S` afterward.

This is a **new, dated reference verification of the existing factor**, not a
claim about the unknown original calibration date. `calibratedAt` records that
current check and `protocol` explicitly says `reference-check-fixed-factor`.
The default 0.5 g window-spread threshold and +/-1.0 g reference-check tolerance
are prototype acceptance settings, not independently validated precision.

If the reference check fails, **uploads remain disabled**. Repeat the empty-tray
tare and reference check with correct placement. If it still fails, perform a
real calibration: capture stable empty and known-112g raw windows, calculate
`(meanReferenceRaw - tareRaw) / 112.0`, and independently check the result with
known masses. Do not substitute a fake date or force the check to pass. Changing
the active factor requires a separate reviewed calibration change; this firmware
deliberately retains the factor you specified.

Every reboot requires this procedure again; calibration is not silently restored
from an assumed historical date. A pending HTTP request already in flight may
complete when you press pause; records are never deleted as part of pausing.

## 4. What is sent and how failures behave

- Exactly **10 consecutive actual signed ADC counts** per measurement; no
  simulated counts, rounded display grams or zero-clamped weight is sent.
- Body contains `sampleId`, `deviceId`, generated `measurementId`, actual
  `recordedAt`, `dataOrigin: REAL_SENSOR`, `sensorStatus`, `rawWeightSamples`
  and calibration metadata. Signed factor, reference mass, stability threshold,
  actual tare offset and real tare/check timestamps are included.
- Headers are `X-Device-Id` and `X-Device-Key`; credentials are never logged.
- `sensorStatus.color` is `offline`; temperature/humidity are null. RGB fields
  are omitted. Gas is omitted because `realSensor.js` rejects it as an input;
  the backend stores missing RGB, temperature, humidity and gas as null.
- Node calculates `(mean(rawWeightSamples) - tareRaw) / countsPerGram`, preserving
  compatibility with existing weight displays. The original +/-0.2 g display
  clamp is applied only to the LCD/weight text, never to stored measurements.
- The LCD is refreshed every 500 ms. HX711 sampling checks `is_ready()`; HTTP
  runs in a separate FreeRTOS task with 2-second connection and 3-second read
  timeouts. Wi-Fi reconnect attempts occur in the background every 10 seconds.
- The device checks the configured record is active and not `DEMO_DATA` before
  sending. The backend independently enforces existence, archive status and
  storage-start constraints. Keep the board and laptop clocks synchronized:
  this validator rejects any capture time in the future.
- Retries retain the same capture, ID, raw counts and timestamps. A 409 response
  triggers a readback check for a matching saved measurement. Other ordinary
  4xx failures pause uploads; fix the cause and send `S` again (or reflash after
  editing secrets). Temporary failures retry up to five attempts.
- There is one queued capture plus one in-flight capture. Old pending captures
  expire after two minutes. Queue overflow skips new captures; it does not
  fabricate replacement measurements. This is not a lossless offline logger.
- Without Wi-Fi or NTP, the local weight display still works. Without a genuine
  timestamped tare/reference check, uploads stay disabled.

## 5. Verify a real accepted reading — do not skip this

1. Keep the existing Node backend running on port 5000. Check
   `http://172.20.10.3:5000/api/health` from the laptop; database must be connected.
2. After `S`, watch Serial Monitor for **`[HTTP] POST status=201`**, followed by
   **`[UPLOAD] API accepted measurementId=...`**. Record that measurement ID.
3. In Atlas **CinnaSenseCluster -> test -> module02_sensor_readings**, find:

```javascript
{deviceId: "ESP32S3-WEIGHT-01", measurementId: "COPY_THE_ACTUAL_SERIAL_ID"}
```

4. Confirm the correct `sampleId`, `dataOrigin: REAL_SENSOR`, 10 raw counts,
   derived `weightGrams`, actual calibration/tare timestamps and null missing
   sensors. This is the genuine database verification required for success.
5. Open **http://localhost:5173/module-02**, select that cinnamon record, and click
   **Refresh stored records**. Verify total weight, weight chart and history.
   Refresh the browser and load the same record again to verify persistence.
6. Only then describe the ESP32-to-dashboard integration as working. The current
   frontend uses manual refresh; these uploads do not add automatic polling.

A weight-only reading cannot run Model 02, which also needs genuine RGB and
environmental inputs. Do not copy illustrative values to bypass that restriction.

### Common Serial results

| Result | Next action |
| --- | --- |
| Negative HTTP status | Check hotspot, laptop IP, Node listener and firewall; LCD stays active |
| 400 | Check clock, raw stability, metadata and sample storage start; do not fabricate replacements |
| 401 / 503 auth configuration | Check the matching dedicated device key/registry and restart Node if configuration changed |
| 404 / archived record | Use an actual registered, active cinnamon ID |
| 409 | Retry readback must match; an unrelated conflict pauses uploads |
| 503 database unavailable | Restore Atlas connectivity; do not change databases or seed records |
| NTP never synchronizes | Check hotspot internet/UDP time-server access; no invented timestamps are sent |
| HX711 ERROR | Check power/wiring with the original working setup; do not send fake counts |

Do not disable the firewall wholesale. If the ESP32 cannot reach the listener,
allow only the required Node/TCP 5000 inbound traffic on the appropriate network.

## Software checks / optional command-line build

From the project root (requires the installed g++ for the arithmetic test):

```powershell
node --test ml-module02/firmware/tests/weight-contract.test.mjs
```

With your private `secrets.h` configured, optional Arduino CLI compilation:

```powershell
& "$env:LOCALAPPDATA\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile --jobs 1 --fqbn esp32:esp32:esp32s3 --library "$env:USERPROFILE\OneDrive\Documents\Arduino\libraries\HX711_Arduino_Library" --library "$env:USERPROFILE\OneDrive\Documents\Arduino\libraries\LiquidCrystal_I2C" --build-path "state/local-runtime/module02-arduino-build" "ml-module02/firmware/Cinnasence_Loadcell"
```

This project does not automatically upload or flash your ESP32. Installed library
paths may differ on another laptop. API implementation is unchanged in
`server/src/module02/{realSensor,auth,routes,models}.js`.

Primary API references: [Bogde HX711](https://github.com/bogde/HX711),
[Espressif HTTPClient](https://github.com/espressif/arduino-esp32/blob/master/libraries/HTTPClient/src/HTTPClient.h).

## TCS34725 colour sensor (optional)

Install **Adafruit TCS34725** from the Library Manager (it also installs Adafruit BusIO).

| TCS34725 | ESP32-S3 |
| --- | --- |
| VIN | 3.3V |
| GND | GND |
| SDA | GPIO 5 (`COLOR_SDA`, own I²C bus `Wire1`) |
| SCL | GPIO 4 (`COLOR_SCL`) |
| LED | GPIO 6 (`COLOR_LED_PIN`) |

No extra resistors are needed for a module board. Mount the sensor in a fixed holder,
`COLOR_DISTANCE_MM` (default 10 mm) from the quill, under a black cover. The LED is on only
while a reading is taken.

- On boot, Serial shows `[COLOR] TCS34725 found at 0x29.`
- Send **`R`** to print one reading, e.g. `[COLOR] raw R=812 G=566 B=371 C=1350 -> display RGB 153/107/70`.
- Each upload then sends `sensorStatus.color = "online"` with `rgbRaw` and `colorSettings`
  (gain 4x, 153.6 ms, lighting, distance). Node derives display RGB as `channel / clear × 255`.
- If the sensor is missing, too dark or saturated, the weight still uploads with colour offline.
  If `R` reports saturation, lower `COLOR_GAIN` and the matching `TCS34725_GAIN_*` value together.

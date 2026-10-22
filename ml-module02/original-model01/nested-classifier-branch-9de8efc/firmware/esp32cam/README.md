# ESP32-CAM photo uploader (Module 02)

Board: **AI Thinker ESP32-CAM** (OV2640) on its USB programmer base (ESP32-CAM-MB). It photographs a stored cinnamon sample and sends the JPEG to `POST /api/quality/classify`. The server stores the photo and the image model's visible-condition result under the registered sample.

Status: firmware written, not yet verified on hardware.

## 1. Arduino IDE setup (once)

1. Install Arduino IDE 2.
2. In File → Preferences → Additional boards manager URLs, add
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
3. In Tools → Board → Boards Manager, install **esp32 by Espressif Systems**.
4. Plug the ESP32-CAM-MB into USB. If no COM port appears, install the **CH340** USB driver.
5. Select these Tools settings:
   - Board: **AI Thinker ESP32-CAM**
   - Port: the new COM port
   - Partition scheme: Huge APP

## 2. First test: the camera works

1. Open File → Examples → ESP32 → Camera → CameraWebServer.
2. Select `#define CAMERA_MODEL_AI_THINKER` and enter your Wi-Fi details.
3. Upload. If it fails, hold **IO0/BOOT** on the MB board while the upload starts, then press **RST** after it finishes.
4. Open the Serial Monitor at 115200 baud and open the IP address it prints in a browser. You should see live video.

## 3. Upload to CinnaSense

1. On the PC, set `MODULE02_DEVICE_KEYS={"ESP32-CAM-01":"<64-char secret>"}` in `server/.env`, then start `npm run dev:ml` and `npm run dev`.
2. On the website, register the sample (e.g. `CIN-001`).
3. Allow Node.js / port 5000 through Windows Firewall, on private networks only.
4. Copy `esp32cam_uploader/secrets.example.h` to `secrets.h`. Fill in:
   - the Wi-Fi name and password (2.4 GHz)
   - `SERVER_URL` with the PC's IPv4 address from `ipconfig`, e.g. `http://192.168.1.25:5000`
   - the device key
5. Open `esp32cam_uploader.ino`, check `SAMPLE_ID` and `CAPTURE_INTERVAL_MS`, and upload.
6. In the Serial Monitor (115200, Newline), type `c` and press Enter. A good result looks like:

   ```text
   Captured 800x600, 45213 bytes
   Uploaded. Server result: Good quality
   ```

   The photo and result appear on the website under **Image analysis → Screening history**, with source ESP32-CAM.

| Serial message | Fix |
|---|---|
| `Camera init failed` | Reseat the camera ribbon cable (latch closed); check the board type |
| `Wi-Fi failed` | Use a 2.4 GHz network; on an iPhone hotspot enable *Maximize Compatibility* |
| `HTTP -1` / connection refused | Wrong `SERVER_URL`, server not running, or firewall blocking port 5000 |
| `HTTP 401` | `DEVICE_ID`/`DEVICE_KEY` don't match `server/.env` (restart `npm run dev` after editing it) |
| `HTTP 404` | Sample not registered |
| Brownouts / random resets | Use a good USB cable and a 5 V 2 A supply |

## Photo protocol (for the research data)

Keep the camera position, distance, background and lighting identical for every photo of a sample. `USE_FLASH` defaults to off for that reason, so use a fixed lamp instead. Changing the setup between photos makes the image model learn the setup rather than the cinnamon.

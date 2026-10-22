// CinnaSense AI - Module 02: ESP32-CAM (AI Thinker) photo uploader.
//
// Captures a JPEG of the stored cinnamon sample and POSTs it to the Express API:
//   POST http://<server>:5000/api/quality/classify?sampleId=<SAMPLE_ID>
//   headers X-Device-Id / X-Device-Key (must match MODULE02_DEVICE_KEYS in server/.env)
// The server stores the photo and the image model's visible-condition result.
//
// Serial Monitor (115200 baud, "Newline"): type  c  to capture now,  s  for status.
// Wi-Fi credentials and the device key live in secrets.h, which is never committed.

#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "secrets.h"

// ---- Settings ------------------------------------------------------------------------------
const char* DEVICE_ID = "ESP32-CAM-01";       // must be a key in MODULE02_DEVICE_KEYS
const char* SAMPLE_ID = "CIN-001";            // register this sample on the website first
const unsigned long CAPTURE_INTERVAL_MS = 6UL * 60 * 60 * 1000;   // every 6 hours; 0 = only on 'c'
const bool USE_FLASH = false;                 // keep lighting identical between photos
const framesize_t FRAME_SIZE = FRAMESIZE_SVGA; // 800x600; the model downsizes to 640 px anyway
const int JPEG_QUALITY = 10;                  // 0-63, lower = better quality, bigger file

// ---- AI Thinker ESP32-CAM pin map ----------------------------------------------------------
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22
#define FLASH_LED_PIN 4

unsigned long lastCapture = 0;
unsigned long uploadsOk = 0, uploadsFailed = 0;

bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM; config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM; config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM; config.pin_pclk = PCLK_GPIO_NUM; config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM; config.pin_sccb_sda = SIOD_GPIO_NUM; config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM; config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;      // always the newest frame, not a stale buffered one
  if (psramFound()) {
    config.frame_size = FRAME_SIZE; config.jpeg_quality = JPEG_QUALITY; config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    Serial.println("No PSRAM found: using a smaller frame size.");
    config.frame_size = FRAMESIZE_VGA; config.jpeg_quality = 12; config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x (check the ribbon cable and the board type)\n", err);
    return false;
  }
  return true;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting to Wi-Fi \"%s\" (2.4 GHz only)", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print('.'); }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) Serial.printf("Wi-Fi connected, IP %s\n", WiFi.localIP().toString().c_str());
  else Serial.println("Wi-Fi failed: check SSID/password and that the network is 2.4 GHz.");
}

void captureAndUpload() {
  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) { uploadsFailed++; return; }

  if (USE_FLASH) { digitalWrite(FLASH_LED_PIN, HIGH); delay(150); }
  camera_fb_t* stale = esp_camera_fb_get();   // discard one frame so exposure settles
  if (stale) esp_camera_fb_return(stale);
  camera_fb_t* fb = esp_camera_fb_get();
  if (USE_FLASH) digitalWrite(FLASH_LED_PIN, LOW);
  if (!fb) { Serial.println("Capture failed."); uploadsFailed++; return; }
  Serial.printf("Captured %ux%u, %u bytes\n", fb->width, fb->height, fb->len);

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/quality/classify?sampleId=" + SAMPLE_ID;
  http.begin(url);
  http.setTimeout(30000);                      // the model can take a few seconds
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(fb->buf, fb->len);
  String response = http.getString();
  http.end();
  esp_camera_fb_return(fb);

  if (code == 201) {
    uploadsOk++;
    int at = response.indexOf("\"predictedLabel\":\"");
    String label = at >= 0 ? response.substring(at + 18, response.indexOf('"', at + 18)) : "?";
    Serial.printf("Uploaded. Server result: %s\n", label.c_str());
  } else {
    uploadsFailed++;
    Serial.printf("Upload failed: HTTP %d %s\n", code, code < 0 ? http.errorToString(code).c_str() : response.c_str());
    if (code == 401) Serial.println("-> DEVICE_ID/DEVICE_KEY do not match MODULE02_DEVICE_KEYS in server/.env");
    if (code == 404) Serial.println("-> Register the sample on the website first, or fix SAMPLE_ID");
    if (code < 0) Serial.println("-> Server not reachable: check SERVER_URL, that npm run dev is running and the firewall");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nCinnaSense ESP32-CAM uploader");
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  if (!initCamera()) { Serial.println("Restarting in 10 s..."); delay(10000); ESP.restart(); }
  connectWiFi();
  Serial.println("Type 'c' to capture and upload now, 's' for status.");
}

void loop() {
  if (Serial.available()) {
    char command = Serial.read();
    if (command == 'c') captureAndUpload();
    if (command == 's') Serial.printf("Wi-Fi %s | uploads ok %lu, failed %lu | free heap %u\n",
                                      WiFi.status() == WL_CONNECTED ? "connected" : "offline",
                                      uploadsOk, uploadsFailed, ESP.getFreeHeap());
  }
  if (CAPTURE_INTERVAL_MS > 0 && (lastCapture == 0 || millis() - lastCapture >= CAPTURE_INTERVAL_MS)) {
    lastCapture = millis() | 1;   // never 0 after the first capture
    captureAndUpload();
  }
  delay(20);
}

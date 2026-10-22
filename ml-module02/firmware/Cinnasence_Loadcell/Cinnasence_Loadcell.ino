// Based on the owner's original working Cinnasence_Loadcell.ino.
// LCD pins, messages, automatic 20-reading tare and fixed factor are preserved.
// HTTP runs in a separate FreeRTOS task. Only loop() owns the HX711 and LCD.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "HX711.h" // Bogde HX711, not Rob Tillaart HX711
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_system.h>
#include <esp_sntp.h>
#include <cJSON.h> // bundled with the ESP32 core; no ArduinoJson dependency
#include <Adafruit_TCS34725.h> // Library Manager: "Adafruit TCS34725"
#include <DHT.h>               // Library Manager: "DHT sensor library" (Adafruit)
#include <atomic>
#include <time.h>
#include <math.h>
#include "WeightCapture.h"
#include "secrets.h"

#define LCD_SDA 8
#define LCD_SCL 9
#define HX711_DT 16
#define HX711_SCK 17
// TCS34725 colour sensor on its own I2C bus (Wire1), separate from the LCD.
#define COLOR_SDA 5
#define COLOR_SCL 4
#define COLOR_LED_PIN 6 // TCS34725 LED pin; on only while a colour reading is taken
#define DHT_PIN 7       // DHT11 DATA pin (temperature + humidity)

LiquidCrystal_I2C lcd(0x27, 16, 2);
HX711 scale;
constexpr char DEVICE_ID[] = "ESP32S3-WEIGHT-01";
constexpr uint32_t UPLOAD_INTERVAL_MS = 15000;
constexpr uint32_t MAX_PENDING_AGE_MS = 120000;
constexpr uint32_t SENSOR_GAP_MS = 1500;
constexpr char CALIBRATION_PROTOCOL[] = "HX711-112g-reference-check-fixed-factor-v1";
// TCS34725 settings sent with every colour reading (the server validates them).
constexpr uint8_t COLOR_GAIN = 4;                 // 1, 4, 16 or 60
constexpr double COLOR_INTEGRATION_MS = 153.6;    // matches TCS34725_INTEGRATIONTIME_154MS
constexpr double COLOR_DISTANCE_MM = 10;          // fixed sensor-to-quill distance of your holder
constexpr char COLOR_LIGHTING[] = "TCS34725 onboard LED, black cover";
Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_4X);
bool colorSensorReady = false;
DHT dht(DHT_PIN, DHT11);
constexpr uint32_t DHT_MIN_INTERVAL_MS = 2000; // DHT11 needs ~1 s between reads
uint32_t lastEnvMillis = 0;
float lastTemperature = NAN, lastHumidity = NAN;

struct Measurement {
  int32_t raw[CAPTURE_SAMPLES];
  int32_t tareRaw;
  time_t recordedAt, tareAt, calibratedAt;
  uint32_t capturedMillis, generation;
  bool colorOk;
  bool envOk;
  float temperatureC, humidity;
  time_t envMeasuredAt;
  uint16_t red, green, blue, clear;
  char id[56];
};

QueueHandle_t uploadQueue = nullptr;
std::atomic<bool> ntpSynced{false}, uploadsEnabled{false};
std::atomic<uint32_t> generation{0};
bool configurationReady = false, sensorConnected = false, tareInProgress = true;
bool tareReady = false, calibrationReady = false, referenceRequested = false;
int32_t tareRaw = 0, tareSamples[TARE_SAMPLES], windowSamples[CAPTURE_SAMPLES];
size_t tareCount = 0, windowCount = 0;
time_t tareAt = 0, calibratedAt = 0;
uint32_t tareStarted = 0, lastRawMillis = 0, lastDisplay = 0, lastCapture = 0;
uint32_t measurementSequence = 0;
double displayedWeight = 0;
// Serial weight lines only when the value changes or every 10 s, so command output stays readable.
double lastPrintedWeight = NAN;
uint32_t lastWeightPrint = 0;
bool hasDisplayWeight = false;
char bootId[33];

bool validId(const char* id) {
  const size_t length = strlen(id);
  if (length < 2 || length > 64 || !isalnum(static_cast<unsigned char>(id[0]))) return false;
  for (size_t i = 0; i < length; ++i)
    if (!isalnum(static_cast<unsigned char>(id[i])) && id[i] != '-' && id[i] != '_') return false;
  return true;
}

bool clockReady() {
  // NTP callback, not just a plausible boot-time clock, authorizes timestamps.
  return ntpSynced.load() && time(nullptr) >= 1704067200;
}

void timeAvailable(struct timeval*) { ntpSynced.store(true); }

String isoTime(time_t timestamp) {
  struct tm utc;
  gmtime_r(&timestamp, &utc);
  char result[25];
  strftime(result, sizeof(result), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(result);
}

void invalidatePending() {
  uploadsEnabled.store(false);
  generation.fetch_add(1);
  if (uploadQueue) xQueueReset(uploadQueue);
}

void startTare() {
  invalidatePending();
  tareReady = calibrationReady = referenceRequested = false;
  tareAt = calibratedAt = 0;
  tareInProgress = true; tareCount = windowCount = 0;
  hasDisplayWeight = false; tareStarted = millis();
  lcd.clear(); lcd.print("Remove Weight");
  lcd.setCursor(0, 1); lcd.print("Taring...");
  Serial.println("[TARE] Empty the tray now. Waiting 3 seconds, then capturing 20 actual raw counts.");
}

// Reads the DHT11. Reuses the last good values if called again within 2 s.
// Diagnostic for the D command: tries the DHT11 on every pin that is safe to probe
// (not used by the LCD, HX711, TCS34725, USB, flash or boot) and reports where it answers.
void scanDht() {
  static const uint8_t pins[] = {1, 2, 7, 10, 11, 12, 13, 14, 15, 18, 21, 38, 39, 40, 41, 42, 47};
  Serial.printf("[SCAN] Looking for the DHT11 (current DHT_PIN = GPIO %d)...\n", DHT_PIN);
  int found = -1;
  for (const uint8_t pin : pins) {
    // A DHT11 module's pull-up resistor holds DATA high even against the weak internal pull-down.
    pinMode(pin, INPUT_PULLDOWN); delay(5);
    const bool pulledUp = digitalRead(pin) == HIGH;
    pinMode(pin, INPUT);
    DHT probe(pin, DHT11);
    probe.begin();
    const float h = probe.readHumidity(true), t = probe.readTemperature();
    pinMode(pin, INPUT);
    if (!isnan(h) && !isnan(t)) {
      Serial.printf("[SCAN] GPIO %2d: DHT11 FOUND -> %.1f C, %.1f %%\n", pin, t, h);
      if (found < 0) found = pin;
    } else if (pulledUp) {
      Serial.printf("[SCAN] GPIO %2d: pulled HIGH but no DHT reply (something is connected here)\n", pin);
    }
    delay(50);
  }
  if (found < 0) Serial.println("[SCAN] No DHT11 answered. Check VCC=3.3V, GND, the DATA wire, and (bare sensor) the 10k pull-up.");
  else if (found != DHT_PIN) Serial.printf("[SCAN] The DHT11 is on GPIO %d, not GPIO %d. Move the DATA wire to GPIO %d, or change DHT_PIN to %d.\n", found, DHT_PIN, DHT_PIN, found);
  else Serial.println("[SCAN] DHT11 is on the correct pin.");
}

bool readEnvironment(float& temperature, float& humidity) {
  const uint32_t now = millis();
  if (!lastEnvMillis || now - lastEnvMillis >= DHT_MIN_INTERVAL_MS) {
    const float h = dht.readHumidity(), t = dht.readTemperature();
    lastEnvMillis = now;
    const bool ok = !isnan(h) && !isnan(t) && h >= 0 && h <= 100 && t >= -40 && t <= 85;
    lastTemperature = ok ? t : NAN; lastHumidity = ok ? h : NAN;
  }
  if (isnan(lastTemperature) || isnan(lastHumidity)) return false;
  temperature = lastTemperature; humidity = lastHumidity;
  return true;
}

// LED on -> one TCS34725 reading -> LED off. Rejects dark or saturated readings,
// which the server would refuse anyway.
bool readColor(uint16_t& red, uint16_t& green, uint16_t& blue, uint16_t& clear) {
  if (!colorSensorReady) return false;
  digitalWrite(COLOR_LED_PIN, HIGH);
  delay(60); // let the LED settle
  tcs.getRawData(&red, &green, &blue, &clear); // waits one integration period
  digitalWrite(COLOR_LED_PIN, LOW);
  const uint16_t highest = max(max(red, green), max(blue, clear));
  return clear > 0 && highest < 65535;
}

void handleCommand() {
  while (Serial.available()) {
    const char command = toupper(Serial.read());
    if (command == 'T') startTare();
    else if (command == 'D') scanDht();
    else if (command == 'H') {
      float t, h;
      if (readEnvironment(t, h)) Serial.printf("[ENV] DHT11 temperature=%.1f C humidity=%.1f %%\n", t, h);
      else Serial.println("[ENV] DHT11 read failed. Check VCC=3.3V, GND and DATA=GPIO 7.");
    }
    else if (command == 'R') {
      uint16_t r, g, b, c;
      if (readColor(r, g, b, c)) Serial.printf("[COLOR] raw R=%u G=%u B=%u C=%u -> display RGB %d/%d/%d\n", r, g, b, c,
        (int)lround(fmin(255.0, 255.0 * r / c)), (int)lround(fmin(255.0, 255.0 * g / c)), (int)lround(fmin(255.0, 255.0 * b / c)));
      else Serial.println(colorSensorReady ? "[COLOR] Too dark or saturated. Check the cover, LED and distance." : "[COLOR] TCS34725 not found. Check VIN, GND, SDA=5, SCL=4.");
    }
    else if (command == 'P') {
      invalidatePending(); Serial.println("[UPLOAD] Paused. LCD continues.");
    } else if (command == 'C') {
      invalidatePending(); calibrationReady = false; calibratedAt = 0;
      if (!tareReady || !clockReady() || !tareAt) {
        Serial.println("[CAL] Wait for NTP, then empty the tray and send T first.");
      } else {
        windowCount = 0; referenceRequested = true;
        Serial.println("[CAL] Place ONLY the actual 112.0 g reference mass on the tared tray. Capturing a fresh stable window.");
      }
    } else if (command == 'S') {
      if (!configurationReady || !tareReady || !calibrationReady || !clockReady())
      {
        Serial.println("[UPLOAD] Not armed. Still needed:");
        if (!configurationReady) Serial.println("  - secrets.h: Wi-Fi name, 64-char device key, registered SAMPLE_ID, http:// BACKEND_URL");
        if (!clockReady()) Serial.println("  - Internet time (NTP): wait for '[TIME] NTP synchronized' (needs Wi-Fi)");
        if (!tareReady) Serial.println("  - Tare: empty the tray and send T");
        else if (!tareAt) Serial.println("  - Timestamped tare: the tare happened before NTP; empty the tray and send T again");
        if (!calibrationReady) Serial.println("  - Reference check: put the 112.0 g weight on the tray and send C");
      }
      else {
        referenceRequested = false; windowCount = 0; lastCapture = millis();
        uploadsEnabled.store(true);
        Serial.println("[UPLOAD] Armed. Reference mass must be removed; place the registered cinnamon group. Interval 15 seconds.");
      }
    }
  }
}

String payloadFor(const Measurement& m) {
  cJSON* root = cJSON_CreateObject();
  if (!root) return "";
  cJSON_AddStringToObject(root, "sampleId", SAMPLE_ID);
  cJSON_AddStringToObject(root, "deviceId", DEVICE_ID);
  cJSON_AddStringToObject(root, "measurementId", m.id);
  cJSON_AddStringToObject(root, "recordedAt", isoTime(m.recordedAt).c_str());
  cJSON_AddStringToObject(root, "dataOrigin", "REAL_SENSOR");
  cJSON* status = cJSON_AddObjectToObject(root, "sensorStatus");
  cJSON_AddStringToObject(status, "weight", "online");
  cJSON_AddStringToObject(status, "color", m.colorOk ? "online" : "offline");
  cJSON* raw = cJSON_AddArrayToObject(root, "rawWeightSamples");
  for (size_t i = 0; i < CAPTURE_SAMPLES; ++i) cJSON_AddItemToArray(raw, cJSON_CreateNumber(m.raw[i]));
  // Do not send the LCD's near-zero clamp. Node derives unrounded grams itself.
  cJSON* calibration = cJSON_AddObjectToObject(root, "calibration");
  cJSON_AddStringToObject(calibration, "protocol", CALIBRATION_PROTOCOL);
  cJSON_AddStringToObject(calibration, "version", "1");
  cJSON_AddStringToObject(calibration, "tareAt", isoTime(m.tareAt).c_str());
  cJSON_AddStringToObject(calibration, "calibratedAt", isoTime(m.calibratedAt).c_str());
  cJSON_AddNumberToObject(calibration, "tareRaw", m.tareRaw);
  cJSON_AddNumberToObject(calibration, "countsPerGram", COUNTS_PER_GRAM);
  cJSON_AddNumberToObject(calibration, "referenceMassGrams", REFERENCE_MASS_GRAMS);
  cJSON_AddNumberToObject(calibration, "stabilityLimitGrams", STABILITY_LIMIT_GRAMS);
  if (m.colorOk) {
    cJSON* rgb = cJSON_AddObjectToObject(root, "rgbRaw");
    cJSON_AddNumberToObject(rgb, "red", m.red); cJSON_AddNumberToObject(rgb, "green", m.green);
    cJSON_AddNumberToObject(rgb, "blue", m.blue); cJSON_AddNumberToObject(rgb, "clear", m.clear);
    cJSON* settings = cJSON_AddObjectToObject(root, "colorSettings");
    cJSON_AddNumberToObject(settings, "gain", COLOR_GAIN);
    cJSON_AddNumberToObject(settings, "integrationTimeMs", COLOR_INTEGRATION_MS);
    cJSON_AddStringToObject(settings, "lighting", COLOR_LIGHTING);
    cJSON_AddNumberToObject(settings, "distanceMm", COLOR_DISTANCE_MM);
  }
  if (m.envOk) {
    cJSON_AddNumberToObject(root, "temperatureC", roundf(m.temperatureC * 10) / 10);
    cJSON_AddNumberToObject(root, "relativeHumidityPercent", roundf(m.humidity * 10) / 10);
    cJSON* environment = cJSON_AddObjectToObject(root, "environment");
    for (const char* key : {"temperature", "humidity"}) {
      cJSON* item = cJSON_AddObjectToObject(environment, key);
      cJSON_AddStringToObject(item, "source", "sensor");
      cJSON_AddStringToObject(item, "measuredAt", isoTime(m.envMeasuredAt).c_str());
      cJSON_AddStringToObject(item, "instrument", "DHT11");
    }
  } else {
    cJSON_AddNullToObject(root, "temperatureC");
    cJSON_AddNullToObject(root, "relativeHumidityPercent");
  }
  // Missing temperature/humidity are sent as null. Node stores missing gas as null;
  // gasResistanceOhms is not an allowed input. Node derives display RGB from rgbRaw.
  char* bytes = cJSON_PrintUnformatted(root);
  const String body = bytes ? String(bytes) : String("");
  if (bytes) cJSON_free(bytes);
  cJSON_Delete(root);
  return body;
}

const char* jsonText(cJSON* object, const char* key) {
  cJSON* value = cJSON_GetObjectItemCaseSensitive(object, key);
  return cJSON_IsString(value) && value->valuestring ? value->valuestring : "";
}

int request(const char* method, const String& path, const String& body, String& response) {
  WiFiClient client;
  HTTPClient http;
  http.setConnectTimeout(2000); http.setTimeout(3000);
  http.setReuse(false);
  if (!http.begin(client, String(BACKEND_URL) + path)) return -100;
  if (!strcmp(method, "POST")) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Device-Key", DEVICE_KEY);
  }
  const int code = !strcmp(method, "POST") ? http.POST(body) : http.GET();
  if (code > 0) response = http.getString();
  http.end();
  Serial.printf("[HTTP] %s status=%d\n", method, code); // Never print headers, keys or response bodies.
  return code;
}

bool activeRealSample() {
  String response;
  const int code = request("GET", String("/api/samples/") + SAMPLE_ID, "", response);
  if (code != 200) {
    Serial.println("[SAMPLE] Cannot confirm the registered record. No measurement submitted."); return false;
  }
  cJSON* row = cJSON_Parse(response.c_str());
  cJSON* archived = cJSON_GetObjectItemCaseSensitive(row, "archivedAt");
  const bool valid = row && !strcmp(jsonText(row, "sampleId"), SAMPLE_ID)
    && cJSON_IsNull(archived) && strcmp(jsonText(row, "dataOrigin"), "DEMO_DATA");
  cJSON_Delete(row);
  if (!valid) { uploadsEnabled.store(false); Serial.println("[SAMPLE] Must be an active, genuine registered record, not an illustrative record. Uploads paused."); }
  return valid;
}

bool duplicateExists(const Measurement& m) {
  String response;
  // Restrict readback to the original capture timestamp to bound ESP32 memory use.
  const String captured = isoTime(m.recordedAt);
  if (request("GET", String("/api/module-02/samples/") + SAMPLE_ID
      + "/readings?limit=20&from=" + captured + "&to=" + captured, "", response) != 200) return false;
  cJSON* root = cJSON_Parse(response.c_str());
  cJSON* row = nullptr;
  bool found = false;
  cJSON_ArrayForEach(row, cJSON_GetObjectItemCaseSensitive(root, "data")) {
    if (strcmp(jsonText(row, "deviceId"), DEVICE_ID) || strcmp(jsonText(row, "sampleId"), SAMPLE_ID)
        || strcmp(jsonText(row, "measurementId"), m.id) || strcmp(jsonText(row, "dataOrigin"), "REAL_SENSOR")) continue;
    cJSON* raw = cJSON_GetObjectItemCaseSensitive(row, "rawWeightSamples");
    found = cJSON_GetArraySize(raw) == CAPTURE_SAMPLES;
    for (size_t i = 0; found && i < CAPTURE_SAMPLES; ++i) {
      cJSON* item = cJSON_GetArrayItem(raw, i);
      found = cJSON_IsNumber(item) && item->valuedouble == m.raw[i];
    }
    if (found) break;
  }
  cJSON_Delete(root); return found;
}

void networkTask(void*) {
  WiFi.persistent(false); WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (strlen(WIFI_SSID)) WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  sntp_set_time_sync_notification_cb(timeAvailable);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");
  uint32_t lastWifiAttempt = millis(), retryAt = 0;
  uint8_t attempts = 0;
  bool connectedBefore = false, announcedClock = false, pending = false;
  Measurement measurement{};
  for (;;) {
    const uint32_t now = millis();
    const bool connected = WiFi.status() == WL_CONNECTED;
    if (connected && !connectedBefore) Serial.println("[WIFI] Connected. Waiting for NTP/backend; LCD remains independent.");
    if (!connected && connectedBefore) Serial.println("[WIFI] Disconnected. LCD continues; reconnecting in background.");
    connectedBefore = connected;
    if (!connected && strlen(WIFI_SSID) && now - lastWifiAttempt >= 10000) {
      WiFi.reconnect(); lastWifiAttempt = now;
    }
    if (clockReady() && !announcedClock) {
      Serial.println("[TIME] NTP synchronized. If startup tare had no timestamp, empty tray and send T."); announcedClock = true;
    }
    if (pending && (!uploadsEnabled.load() || measurement.generation != generation.load()
        || now - measurement.capturedMillis > MAX_PENDING_AGE_MS)) {
      pending = false; Serial.println("[UPLOAD] Cancelled or expired pending capture; no timestamp was changed.");
    }
    if (!pending && xQueueReceive(uploadQueue, &measurement, 0) == pdTRUE) {
      pending = true; attempts = 0; retryAt = now;
      if (measurement.generation != generation.load() || !uploadsEnabled.load()
          || now - measurement.capturedMillis > MAX_PENDING_AGE_MS) { pending = false; continue; }
    }
    if (pending && connected && clockReady() && static_cast<int32_t>(now - retryAt) >= 0) {
      if (activeRealSample() && uploadsEnabled.load() && measurement.generation == generation.load()) {
        const String body = payloadFor(measurement);
        String response;
        const int code = body.length() ? request("POST", "/api/module-02/readings", body, response) : -101;
        if (code == 201) {
          Serial.printf("[UPLOAD] API accepted measurementId=%s. Verify this ID in Atlas and refresh the dashboard.\n", measurement.id);
          pending = false;
        } else if (code == 409) {
          if (duplicateExists(measurement)) Serial.printf("[UPLOAD] Existing matching measurement confirmed: %s\n", measurement.id);
          else { Serial.println("[UPLOAD] Conflict not confirmed as a matching retry. Uploads paused."); uploadsEnabled.store(false); }
          pending = false;
        } else if (code >= 400 && code < 500 && code != 408 && code != 429) {
          Serial.println("[UPLOAD] Request rejected. Check device key, sample, capture time and calibration. Uploads paused; LCD continues.");
          uploadsEnabled.store(false); pending = false;
        } else Serial.println("[UPLOAD] Backend unavailable; retry will keep the same ID, counts and timestamps.");
      }
      if (pending) {
        if (++attempts >= 5) { pending = false; Serial.println("[UPLOAD] Retry limit reached; capture discarded, not relabeled."); }
        else retryAt = millis() + (2000UL << attempts);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void setup() {
  Serial.begin(115200); delay(1000);
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init(); lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("CinnaSense AI");
  lcd.setCursor(0, 1); lcd.print("Starting..."); delay(1500);
  pinMode(COLOR_LED_PIN, OUTPUT); digitalWrite(COLOR_LED_PIN, LOW);
  Wire1.begin(COLOR_SDA, COLOR_SCL);
  colorSensorReady = tcs.begin(TCS34725_ADDRESS, &Wire1);
  Serial.println(colorSensorReady ? "[COLOR] TCS34725 found at 0x29." : "[COLOR] TCS34725 not found. Weight uploads continue with color offline.");
  dht.begin();
  scale.begin(HX711_DT, HX711_SCK);
  scale.set_scale(static_cast<float>(COUNTS_PER_GRAM));
  uint8_t randomId[16]; esp_fill_random(randomId, sizeof(randomId));
  for (size_t i = 0; i < sizeof(randomId); ++i) snprintf(bootId + 2 * i, 3, "%02x", randomId[i]);
  configurationReady = strlen(WIFI_SSID) && strlen(DEVICE_KEY) >= 32 && validId(SAMPLE_ID)
    && String(BACKEND_URL).startsWith("http://");
  uploadQueue = xQueueCreate(1, sizeof(Measurement));
  if (!uploadQueue || xTaskCreate(networkTask, "Module02HTTP", 12288, nullptr, 1, nullptr) != pdPASS) {
    configurationReady = false; Serial.println("[CONFIG] Network task unavailable. LCD-only operation.");
  }
  if (!configurationReady) Serial.println("[CONFIG] Configure secrets.h with hotspot, device key and an actual registered sample. Uploads disabled.");
  Serial.println("[COMMANDS] T=empty-tray tare; C=112.0g reference check; S=start uploads; P=pause; R=test colour sensor; H=test DHT11; D=find DHT11 pin.");
  Serial.printf("Calibration factor: %.4f (fixed)\n", COUNTS_PER_GRAM);
  startTare();
}

void loop() {
  handleCommand();
  const uint32_t now = millis();
  if (lastRawMillis && now - lastRawMillis > SENSOR_GAP_MS) {
    windowCount = 0;
    if (tareInProgress) tareCount = 0;
  }
  if ((!tareInProgress || now - tareStarted >= 3000) && scale.is_ready()) {
    const int32_t raw = scale.read(); // actual signed 24-bit ADC value; only this task reads HX711
    lastRawMillis = now; sensorConnected = true;
    if (tareInProgress) {
      tareSamples[tareCount++] = raw;
      if (tareCount == TARE_SAMPLES) {
        const CaptureStats stats = captureStats(tareSamples, TARE_SAMPLES, 0);
        if (!stats.valid || stats.spread > STABILITY_LIMIT_GRAMS) {
          tareCount = 0;
          if (!stats.valid) Serial.println("[TARE] Invalid raw value (HX711 rail). Check HX711 VCC/GND/DT/SCK and load cell wires.");
          else Serial.printf("[TARE] Unstable: readings vary by %.2f g (limit %.2f g). Keep empty tray still; collecting again.\n", stats.spread, STABILITY_LIMIT_GRAMS);
        } else {
          tareRaw = static_cast<int32_t>(stats.mean); // same truncation as Bogde tare(20)
          scale.set_offset(tareRaw); tareReady = true; tareInProgress = false;
          tareAt = clockReady() ? time(nullptr) : 0;
          lcd.clear(); lcd.print("Cinnamon Weight");
          Serial.printf("[TARE] Captured actual tareRaw=%ld. %s\n", static_cast<long>(tareRaw), tareAt ? "UTC timestamp recorded." : "No synchronized timestamp: repeat T after NTP before uploading.");
        }
      }
    } else if (tareReady) {
      windowSamples[windowCount++] = raw;
      if (windowCount == CAPTURE_SAMPLES) {
        windowCount = 0;
        const CaptureStats stats = captureStats(windowSamples, CAPTURE_SAMPLES, tareRaw);
        if (stats.valid) { displayedWeight = stats.weight; hasDisplayWeight = true; }
        if (referenceRequested && clockReady() && tareAt && stats.valid && stats.spread <= STABILITY_LIMIT_GRAMS) {
          referenceRequested = false;
          if (fabs(stats.weight - REFERENCE_MASS_GRAMS) <= REFERENCE_TOLERANCE_GRAMS) {
            calibratedAt = time(nullptr); calibrationReady = true;
            Serial.printf("[CAL] Actual 112.0g reference check passed: %.3f g. Fixed factor retained; current check time recorded. Remove reference, place cinnamon, then send S.\n", stats.weight);
          } else {
            Serial.printf("[CAL] Check failed: %.3f g. Uploads stay disabled. Verify empty tare and reference, then repeat C. Do not invent metadata.\n", stats.weight);
          }
        }
        if (uploadsEnabled.load() && calibrationReady && clockReady() && now - lastCapture >= UPLOAD_INTERVAL_MS) {
          lastCapture = now;
          const time_t capturedAt = time(nullptr);
          if (!uploadable(stats) || !tareAt || !calibratedAt || capturedAt < tareAt || capturedAt < calibratedAt) {
            Serial.println("[CAPTURE] Invalid, unstable, negative, or inconsistent time: no upload; LCD remains available.");
          } else {
            Measurement m{};
            memcpy(m.raw, windowSamples, sizeof(m.raw));
            m.tareRaw = tareRaw; m.tareAt = tareAt; m.calibratedAt = calibratedAt;
            m.recordedAt = capturedAt; m.capturedMillis = now; m.generation = generation.load();
            snprintf(m.id, sizeof(m.id), "W-%s-%08lx", bootId, static_cast<unsigned long>(++measurementSequence));
            m.colorOk = readColor(m.red, m.green, m.blue, m.clear);
            m.envOk = readEnvironment(m.temperatureC, m.humidity);
            m.envMeasuredAt = capturedAt;
            if (!m.envOk) Serial.println("[ENV] DHT11 read failed; uploading with temperature/humidity missing.");
            if (colorSensorReady && !m.colorOk) Serial.println("[COLOR] Unusable colour reading; uploading weight with color offline.");
            if (xQueueSend(uploadQueue, &m, 0) != pdTRUE) Serial.println("[UPLOAD] Pending queue full; this capture skipped. LCD continues.");
          }
        }
      }
    }
  }
  if (now - lastDisplay >= 500) {
    lastDisplay = now;
    if (!tareInProgress) {
      lcd.setCursor(0, 0); lcd.print("Cinnamon Weight ");
      lcd.setCursor(0, 1); lcd.print("                "); lcd.setCursor(0, 1);
      if (!sensorConnected || now - lastRawMillis > SENSOR_GAP_MS) {
        lcd.print("Sensor Error");
      } else if (hasDisplayWeight) {
        const double shown = displayedWeight > -0.2 && displayedWeight < 0.2 ? 0 : displayedWeight;
        lcd.print(shown, 2); lcd.print(" g");
        if (isnan(lastPrintedWeight) || fabs(shown - lastPrintedWeight) >= 0.1 || now - lastWeightPrint >= 10000) {
          Serial.printf("Weight: %.2f g\n", shown);
          lastPrintedWeight = shown; lastWeightPrint = now;
        }
      } else lcd.print("Reading...");
    } else if (now - tareStarted > 6000 && (!sensorConnected || now - lastRawMillis > SENSOR_GAP_MS)) {
      lcd.setCursor(0, 0); lcd.print("HX711 ERROR!    ");
      lcd.setCursor(0, 1); lcd.print("Check Wiring    ");
    }
  }
  delay(2); // yields to Wi-Fi without a blocking 10-reading get_units() call
}

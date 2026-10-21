// Copy this file to secrets.h (same folder) and fill in your values.
// secrets.h is ignored by git: never commit Wi-Fi passwords or device keys.
#pragma once

#define WIFI_SSID "your-2.4GHz-wifi-name"
#define WIFI_PASS "your-wifi-password"

// Your PC's IPv4 address from `ipconfig`, port 5000 (the Express server). No trailing slash.
#define SERVER_URL "http://192.168.1.25:5000"

// The secret for ESP32-CAM-01 in MODULE02_DEVICE_KEYS (server/.env).
#define DEVICE_KEY "paste-the-64-character-device-secret-here"

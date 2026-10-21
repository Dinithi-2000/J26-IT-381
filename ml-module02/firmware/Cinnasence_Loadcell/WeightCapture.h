#pragma once
#include <stdint.h>
#include <stddef.h>

struct Measurement; // Arduino's generated prototypes refer to this sketch type.

// These constants match the owner's working sketch and the Node validator.
constexpr double COUNTS_PER_GRAM = -204.7352;
constexpr double REFERENCE_MASS_GRAMS = 112.0;
constexpr double STABILITY_LIMIT_GRAMS = 0.5; // prototype acceptance limit, not accuracy
constexpr double REFERENCE_TOLERANCE_GRAMS = 1.0; // prototype reference-check tolerance
constexpr size_t CAPTURE_SAMPLES = 10;
constexpr size_t TARE_SAMPLES = 20;

struct CaptureStats {
  double mean;
  double weight;
  double spread;
  bool valid;
};

inline CaptureStats captureStats(const int32_t* raw, size_t count, int32_t tareRaw) {
  if (!raw || !count || count > 64) return {0, 0, 0, false};
  int64_t sum = 0;
  int32_t low = raw[0], high = raw[0];
  for (size_t index = 0; index < count; ++index) {
    // Exclude signed 24-bit ADC rail values, just as realSensor.js does.
    if (raw[index] < -8388607 || raw[index] > 8388606) return {0, 0, 0, false};
    sum += raw[index];
    if (raw[index] < low) low = raw[index];
    if (raw[index] > high) high = raw[index];
  }
  const double mean = static_cast<double>(sum) / count;
  const double spread = (static_cast<double>(high) - low) / -COUNTS_PER_GRAM;
  return {mean, (mean - tareRaw) / COUNTS_PER_GRAM, spread, true};
}

inline bool uploadable(const CaptureStats& capture) {
  return capture.valid && capture.weight >= 0 && capture.weight <= 10000
    && capture.spread <= STABILITY_LIMIT_GRAMS;
}

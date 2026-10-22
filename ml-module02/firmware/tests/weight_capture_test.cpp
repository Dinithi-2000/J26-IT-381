// Fabricated arithmetic fixtures only. Never transmitted to a real backend.
#include "../Cinnasence_Loadcell/WeightCapture.h"
#include <cassert>
#include <cmath>
#include <iomanip>
#include <iostream>

int main() {
  int32_t raw[10] = {95905,95906,95905,95906,95905,95906,95905,95906,95905,95906};
  const auto result = captureStats(raw,10,100000);
  assert(result.valid && uploadable(result));
  assert(result.mean == 95905.5);
  assert(std::abs(result.weight - ((95905.5 - 100000) / -204.7352)) < 1e-12);
  assert(std::abs(result.spread - 1 / 204.7352) < 1e-12);
  assert(!captureStats(nullptr,10,0).valid);
  assert(!captureStats(raw,0,0).valid);
  assert(!captureStats(raw,65,0).valid);
  int32_t lowRail[] = {-8388608};
  int32_t highRail[] = {8388607};
  assert(!captureStats(lowRail,1,0).valid);
  assert(!captureStats(highRail,1,0).valid);
  int32_t unstable[] = {95905,97000};
  assert(!uploadable(captureStats(unstable,2,100000)));
  int32_t negative[] = {100100,100100};
  assert(!uploadable(captureStats(negative,2,100000)));
  int32_t tare[] = {100001,100002};
  assert(static_cast<int32_t>(captureStats(tare,2,0).mean) == 100001);
  // Emit one TEST-ONLY sensor window for independent Node contract validation.
  std::cout << std::setprecision(17) << "{\"raw\":[";
  for (size_t i=0;i<10;++i) std::cout << (i ? "," : "") << raw[i];
  std::cout << "],\"weight\":" << result.weight << ",\"spread\":" << result.spread
    << ",\"factor\":" << COUNTS_PER_GRAM << "}";
}

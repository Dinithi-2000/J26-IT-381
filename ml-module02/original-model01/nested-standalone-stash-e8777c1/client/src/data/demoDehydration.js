// Synthetic, static research fixtures. Never use these as a live-data fallback.
export const demoTelemetry = {
  batchId: 'CIN-DEMO-001', initialMoisture: 35, targetMoisture: 20,
  initialWeight: 1000, currentWeight: 902.8, targetWeight: 812.5,
  estimatedMoisture: 28, temperature: 35.4, humidity: 52,
  elapsedTime: 5425, remainingDryingTime: 5140,
  heaterState: 'ON', fanState: 'ON', systemState: 'Drying',
  controlMode: 'Automatic', temperatureProtection: 'Normal', maxTemperature: 45,
  updatedAt: '2026-10-01T13:04:20+05:30', estimatedCompletion: '2026-10-01T14:30:00+05:30',
};

function history(duration, finalMoisture) {
  return Array.from({ length: 13 }, (_, index) => {
    const fraction = index / 12;
    const estimatedMoisture = 35 - (35 - finalMoisture) * fraction ** 0.83;
    return {
      elapsedTime: Math.round(duration * fraction),
      temperature: +(29 + 6.4 * (1 - Math.exp(-fraction * 6)) + Math.sin(fraction * Math.PI * 2) * 0.4).toFixed(1),
      humidity: +(65 - 13 * fraction + Math.sin(fraction * Math.PI * 2) * 1.8).toFixed(1),
      estimatedMoisture: +estimatedMoisture.toFixed(1),
      currentWeight: +(650 / (1 - estimatedMoisture / 100)).toFixed(1),
      remainingDryingTime: Math.round(duration + (finalMoisture === 20 ? 0 : 5140) - duration * fraction),
    };
  });
}

export const demoDryingRecords = history(5425, 28);
// The final historical observation agrees with the telemetry snapshot.
Object.assign(demoDryingRecords.at(-1), {
  temperature: 35.4, humidity: 52, estimatedMoisture: 28, currentWeight: 902.8,
});

export const demoDryingEvents = [
  { id: 'reading', timestamp: '2026-10-01T13:04:20+05:30', name: 'Sensor reading received', description: 'Illustrative chamber and load-cell observation.', icon: 'cpu' },
  { id: 'heat-on', timestamp: '2026-10-01T12:55:00+05:30', name: 'Heater switched ON', description: 'Simulated relay event after chamber cooling.', icon: 'sun' },
  { id: 'heat-off', timestamp: '2026-10-01T12:52:00+05:30', name: 'Heater switched OFF', description: 'Simulated temperature protection cycle.', icon: 'shield' },
  { id: 'limit', timestamp: '2026-10-01T12:52:00+05:30', name: 'Temperature limit reached', description: 'Illustrative historical event; not a live alarm.', icon: 'thermometer' },
  { id: 'fan', timestamp: '2026-10-01T11:33:55+05:30', name: 'Fan switched ON', description: 'Simulated fan relay enabled.', icon: 'wind' },
  { id: 'start', timestamp: '2026-10-01T11:33:55+05:30', name: 'Drying session started', description: 'Synthetic 1,000 g cinnamon batch.', icon: 'clock' },
];

export const demoDryingSessions = [
  { ...demoTelemetry, date: '2026-10-01', finalWeight: null, status: 'In progress', records: demoDryingRecords, events: demoDryingEvents },
  { ...demoTelemetry, batchId: 'CIN-DEMO-002', date: '2026-09-30', estimatedMoisture: 20, currentWeight: 812.5, finalWeight: 812.5, elapsedTime: 10800, remainingDryingTime: 0, status: 'Completed', records: history(10800, 20), events: [
    { id: 'complete', timestamp: '2026-09-30T14:10:00+05:30', name: 'Drying session completed', description: 'Synthetic completed experiment.', icon: 'check' },
    { id: 'cool', timestamp: '2026-09-30T14:00:00+05:30', name: 'Cooling period started', description: 'Simulated cooling phase.', icon: 'wind' },
    { id: 'target', timestamp: '2026-09-30T14:00:00+05:30', name: 'Target moisture reached', description: 'Illustrative estimated moisture only.', icon: 'droplet' },
  ] },
  { ...demoTelemetry, batchId: 'CIN-DEMO-003', date: '2026-09-29', estimatedMoisture: 30, currentWeight: 928.6, finalWeight: 928.6, elapsedTime: 3600, remainingDryingTime: null, status: 'Stopped', records: history(3600, 30).map(record => ({ ...record, remainingDryingTime: null })), events: [
    { id: 'stop', timestamp: '2026-09-29T12:00:00+05:30', name: 'Drying session stopped', description: 'Synthetic experiment stopped before target.', icon: 'info' },
  ] },
];

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)].map(value => String(value).padStart(2, '0')).join(':');
}

export function formatDryingTime(value, date = false) {
  if (!value) return '--';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo', ...(date ? { day: '2-digit', month: 'short', year: 'numeric' } : {}),
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
  return `${formatted} SLST`;
}

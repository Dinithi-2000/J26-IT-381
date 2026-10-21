import mongoose from 'mongoose';
export const PP1_DATABASE = 'cinnasense_module02_pp1_dev';
export const PP1_URI = `mongodb://127.0.0.1:27018/${PP1_DATABASE}`;
export function verifyPp1Target(uri) {
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.port !== '27018' || url.pathname !== `/${PP1_DATABASE}` || url.username || url.password || url.search || url.hash) {
    throw new Error('PP1 requires the dedicated loopback MongoDB on port 27018; production and unknown targets are forbidden.');
  }
  return uri;
}
export function verifyPp1Connection(connection = mongoose.connection) {
  if (connection.name !== PP1_DATABASE || !['127.0.0.1', 'localhost', '::1'].includes(connection.host) || connection.port !== 27018) {
    throw new Error('Connected MongoDB does not match the verified PP1 target.');
  }
}
// Deterministic presentation fixtures only; never real sensor measurements.
export function pp1Records() {
  const samples = [], readings = [];
  for (let index = 0; index < 3; index++) {
    const sampleId = `CIN-PP1-${String(index + 1).padStart(3, '0')}`;
    const initialWeightGrams = [250, 200, 180][index];
    samples.push({sampleId, batchId: 'PP1-ILLUSTRATIVE-2026', grade: ['Alba illustration', 'C5 illustration', 'Quill illustration'][index],
      storage: ['Sealed container illustration', 'Paper-lined container illustration', 'Controlled storage illustration'][index],
      storageStartDate: new Date('2026-10-16T05:00:00Z'), initialWeightGrams, dataOrigin: 'DEMO_DATA'});
    for (let day = 0; day <= 5; day++) readings.push({sampleId, deviceId: 'PP1-ILLUSTRATIVE', measurementId: `${sampleId}-DAY-${day}`,
      recordedAt: new Date(Date.UTC(2026, 9, 16 + day, 5)), weightGrams: initialWeightGrams - day * [0.8, 0.5, 0.3][index],
      red: 170 - index * 8 - day * 2, green: 118 - index * 5 - day, blue: 76 - index * 4 - day,
      temperatureC: index === 2 ? null : 27 + index + day * .2,
      relativeHumidityPercent: index === 2 ? null : 60 + index * 4 + day,
      gasResistanceOhms: null, dataOrigin: 'DEMO_DATA',
      sensorStatus: {weight: 'offline', color: 'offline'},
      environment: {temperature: {source: index === 2 ? 'unavailable' : 'illustrative'}, humidity: {source: index === 2 ? 'unavailable' : 'illustrative'}}});
  }
  return {samples, readings};
}

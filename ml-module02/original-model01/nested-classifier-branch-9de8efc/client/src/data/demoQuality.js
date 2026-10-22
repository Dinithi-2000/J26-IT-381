// Entirely synthetic fixtures. Gas resistance is not aroma concentration.
function fixture(id, batchId, grade, storage, initialWeight, weights, temperatures, humidities, gasValues, colors) {
  const records = weights.map((weight, index) => ({
    day: index * 7,
    timestamp: `2026-09-${String(1 + index * 7).padStart(2, '0')}T09:00:00+05:30`,
    weight, temperature: temperatures[index], humidity: humidities[index],
    gasResistanceOhms: gasValues[index], rgb: colors[index],
  }));
  return {
    id, batchId, grade, storage, initialWeight, storageStartDate: '2026-09-01',
    records, images: [
      { id: `${id}-baseline`, role: 'Baseline', timestamp: records[0].timestamp, src: '/cinnamon.svg', kind: 'illustration' },
      { id: `${id}-current`, role: 'Current', timestamp: records.at(-1).timestamp, src: '/cinnamon.svg', kind: 'illustration' },
    ],
  };
}
export const demoSamples = [
  fixture('CIN-DEMO-001', 'BATCH-DEMO-A', 'Alba quills', 'Sealed glass container', 250,
    [250, 248.8, 247.5, 246.4, 245.5], [27.1, 27.8, 28.2, 28.4, 28.6], [61, 64, 66, 67, 68],
    [140000, 137000, 133500, 131000, 128400],
    [[164, 111, 70], [162, 109, 68], [160, 107, 66], [158, 104, 64], [156, 102, 62]]),
  fixture('CIN-DEMO-002', 'BATCH-DEMO-B', 'C-5 quills', 'Paper-lined storage box', 200,
    [200, 199.3, 198.6, 197.9, 197.2], [26.4, 26.8, 27.2, 27.5, 27.6], [60, 62, 63, 65, 65],
    [127000, 124000, 121500, 118000, 115200],
    [[171, 119, 77], [170, 117, 76], [168, 115, 74], [167, 114, 72], [165, 112, 71]]),
];
export function weightChange(sample, record = sample.records.at(-1)) {
  return record && sample.initialWeight > 0
    ? (record.weight - sample.initialWeight) / sample.initialWeight * 100 : null;
}
export function formatTimestamp(value) {
  if (!value) return 'No measurement';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo',
  }).format(new Date(value)) + ' SLST';
}

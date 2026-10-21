import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';

const operator = 'operator-test-secret-012345678901234567890';
const deviceKey = 'device-test-secret-01234567890123456789012';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const classification = {
  predictedCondition: 'suspected_mold', predictedLabel: 'Suspected mold', modelScore: 0.91,
  topPredictions: [{ condition: 'suspected_mold', label: 'Suspected mold', score: 0.91 }, { condition: 'good_quality', label: 'Good quality', score: 0.09 }],
  suspectedMold: true, note: 'Image-based indication only.', analysisStatus: 'Completed',
  analysedAt: '2026-10-20T08:00:00Z', modelVersion: 'model01-test', image: { width: 224, height: 224 }
};

// In-memory doubles: these tests cover HTTP behaviour, not MongoDB persistence.
const samples = [{ sampleId: 'CIN-001', archivedAt: null }, { sampleId: 'CIN-OLD', archivedAt: new Date('2026-09-01') }];
const analyses = [];
const Sample = { findOne: async ({ sampleId }) => samples.find(row => row.sampleId === sampleId) || null };
const ImageAnalysis = {
  async create(values) { const row = { ...values, _id: String(analyses.length + 1), toObject() { return { ...this }; } }; analyses.push(row); return row; },
  find(filter) { const q = { sort: () => q, limit: async n => analyses.filter(row => !filter.sampleId || row.sampleId === filter.sampleId).slice(0, n) }; return q; }
};
let databaseUp = true, mlUp = true, classifyCalls = 0;
const classify = async () => {
  classifyCalls++;
  if (!mlUp) throw Object.assign(new Error('The ML service is not reachable.'), { status: 503, code: 'ML_SERVICE_UNAVAILABLE' });
  return classification;
};

let server, base, storage;
before(async () => {
  process.env.MODULE02_OPERATOR_TOKEN = operator;
  process.env.MODULE02_DEVICE_KEYS = JSON.stringify({ 'ESP32-CAM-01': deviceKey });
  storage = await mkdtemp(join(tmpdir(), 'cinnasense-quality-test-'));
  process.env.QUALITY_UPLOAD_DIR = storage;
  const quality = { Sample, ImageAnalysis, classify, modelInfo: async () => ({ modelVersion: 'model01-test' }), databaseReady: () => databaseUp };
  server = createServer(createApp({ quality }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/quality`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await rm(storage, { recursive: true, force: true }); });

function upload({ sampleId = 'CIN-001', bytes = jpeg, headers = { Authorization: `Bearer ${operator}` } } = {}) {
  const form = new FormData();
  if (sampleId) form.append('sampleId', sampleId);
  form.append('image', new Blob([bytes], { type: 'image/jpeg' }), 'quill.jpg');
  return fetch(`${base}/classify`, { method: 'POST', body: form, headers });
}
const json = async response => ({ status: response.status, body: await response.json() });

test('classify refuses missing or wrong credentials before reading the photo', async () => {
  const calls = classifyCalls;
  assert.equal((await upload({ headers: {} })).status, 401);
  assert.equal((await upload({ headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await upload({ headers: { 'x-device-id': 'ESP32-CAM-01', 'x-device-key': 'wrong' } })).status, 401);
  assert.equal(classifyCalls, calls, 'the model must not run for unauthenticated requests');
});

test('classify requires a registered, active sample and a real image', async () => {
  assert.equal((await json(await upload({ sampleId: '' }))).body.error.code, 'INVALID_SAMPLE_ID');
  assert.equal((await json(await upload({ sampleId: '../etc' }))).status, 400);
  assert.equal((await json(await upload({ sampleId: 'CIN-404' }))).status, 404);
  assert.equal((await json(await upload({ sampleId: 'CIN-OLD' }))).status, 409);
  const notImage = await json(await upload({ bytes: Buffer.from('<?php echo 1; ?>') }));
  assert.equal(notImage.status, 415);
  assert.equal(analyses.length, 0);
});

test('operator upload is classified, stored with sha256 and model version, and listed', async () => {
  const { status, body } = await json(await upload());
  assert.equal(status, 201);
  assert.equal(body.sampleId, 'CIN-001');
  assert.equal(body.source, 'upload');
  assert.equal(body.modelVersion, 'model01-test');
  assert.match(body.image.sha256, /^[0-9a-f]{64}$/);
  assert.equal((await readdir(storage)).length, 1);
  const list = await json(await fetch(`${base}/analyses?sampleId=CIN-001`));
  assert.equal(list.body[0].id, body.id);
});

test('ESP32-CAM can post raw JPEG bytes with device credentials', async () => {
  const response = await fetch(`${base}/classify?sampleId=CIN-001`, {
    method: 'POST', body: jpeg,
    headers: { 'Content-Type': 'image/jpeg', 'x-device-id': 'ESP32-CAM-01', 'x-device-key': deviceKey }
  });
  const { status, body } = await json(response);
  assert.equal(status, 201);
  assert.equal(body.source, 'esp32-cam');
  assert.equal(body.deviceId, 'ESP32-CAM-01');
});

test('database or ML service outages return clear 503 errors and store nothing', async () => {
  const stored = analyses.length;
  databaseUp = false;
  assert.equal((await json(await upload())).body.error.code, 'DATABASE_UNAVAILABLE');
  databaseUp = true; mlUp = false;
  const ml = await json(await upload());
  assert.equal(ml.status, 503);
  assert.equal(ml.body.error.code, 'ML_SERVICE_UNAVAILABLE');
  mlUp = true;
  assert.equal(analyses.length, stored);
});

import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {RISK_DISCLAIMER} from '../src/services/riskPredictionState.js';

let vite, View, QualityProvider, ImagePanel, PredictionsPage, ImageResult, Dashboard, SensorView, SensorHistory;
before(async () => {
  vite = await createServer({root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    plugins: [react()], server: {middlewareMode: true, hmr: false}, appType: 'custom'});
  View = (await vite.ssrLoadModule('/src/components/RiskPredictionPanel.jsx')).RiskPredictionView;
  QualityProvider = (await vite.ssrLoadModule('/src/components/QualityProvider.jsx')).QualityProvider;
  ImagePanel = (await vite.ssrLoadModule('/src/components/ImageClassifierPanel.jsx')).default;
  PredictionsPage = (await vite.ssrLoadModule('/src/pages/QualityPredictions.jsx')).default;
  ImageResult = (await vite.ssrLoadModule('/src/components/ImageClassifierPanel.jsx')).ImageClassificationResult;
  Dashboard = (await vite.ssrLoadModule('/src/pages/QualityDashboard.jsx')).default;
  ({Module02SensorView: SensorView, Module02MeasurementHistory: SensorHistory} = await vite.ssrLoadModule('/src/components/Module02SensorPanel.jsx'));
});
after(async () => {await vite?.close();});
const sample = {id: 'CIN001', storageStartTimestamp: '2026-10-01T10:00:00Z'};
const reading = {_id: '000000000000000000000001', recordedAt: '2026-10-06T10:00:00Z', temperatureC: 30.5,
  relativeHumidityPercent: 76, weightGrams: 98.2, red: 145, green: 90, blue: 50};
const state = change => ({sampleId: sample.id, demo: false, hasToken: true, reading, deviceStatus: {}, readingStatus: 'ready',
  historyStatus: 'ready', predictionStatus: 'idle', history: [], pagination: {page: 1, pages: 0, total: 0},
  result: null, error: '', historyError: '', readingError: '', notice: '', ...change});
const result = category => ({_id: '000000000000000000000099', sampleId: sample.id, sensorReadingId: reading._id,
  predictedRisk: category, riskCategory: {Low: 'low', Medium: 'moderate', High: 'high'}[category],
  predictedAt: '2026-10-06T10:00:10Z', modelVersion: 'random-forest-demo-6ff77e1d306f', inputSnapshot: {storage_day: 5, weight_g: 98.2}});
const render = change => renderToStaticMarkup(React.createElement(View, {state: state(change), sample, now: Date.parse(reading.recordedAt)}));

test('risk panel renders real-reading labels, units, IDs and UTC storage duration', () => {
  const html = render();
  for (const text of ['Storage Deterioration Risk', 'MODEL 02', 'CIN001', '30.5 °C', '76 %', '98.2 g', '145 / 90 / 50', '5 completed days', 'Sensor reading timestamp', reading._id]) assert(html.includes(text), text);
  assert(html.includes('Request risk prediction')); assert(html.includes('Operator token'));
});

test('every category displays its correct label and synthetic disclaimer without confidence/horizon claims', () => {
  for (const category of ['Low', 'Medium', 'High']) {
    const html = render({result: result(category)});
    assert(html.includes(`${category} Risk`)); assert(html.includes(RISK_DISCLAIMER));
    assert(html.includes('SYNTHETIC_DEMO')); assert(html.includes('Not verified (null)'));
    assert(!/seven.day|7.day|confidence|accuracy|\d+-day forecast/i.test(html));
  }
});

test('missing readings, no sample and demo mode render helpful empty states without predictions', () => {
  const html = render({reading: null}); assert(html.includes('No stored sensor reading'));
  assert.match(html, /disabled="">Request risk prediction/);
  assert(html.includes('No synthetic risk predictions have been stored'));
  assert(render({demo: true}).includes('Turn it off'));
  const noSample = renderToStaticMarkup(React.createElement(View, {state: state({reading: null}), sample: null}));
  assert(noSample.includes('No registered sample selected'));
});

test('loading skeletons, busy controls and errors render accessibly', () => {
  const html = render({readingStatus: 'loading', historyStatus: 'loading', predictionStatus: 'loading'});
  assert(html.includes('skeleton')); assert(html.includes('Loading stored sensor reading'));
  assert(html.includes('Loading synthetic risk prediction history'));
  assert(html.includes('aria-busy="true"')); assert(html.includes('role="status"'));
  assert(render({error: 'Model 02 timed out.'}).includes('role="alert"'));
});

test('risk history is separate, paginated and identifies historical reading mismatches', () => {
  const html = render({history: [result('High')], pagination: {page: 1, pages: 2, total: 13}});
  assert(html.includes('Historical risk predictions')); assert(html.includes('High Risk'));
  assert(html.includes('Page 1 of 2')); assert(html.includes('13 records'));
  assert(html.includes('Next risk page')); assert(html.includes('Training provenance'));
  assert(render({result: {...result('Low'), sensorReadingId: '000000000000000000000002'}}).includes('different reading'));
});

test('Model 01 still renders its existing upload, capture and prediction-history UI', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(QualityProvider, null, React.createElement(ImagePanel))));
  for (const text of ['Image condition prototype', 'MODEL 01', 'Upload an actual sample photograph', 'Capture and predict', 'Stored image and classification history']) assert(html.includes(text), text);
  assert(!html.includes('Storage Deterioration Risk'));
});

test('prediction page retains sample navigation and separates legacy forecast history', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(QualityProvider, null, React.createElement(PredictionsPage))));
  assert(html.includes('Existing forecast history')); assert(html.includes('Storage Deterioration Risk'));
  assert(!html.includes('Planning horizon')); assert(!html.includes('prediction-horizon'));
  const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const route of ['module-01', 'module-02', 'module-03', 'module-04', 'images', 'predictions']) assert(routes.includes(`path="${route}"`));
});

test('responsive rules preserve small-screen cards, readable references and visible focus', () => {
  const css = readFileSync(new URL('../src/styles/quality.css', import.meta.url), 'utf8');
  assert(css.includes('@media (max-width: 700px)')); assert(css.includes('@media (max-width: 400px)'));
  assert(css.includes('overflow-wrap: anywhere')); assert(css.includes(':focus-visible'));
});


test('Model 01 result displays the stored photograph, actual class, score and classification timestamp', () => {
  const row = {sampleId: 'CIN001', imageUrl: '/api/module-02/image-classification/image01/file',
    predictedCondition: 'good_quality', modelScore: 0.8355658054351807, analysisStatus: 'completed',
    source: 'manual_upload', capturedAt: '2026-10-06T10:00:00Z', analyzedAt: '2026-10-06T10:00:10Z', modelVersion: 'test-model'};
  const html = renderToStaticMarkup(React.createElement(ImageResult, {row}));
  assert(html.includes(row.imageUrl)); assert(html.includes('good_quality')); assert(html.includes('83.6%'));
  assert(html.includes('Classification timestamp')); assert(html.includes('Manual upload')); assert(html.includes('test-model'));
  assert(html.includes('not calibrated confidence')); assert(!html.includes('SYNTHETIC_DEMO'));
});

test('Model 01 missing and incomplete results never fabricate a confidence score or timestamp', () => {
  const empty = renderToStaticMarkup(React.createElement(ImageResult));
  assert(empty.includes('No image classification available')); assert(!empty.includes('%'));
  for (const score of [undefined, NaN, Infinity, -1, 2]) {
    const html = renderToStaticMarkup(React.createElement(ImageResult, {row: {sampleId: 'CIN001',
      analysisStatus: 'completed', predictedCondition: 'Suspected Mold', modelScore: score}}));
    assert(html.includes('Not available')); assert(!html.includes('NaN')); assert(!html.includes('Infinity')); assert(!html.includes('%'));
  }
  const pending = renderToStaticMarkup(React.createElement(ImageResult, {row: {sampleId: 'CIN001', analysisStatus: 'model_unavailable'}}));
  assert(pending.includes('Not classified')); assert(pending.includes('No prediction generated'));
});

test('unified Module 02 overview retains both models and registration guidance without samples', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(QualityProvider, null, React.createElement(Dashboard))));
  for (const text of ['Unified Model 01 and Model 02 outputs', 'Image condition prototype',
    'Storage Deterioration Risk', 'SYNTHETIC_DEMO', 'Explore presentation demo', 'No registered sample selected']) assert(html.includes(text), text);
  assert(html.includes('aria-pressed="false"')); assert(!html.includes('83.6%'));
});


test('real sensor cards preserve raw versus display RGB and do not turn missing environment into zero', () => {
  const timestamp = '2026-10-06T10:00:00Z';
  const sample = {id: 'TEST-CIN001', initialWeight: 100, storageStartDate: '2026-10-01', records: [
    {timestamp: '2026-10-05T10:00:00Z', day: 4, weight: 100, temperature: null, humidity: null, rgb: [128,77,51]},
    {timestamp, day: 5, weight: 98.2, temperature: null, humidity: null, rgb: [128,77,51],
      dataOrigin: 'REAL_SENSOR', sensorStatus: {weight: 'online', color: 'online'}, rgbRaw: {red: 500,green: 300,blue: 200,clear: 1000},
      colorSettings: {gain: 4,integrationTimeMs: 50.4}, calibration: {calibratedAt: timestamp,spreadGrams: .02},
      environment: {temperature: {source: 'unavailable'}, humidity: {source: 'unavailable'}}}]};
  const html = renderToStaticMarkup(React.createElement(SensorView, {sample, now: Date.parse(timestamp)+1000}));
  for (const text of ['REAL_SENSOR RECORD', '98.2 g', '100 g', '-1.8 %', 'Raw clear counts', '1000', '128 / 77 / 51',
    'No Reading', 'unavailable', 'Calibration recorded', 'Weight history', 'RGB change history', 'not a live connection']) assert(html.includes(text), text);
  assert(!html.includes('NaN')); assert(!html.includes('0 ?C'));
  const history = renderToStaticMarkup(React.createElement(QualityProvider, null, React.createElement(SensorHistory, {sample})));
  assert(history.includes('No Reading')); assert(history.includes('500 / 300 / 200 / 1000'));
});

test('sensor offline, missing sample, and demo states remain explicit without real measurements', () => {
  const empty = renderToStaticMarkup(React.createElement(SensorView, {sample: null}));
  assert(empty.includes('Sensor Offline')); assert(empty.includes('No samples available')); assert(empty.includes('No Reading'));
  const demo = renderToStaticMarkup(React.createElement(SensorView, {sample: {id: 'DEMO', records: []}, demo: true}));
  assert(demo.includes('DEMO DATA')); assert(demo.includes('DEMO - no connected sensor')); assert(!demo.includes('REAL_SENSOR RECORD'));
  const stale = renderToStaticMarkup(React.createElement(SensorView, {sample: {records: [{timestamp: '2026-01-01', weight: null, rgb: [null,null,null]}]}}));
  assert(stale.includes('Sensor Offline')); assert(!stale.includes('background-color:rgb('));
});

test('risk view blocks two-sensor captures without environmental inputs and labels saved input sources', () => {
  const html = render({reading: {...reading, temperatureC: null, relativeHumidityPercent: null}});
  assert(html.includes('Temperature and humidity inputs required for risk prediction.'));
  assert.match(html, /disabled="">Request risk prediction/);
  const resultWithSources = {...result('Low'), inputSources: {storage_day: 'derived_completed_utc_days', weight_g: 'HX711_calibrated_raw_counts'}};
  assert(render({result: resultWithSources}).includes('HX711_calibrated_raw_counts'));
});

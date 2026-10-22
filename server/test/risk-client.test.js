import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {CATEGORY_MAP, DEMO_TITLE, DEMO_WARNING, HORIZON_NOTE, requestRiskPrediction, validateRiskResponse} from '../src/module02-risk/client.js';

export function riskOutput(category = 'Medium') {
  return {model: 'CinnaSense Model 02', title: DEMO_TITLE, model_version: 'random-forest-demo-6ff77e1d306f',
    predicted_risk: category, prediction_horizon_days: null, prediction_horizon_verified: false,
    horizon_note: HORIZON_NOTE, data_origin: 'SYNTHETIC_DEMO', validated_for_real_world_use: false,
    warning: DEMO_WARNING, predicted_at: new Date().toISOString()};
}
const input = {storage_day: 5, temperature_c: 30, humidity_percent: 75, weight_g: 98, color_r: 145, color_g: 90, color_b: 50};
const token = 'risk-client-test-token-01234567890123456789';
let original;
beforeEach(() => {
  original = {...process.env};
  process.env.MODULE02_RISK_SERVICE_TOKEN = token;
  process.env.MODULE02_RISK_SERVICE_URL = 'http://127.0.0.1:8000';
  process.env.MODULE02_RISK_TIMEOUT_MS = '1000';
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

test('risk client preserves all three categories and exact server-only request contract', async () => {
  for (const [category, mapped] of Object.entries(CATEGORY_MAP)) {
    const output = await requestRiskPrediction(input, {fetcher: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:8000/predict-risk');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-Risk-Service-Token'], token);
      assert.deepEqual(JSON.parse(options.body), input);
      assert.equal(options.redirect, 'error');
      assert(options.signal instanceof AbortSignal);
      return Response.json(riskOutput(category));
    }});
    assert.equal(CATEGORY_MAP[output.predicted_risk], mapped);
    assert(!JSON.stringify(output).includes(token));
  }
});

test('invalid ML responses never become accepted synthetic predictions', () => {
  const changes = [{predicted_risk: 'moderate'}, {predicted_risk: {toString: null}}, {data_origin: 'REAL'},
    {validated_for_real_world_use: true}, {prediction_horizon_days: 7}, {prediction_horizon_verified: true},
    {model_version: ''}, {predicted_at: '2026-02-30T12:00:00Z'}, {predicted_at: 'bad'},
    {predicted_at: new Date(Date.now() + 600_000).toISOString()}, {warning: ''}, {horizon_note: ''},
    {title: 'Seven day forecast'}, {confidence: 0.99}];
  for (const value of [null, [], {}, ...changes.map(change => ({...riskOutput(), ...change}))]) {
    assert.throws(() => validateRiskResponse(value), error => error.code === 'INVALID_RISK_RESPONSE');
  }
});

test('HTTP failures, connection errors, bad JSON and oversized bodies are sanitized', async () => {
  for (const fetcher of [
    async () => {throw new Error('secret database URI and token');},
    async () => new Response('secret traceback', {status: 503}),
    async () => new Response('not-json', {headers: {'Content-Type': 'application/json'}}),
    async () => new Response('html'),
    async () => new Response('x'.repeat(16_385), {headers: {'Content-Type': 'application/json'}}),
  ]) {
    await assert.rejects(requestRiskPrediction(input, {fetcher}), error => {
      assert(!error.message.includes('secret'));
      return ['RISK_SERVICE_UNAVAILABLE', 'INVALID_RISK_RESPONSE'].includes(error.code);
    });
  }
});

test('configuration errors fail before sending any request', async () => {
  for (const change of [{MODULE02_RISK_SERVICE_TOKEN: ''}, {MODULE02_RISK_TIMEOUT_MS: '0'},
    {MODULE02_RISK_TIMEOUT_MS: '30001'}, {MODULE02_RISK_SERVICE_URL: 'file:///tmp/model'},
    {MODULE02_RISK_SERVICE_URL: 'http://user:password@localhost:8000'}]) {
    const saved = {...process.env}; Object.assign(process.env, change);
    try {
      await assert.rejects(requestRiskPrediction(input, {fetcher: () => assert.fail('must not fetch')}),
        error => error.code === 'RISK_SERVICE_UNCONFIGURED');
    } finally {Object.assign(process.env, saved);}
  }
});

test('real local HTTP request is aborted at the bounded timeout', async () => {
  const server = createServer((_req, res) => {setTimeout(() => res.end('{}'), 500).unref();});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.MODULE02_RISK_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.MODULE02_RISK_TIMEOUT_MS = '100';
  try {
    await assert.rejects(requestRiskPrediction(input), error => error.code === 'RISK_SERVICE_TIMEOUT' && error.status === 504);
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});

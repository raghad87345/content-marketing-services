'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-mohtawa';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

const config = require('../src/config');
const { createApp, PUBLIC_DIR } = require('../src/app');
const { renderLaqtahPage } = require('../src/lib/laqtah-page');

const app = createApp();
const realFetch = global.fetch;

function withHfKeys(fn) {
  return async () => {
    config.laqtah.hfKeyId = 'kid';
    config.laqtah.hfKeySecret = 'ksecret';
    try {
      await fn();
    } finally {
      config.laqtah.hfKeyId = '';
      config.laqtah.hfKeySecret = '';
      global.fetch = realFetch;
    }
  };
}

const propsOf = (html) =>
  JSON.parse(/data-dc-script data-props="([^"]*)"/.exec(html)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

test('/laqtah redirects to the trailing-slash URL its relative assets need', async () => {
  const res = await request(app).get('/laqtah').expect(301);
  assert.equal(res.headers.location, '/laqtah/');
});

test('/laqtah/ serves the app with its own CSP; the rest of the site stays strict', async () => {
  const res = await request(app).get('/laqtah/').expect(200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /<x-dc>/);
  assert.match(res.text, /from="\.\/ios-frame\.js"/);
  assert.match(res.headers['content-security-policy'], /'unsafe-eval'/);
  assert.match(res.text, /data-laqtah-ai="0"/, 'no Anthropic key in tests');
  assert.equal(propsOf(res.text).apiBase.default, '', 'no Higgsfield keys → app shows its connect prompt');

  const site = await request(app).get('/').expect(200);
  assert.doesNotMatch(site.headers['content-security-policy'], /unsafe-eval/);
});

test('the page points the app at the same-origin proxy once Higgsfield keys exist', withHfKeys(async () => {
  const source = fs.readFileSync(path.join(PUBLIC_DIR, 'laqtah', 'index.html'), 'utf8');
  const props = propsOf(renderLaqtahPage(source));
  assert.equal(props.apiBase.default, '/api/laqtah');
  assert.equal(props.creditBalance.default, 240, 'other props keep the design defaults');
}));

test('runtime dependencies are self-hosted next to the page', () => {
  for (const file of [
    'support.js',
    'ios-frame.js',
    'laqtah-bridge.js',
    'vendor/react.production.min.js',
    'vendor/react-dom.production.min.js',
    'vendor/phosphor/regular/style.css',
    'vendor/phosphor/fill/style.css',
  ]) {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'laqtah', file)), file);
  }
});

test('Higgsfield proxy refuses to run without server keys', async () => {
  const res = await request(app)
    .post('/api/laqtah/hf/submit')
    .send({ model: 'higgsfield-ai/soul/v2/standard', input: {} })
    .expect(503);
  assert.equal(typeof res.body.error, 'string', 'the app expects a string error');
});

test('Higgsfield proxy validates model, id and upload type', withHfKeys(async () => {
  global.fetch = async () => assert.fail('must not reach Higgsfield');
  await request(app).post('/api/laqtah/hf/submit').send({ model: 'evil/model', input: {} }).expect(403);
  await request(app).get('/api/laqtah/hf/status?id=../../x').expect(400);
  await request(app).post('/api/laqtah/hf/cancel?id=short').expect(400);
  await request(app).post('/api/laqtah/hf/upload-url').send({ content_type: 'text/html' }).expect(400);
}));

test('Higgsfield proxy forwards allowed calls with server credentials', withHfKeys(async () => {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    return new Response(JSON.stringify({ request_id: 'req-12345678', status: 'queued' }), { status: 200 });
  };

  const res = await request(app)
    .post('/api/laqtah/hf/submit')
    .send({ model: 'bytedance/seedance-2.5/text-to-video', input: { prompt: 'x' }, idempotency_key: 'k1' })
    .expect(200);
  assert.equal(res.body.request_id, 'req-12345678');
  assert.equal(calls[0].url, 'https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video');
  assert.equal(calls[0].opts.headers.Authorization, 'Key kid:ksecret');
  assert.equal(calls[0].opts.headers['Idempotency-Key'], 'k1');

  await request(app).get('/api/laqtah/hf/status?id=req-12345678').expect(200);
  assert.equal(calls[1].url, 'https://api.higgsfield.ai/requests/req-12345678/status');
}));

test('Higgsfield network failures surface as 502 with a string error', withHfKeys(async () => {
  global.fetch = async () => {
    throw new Error('connect ECONNREFUSED');
  };
  const res = await request(app).get('/api/laqtah/hf/status?id=req-12345678').expect(502);
  assert.match(res.body.error, /ECONNREFUSED/);
}));

test('completion endpoint reports when AI is not configured', async () => {
  const res = await request(app)
    .post('/api/laqtah/complete')
    .send({ messages: [{ role: 'user', content: 'hi' }] })
    .expect(503);
  assert.equal(res.body.error.code, 'ai_disabled');
});

test('completion endpoint rejects malformed requests before calling Claude', async () => {
  config.ai.apiKey = 'test-key';
  try {
    for (const body of [
      {},
      { messages: [] },
      { messages: [{ role: 'system', content: 'x' }] },
      { messages: [{ role: 'user', content: { type: 'image' } }] },
      { system: 42, messages: [{ role: 'user', content: 'x' }] },
      { messages: [{ role: 'user', content: 'x'.repeat(600001) }] },
    ]) {
      const res = await request(app).post('/api/laqtah/complete').send(body).expect(400);
      assert.equal(res.body.error.code, 'validation_error');
    }
  } finally {
    config.ai.apiKey = '';
  }
});

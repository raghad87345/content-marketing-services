'use strict';

/**
 * Backend for the Laqtah mobile app (public/laqtah).
 *
 *  - /hf/*      Same-origin port of deploy/laqtah/laqtah-proxy.js: forwards an
 *               allow-listed set of Higgsfield calls with the server's keys.
 *               Responses keep the worker's `{ error: "..." }` shape because the
 *               app reads `error` as a string.
 *  - /complete  Backs `window.claude.complete` (see public/laqtah/laqtah-bridge.js)
 *               for clip selection and caption translation.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { getClient } = require('../lib/ai');

const HF = 'https://api.higgsfield.ai';
const HF_MODELS = [
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'higgsfield-ai/soul/v2/standard',
];
const UPLOAD_TYPES = /^(image\/(jpeg|jpg|png|webp|gif)|audio\/(wav|x-wav)|video\/mp4)$/;
const MAX_COMPLETION_TOKENS = 4000;
const MAX_PROMPT_CHARS = 600000;

const router = express.Router();

const fail = (res, status, error) => res.status(status).json({ error });
const idOk = (id) => /^[a-zA-Z0-9-]{8,80}$/.test(id || '');
const allowedModels = () => HF_MODELS.concat(config.laqtah.extraModels);

function hfAuth() {
  return { Authorization: `Key ${config.laqtah.hfKeyId}:${config.laqtah.hfKeySecret}` };
}

/** Relays a Higgsfield response as-is (202 carries no body). */
async function relay(res, upstream) {
  const text = upstream.status === 202 ? '' : await upstream.text();
  res.status(upstream.status).type('application/json').send(text);
}

function requireHf(_req, res, next) {
  if (!config.laqtah.hfEnabled) return fail(res, 503, 'Server is missing Higgsfield keys');
  next();
}

/** Turns network failures into the 502 the worker returned, so the app's message stays the same. */
const hfRoute = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    fail(res, 502, String((err && err.message) || err));
  }
};

router.post(
  '/hf/submit',
  requireHf,
  hfRoute(async (req, res) => {
    const { model, input, idempotency_key: idempotencyKey } = req.body || {};
    if (!allowedModels().includes(model)) return fail(res, 403, `model not allowed: ${model}`);
    const headers = { ...hfAuth(), 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 100);
    await relay(
      res,
      await fetch(`${HF}/${model}`, { method: 'POST', headers, body: JSON.stringify(input || {}) })
    );
  })
);

router.get(
  '/hf/status',
  requireHf,
  hfRoute(async (req, res) => {
    const { id } = req.query;
    if (!idOk(id)) return fail(res, 400, 'bad id');
    await relay(res, await fetch(`${HF}/requests/${id}/status`, { headers: hfAuth() }));
  })
);

router.post(
  '/hf/cancel',
  requireHf,
  hfRoute(async (req, res) => {
    const { id } = req.query;
    if (!idOk(id)) return fail(res, 400, 'bad id');
    await relay(res, await fetch(`${HF}/requests/${id}/cancel`, { method: 'POST', headers: hfAuth() }));
  })
);

router.post(
  '/hf/upload-url',
  requireHf,
  hfRoute(async (req, res) => {
    const contentType = (req.body || {}).content_type;
    if (!UPLOAD_TYPES.test(contentType || '')) return fail(res, 400, 'unsupported content type');
    await relay(
      res,
      await fetch(`${HF}/files/generate-upload-url`, {
        method: 'POST',
        headers: { ...hfAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType }),
      })
    );
  })
);

// The completion endpoint is unauthenticated (the app has no server session), so
// it gets its own tight limit on top of the global /api limiter.
const completeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.isTest ? 10000 : 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'طلبات تحليل كثيرة. انتظر دقيقة ثم أعد المحاولة.' } },
});

function readCompletion(body) {
  const { system, messages } = body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) return null;
  let chars = typeof system === 'string' ? system.length : 0;
  if (system !== undefined && typeof system !== 'string') return null;
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return null;
    chars += m.content.length;
  }
  if (chars > MAX_PROMPT_CHARS) return null;
  const maxTokens = Math.min(MAX_COMPLETION_TOKENS, Math.max(1, Number(body.max_tokens) || 1024));
  return {
    model: config.ai.model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

router.post('/complete', completeLimiter, async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({
      error: { code: 'ai_disabled', message: 'خدمة تحليل المحتوى غير مفعّلة على الخادم.' },
    });
  }
  const request = readCompletion(req.body);
  if (!request) {
    return res.status(400).json({ error: { code: 'validation_error', message: 'طلب تحليل غير صالح.' } });
  }
  try {
    const message = await anthropic.messages.create(request);
    if (message.stop_reason === 'refusal') {
      return res.status(422).json({ error: { code: 'refused', message: 'تعذر تحليل هذا المحتوى.' } });
    }
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    res.json({ text });
  } catch (err) {
    console.error('[laqtah] completion failed:', err.message);
    res.status(502).json({ error: { code: 'ai_unavailable', message: 'تعذر الاتصال بخدمة التحليل.' } });
  }
});

module.exports = router;

// Laqtah — Higgsfield API proxy (Cloudflare Worker)
// Standalone alternative to /api/laqtah/hf/* in MOHTAWA. Keeps your Higgsfield keys on the server. Deploy: `npx wrangler deploy deploy/laqtah/laqtah-proxy.js --name laqtah-proxy`
// Secrets:  wrangler secret put HF_API_KEY_ID / HF_API_KEY_SECRET / APP_TOKEN (optional)
// Vars:     ALLOWED_ORIGIN = https://your-app-domain   (or * while testing)
//           EXTRA_MODELS   = comma-separated extra model paths from console.higgsfield.ai
const HF = 'https://api.higgsfield.ai';
const MODELS = [
  'bytedance/seedance-2.5/text-to-video',
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'higgsfield-ai/soul/v2/standard',
];

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Laqtah-Token',
      'Vary': 'Origin',
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (env.APP_TOKEN && req.headers.get('X-Laqtah-Token') !== env.APP_TOKEN) return json({ error: 'unauthorized' }, 401);
    if (!env.HF_API_KEY_ID || !env.HF_API_KEY_SECRET) return json({ error: 'Server is missing Higgsfield keys' }, 500);

    const auth = { Authorization: `Key ${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}` };
    const url = new URL(req.url);
    const allowed = MODELS.concat((env.EXTRA_MODELS || '').split(',').map(s => s.trim()).filter(Boolean));
    const pass = async (r) => new Response(r.status === 202 ? null : await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const idOk = id => /^[a-zA-Z0-9-]{8,80}$/.test(id || '');

    try {
      if (url.pathname === '/hf/submit' && req.method === 'POST') {
        const { model, input, idempotency_key } = await req.json();
        if (!allowed.includes(model)) return json({ error: `model not allowed: ${model}` }, 403);
        const h = { ...auth, 'Content-Type': 'application/json' };
        if (idempotency_key) h['Idempotency-Key'] = String(idempotency_key).slice(0, 100);
        return pass(await fetch(`${HF}/${model}`, { method: 'POST', headers: h, body: JSON.stringify(input || {}) }));
      }
      if (url.pathname === '/hf/status' && req.method === 'GET') {
        const id = url.searchParams.get('id'); if (!idOk(id)) return json({ error: 'bad id' }, 400);
        return pass(await fetch(`${HF}/requests/${id}/status`, { headers: auth }));
      }
      if (url.pathname === '/hf/cancel' && req.method === 'POST') {
        const id = url.searchParams.get('id'); if (!idOk(id)) return json({ error: 'bad id' }, 400);
        return pass(await fetch(`${HF}/requests/${id}/cancel`, { method: 'POST', headers: auth }));
      }
      if (url.pathname === '/hf/upload-url' && req.method === 'POST') {
        const { content_type } = await req.json();
        if (!/^(image\/(jpeg|jpg|png|webp|gif)|audio\/(wav|x-wav)|video\/mp4)$/.test(content_type || '')) return json({ error: 'unsupported content type' }, 400);
        return pass(await fetch(`${HF}/files/generate-upload-url`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type }) }));
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 502);
    }
  },
};

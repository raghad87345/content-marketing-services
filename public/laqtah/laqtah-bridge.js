/*
 * Laqtah ↔ MOHTAWA bridge.
 *
 * The Laqtah design calls `window.claude.complete({ system, messages, max_tokens })`
 * for clip selection and caption translation. Inside Claude Design that global is
 * provided by the host; here it is backed by POST /api/laqtah/complete, which keeps
 * the Anthropic key on the server. The server marks the page with
 * data-laqtah-ai="1" only when a key is configured, so without one the app shows
 * its own "analysis unavailable" message instead of failing on every request.
 */
(function () {
  'use strict';
  if (window.claude && typeof window.claude.complete === 'function') return;
  if (document.documentElement.getAttribute('data-laqtah-ai') !== '1') return;

  window.claude = {
    complete: async function (req) {
      if (typeof req === 'string') req = { messages: [{ role: 'user', content: req }] };
      const res = await fetch('/api/laqtah/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req || {}),
      });
      let body = null;
      try {
        body = await res.json();
      } catch (e) {
        /* non-JSON error page */
      }
      if (!res.ok) {
        const message = body && body.error && (body.error.message || body.error);
        throw new Error(typeof message === 'string' ? message : 'HTTP ' + res.status);
      }
      return body.text;
    },
  };
})();

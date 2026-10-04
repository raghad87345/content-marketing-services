'use strict';

/**
 * Serves public/laqtah/index.html (the Claude Design export of the Laqtah app)
 * with its connection props filled from server config, so the same file works
 * in Claude Design and here without hand-editing.
 *
 * The DC runtime reads prop defaults from the `data-props` JSON on the
 * `<script data-dc-script>` tag; we rewrite those defaults and mark `<html>` with
 * `data-laqtah-ai` so laqtah-bridge.js knows whether to install window.claude.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const FILE = path.join(__dirname, '..', '..', 'public', 'laqtah', 'index.html');
const PROPS_RE = /(<script type="text\/x-dc" data-dc-script data-props=")([^"]*)(")/;

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encode = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function connectionDefaults() {
  const l = config.laqtah;
  return {
    // hfOn in the app is `!!apiBase`, so only point it at the proxy when keys exist.
    apiBase: l.hfEnabled ? '/api/laqtah' : '',
    youtubeImportUrl: l.youtubeImportUrl,
    googleClientId: l.googleClientId,
    googleApiKey: l.googleApiKey,
    googleAppId: l.googleAppId,
  };
}

function renderLaqtahPage(source) {
  const match = PROPS_RE.exec(source);
  if (!match) throw new Error('laqtah: data-props not found in index.html');

  const props = JSON.parse(decode(match[2]));
  for (const [key, value] of Object.entries(connectionDefaults())) {
    if (props[key]) props[key].default = value;
  }

  const ai = config.ai.enabled ? '1' : '0';
  return source
    .replace(PROPS_RE, (_m, open, _json, close) => open + encode(JSON.stringify(props)) + close)
    .replace(/<html([^>]*)>/, `<html$1 data-laqtah-ai="${ai}">`);
}

let cached = null;

function laqtahPage() {
  if (cached && config.isProduction) return cached;
  cached = renderLaqtahPage(fs.readFileSync(FILE, 'utf8'));
  return cached;
}

module.exports = { laqtahPage, renderLaqtahPage };

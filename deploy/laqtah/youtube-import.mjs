// Laqtah — YouTube import server (Node 18+, requires yt-dlp on PATH)
// For videos you own or have rights to use. Run: ALLOWED_ORIGIN=https://your-app APP_TOKEN=secret node deploy/laqtah/youtube-import.mjs
// Then set LAQTAH_YOUTUBE_IMPORT_URL in MOHTAWA to this server's URL (e.g. https://import.example.com).
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const TOKEN = process.env.APP_TOKEN || '';
const YT = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}/;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'X-Laqtah-Token');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/youtube') { res.statusCode = 404; return res.end(); }
  if (TOKEN && req.headers['x-laqtah-token'] !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'unauthorized' })); }
  const target = url.searchParams.get('url') || '';
  if (!YT.test(target)) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid YouTube URL' })); }

  const p = spawn('yt-dlp', ['-f', 'b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b', '--no-playlist', '-o', '-', target]);
  let started = false, errText = '';
  p.stdout.on('data', chunk => {
    if (!started) { started = true; res.writeHead(200, { 'Content-Type': 'video/mp4' }); }
    res.write(chunk);
  });
  p.stderr.on('data', d => { errText += d.toString(); });
  p.on('close', code => {
    if (!started) { res.statusCode = 422; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: (errText.split('\n').find(l => l.includes('ERROR')) || 'import failed').slice(0, 300) })); }
    res.end();
  });
  req.on('close', () => p.kill('SIGKILL'));
}).listen(PORT, () => console.log('Laqtah YouTube import on :' + PORT));

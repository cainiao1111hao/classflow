'use strict';
// Only application assets are exposed; source metadata and user files stay private.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/core.js', ['core.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']]
]);
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须是 1–65535 的整数');
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end();
  }
  const asset = assets.get((req.url || '/').split('?')[0]);
  if (!asset) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, asset[0]), (error, data) => {
    if (error) { res.writeHead(500); return res.end('Unable to read application asset'); }
    res.writeHead(200, {
      'Content-Type': asset[1], 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`课序 ClassFlow · http://localhost:${port}\n按 Ctrl+C 停止`));

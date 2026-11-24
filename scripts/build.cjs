'use strict';
// Optional portable single-file build. Run with: node scripts/build.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const icon = 'data:image/svg+xml,' + encodeURIComponent(read('icon.svg'));
const license = read('LICENSE');
let html = read('index.html')
  .replace('<!DOCTYPE html>', () => `<!DOCTYPE html>\n<!--\n${license}-->`)
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${read('styles.css')}</style>`)
  .replace('href="icon.svg"', () => `href="${icon}"`)
  .replace('<script src="core.js" defer></script>', () => `<script>${read('core.js').replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace('<script src="app.js" defer></script>', () => `<script>${read('app.js').replace(/<\/script/gi, '<\\/script')}</script>`);
// Keep scripts deferred until all document elements exist.
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (tag, code) => `<script>document.addEventListener('DOMContentLoaded', function () {\n${code}\n});</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'classflow.html'), html);
console.log('Built dist/classflow.html (offline, single file)');

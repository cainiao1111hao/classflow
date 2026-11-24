'use strict';
// A small event/DOM adapter exercises the actual scripts without third-party packages.
// It does not replace browser rendering, layout or CSP verification.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');
const core = require('../core.js');
const root = path.resolve(__dirname, '..');
const STATE_KEY = 'classflow.state.v1';
const TIMER_KEY = 'classflow.timer.v1';

class Element {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase(); this.id = id; this.dataset = {};
    this.style = {}; this.attributes = {}; this.children = []; this.listeners = {};
    this.value = ''; this.hidden = false; this.open = false; this._text = ''; this._html = '';
    const classes = new Set();
    this.classList = { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
  }
  get textContent() { return this._text + this.children.map(node => node.textContent || '').join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(value) {
    this._html = String(value); this.children = [];
    if (this.tagName === 'SELECT') this.value = (this._html.match(/<option value="([^"]*)"/) || [,''])[1];
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  emit(name, event = {}) { for (const handler of this.listeners[name] || []) handler(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
  querySelectorAll() { return []; }
  querySelector(selector) { return this.children.find(node => node.tagName === selector.toUpperCase()) || null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  click() { return this.onclick?.({ preventDefault() {}, target: this }); }
  remove() {}
  reset() {}
}

function oneMinuteState() {
  const state = core.createEmptyState();
  state.settings.focusMinutes = 1; state.settings.breakMinutes = 1;
  return state;
}
function makeTask(id, title = id) {
  return { id, title, course: '软件工程', dueDate: '', priority: 'medium', completed: false, createdAt: '2026-11-01T00:00:00.000Z', completedAt: null };
}
function createHarness({ storage = new Map([[STATE_KEY, JSON.stringify(oneMinuteState())]]), now = Date.parse('2026-11-24T04:00:00.000Z'), portable = false } = {}) {
  const clock = { now };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const elements = new Map();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) elements.set(match[2], new Element(match[1], match[2]));
  const filters = ['all', 'today', 'week', 'completed'].map(filter => { const el = new Element('button'); el.dataset.filter = filter; return el; });
  const brand = new Element('a');
  const documentListeners = {};
  const windowListeners = {};
  const intervals = [];
  const body = new Element('body');
  const document = {
    body, title: '', getElementById: id => { assert.ok(elements.has(id), 'Missing fixture element: ' + id); return elements.get(id); },
    querySelectorAll: selector => selector === '[data-filter]' ? filters : [],
    querySelector: selector => selector === '.brand' ? brand : filters.find(el => selector === '[data-filter="' + el.dataset.filter + '"]') || null,
    createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }),
    addEventListener: (name, handler) => { (documentListeners[name] ||= []).push(handler); }
  };
  let sequence = 0;
  const sandbox = {
    document, Date: ClockDate, console, Blob,
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    crypto: { randomUUID: () => 'test-id-' + (++sequence) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    setInterval: handler => { intervals.push(handler); return intervals.length; },
    setTimeout: () => 1, clearTimeout() {},
    addEventListener: (name, handler) => { (windowListeners[name] ||= []).push(handler); }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  if (portable) {
    const built = fs.readFileSync(path.join(root, 'dist', 'classflow.html'), 'utf8');
    assert.ok(!/<script\b[^>]*\bsrc=/.test(built), 'Portable HTML must not load external scripts');
    assert.ok(!/<link\b[^>]*\brel="stylesheet"/.test(built), 'Portable HTML must include its stylesheet');
    for (const match of built.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
    assert.equal(intervals.length, 0, 'App must wait until the document is ready');
    for (const handler of documentListeners.DOMContentLoaded || []) handler();
  } else {
    vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  }
  const result = {
    elements, storage, clock,
    click: id => elements.get(id).click(),
    tick(ms = 0) { clock.now += ms; for (const handler of intervals) handler(); },
    emit(name, event) { for (const handler of windowListeners[name] || []) handler(event); },
    data() { return JSON.parse(storage.get(STATE_KEY)); },
    fillTask(title) {
      for (const [id, value] of Object.entries({ 'task-title': title, 'task-course': '', 'task-due': '', 'task-priority': 'medium', 'task-id': '' })) elements.get(id).value = value;
      elements.get('task-form').onsubmit({ preventDefault() {} });
    },
    async importBackup(value, confirm) {
      const content = typeof value === 'string' ? value : JSON.stringify(value);
      elements.get('backup-file').files = [{ size: Buffer.byteLength(content), text: async () => content }];
      const operation = elements.get('backup-file').onchange();
      await new Promise(resolve => setImmediate(resolve));
      if (elements.get('confirm-dialog').open) result.click(confirm ? 'confirm-ok' : 'confirm-cancel');
      await operation;
    }
  };
  return result;
}

test('closing and reopening pauses elapsed focus time; resuming records exactly one session', () => {
  const first = createHarness();
  first.click('timer-toggle');
  first.tick(20000);
  first.emit('pagehide');
  assert.equal(JSON.parse(first.storage.get(TIMER_KEY)).remainingMs, 40000);
  const reopened = createHarness({ storage: first.storage, now: first.clock.now + 600000 });
  assert.equal(reopened.elements.get('timer').textContent, '00:40');
  assert.equal(reopened.data().sessions.length, 0);
  reopened.click('timer-toggle');
  reopened.tick(40000);
  assert.equal(reopened.data().sessions.length, 1);
  assert.equal(reopened.data().sessions[0].minutes, 1);
  reopened.tick(10000);
  assert.equal(reopened.data().sessions.length, 1);
  assert.equal(reopened.elements.get('mode-break').getAttribute('aria-pressed'), 'true');
});

test('an interrupted zero-second focus can be saved without creating duplicates after reload', () => {
  const storage = new Map([[STATE_KEY, JSON.stringify(oneMinuteState())]]);
  storage.set(TIMER_KEY, JSON.stringify({ mode: 'focus', remainingMs: 0, durationMs: 60000, sessionId: 'completed-focus', taskId: null, taskTitle: '' }));
  const first = createHarness({ storage });
  first.click('timer-toggle');
  assert.equal(first.data().sessions.length, 1);
  const reopened = createHarness({ storage, now: first.clock.now + 60000 });
  reopened.tick();
  assert.equal(reopened.data().sessions.length, 1);
});

test('backup recovery requires confirmation and invalid backups preserve current records', async () => {
  const app = createHarness();
  app.fillTask('现有任务');
  const before = app.storage.get(STATE_KEY);
  const backup = oneMinuteState(); backup.tasks.push(makeTask('imported', '备份中的任务'));
  await app.importBackup(backup, false);
  assert.equal(app.storage.get(STATE_KEY), before);
  await app.importBackup('{not valid json', true);
  assert.equal(app.storage.get(STATE_KEY), before);
  await app.importBackup({ ...backup, schemaVersion: 99 }, true);
  assert.equal(app.storage.get(STATE_KEY), before);
  await app.importBackup(backup, true);
  assert.equal(app.data().tasks.length, 1);
  assert.equal(app.data().tasks[0].title, '备份中的任务');
});

test('a remote tab update blocks stale task edits until the latest data is loaded', () => {
  const app = createHarness();
  const remote = oneMinuteState(); remote.tasks.push(makeTask('remote', '另一个标签的任务'));
  const raw = JSON.stringify(remote);
  app.storage.set(STATE_KEY, raw);
  app.emit('storage', { key: STATE_KEY, newValue: raw });
  app.fillTask('本标签的新任务');
  assert.equal(app.storage.get(STATE_KEY), raw);
  const reload = app.elements.get('storage-warning').querySelector('button');
  assert.ok(reload, 'Conflict warning must offer a way to load current data');
  reload.click();
  app.fillTask('本标签的新任务');
  assert.deepEqual(app.data().tasks.map(task => task.title), ['另一个标签的任务', '本标签的新任务']);
});

test('a focus ending amid a remote change is saved when loading the latest data', () => {
  const app = createHarness();
  app.click('timer-toggle');
  app.clock.now += 60000;
  const raw = JSON.stringify({ ...oneMinuteState(), tasks: [makeTask('remote')] });
  app.storage.set(STATE_KEY, raw);
  app.emit('storage', { key: STATE_KEY, newValue: raw });
  assert.equal(app.data().sessions.length, 0);
  app.elements.get('storage-warning').querySelector('button').click();
  assert.equal(app.data().tasks[0].id, 'remote');
  assert.equal(app.data().sessions.length, 1);
  assert.equal(app.data().sessions[0].completedAt, new Date(app.clock.now).toISOString());
});

test('portable build loads core before app after DOMContentLoaded and supports a complete focus', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build.cjs')], { cwd: root });
  const app = createHarness({ portable: true });
  assert.equal(app.elements.get('timer').textContent, '01:00');
  app.click('timer-toggle'); app.tick(60000);
  assert.equal(app.data().sessions.length, 1);
});

test('static server exposes only named assets and rejects private paths and writes', async t => {
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(error => error ? reject(error) : resolve(value)); });
  });
  const child = spawn(process.execPath, [path.join(root, 'server.cjs')], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local preview server did not start')), 5000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('Preview server exited: ' + code)); });
  });
  const request = (urlPath, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(home.body, /课序 ClassFlow/);
  assert.match(home.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal((await request('/core.js?version=1')).status, 200);
  for (const urlPath of ['/.git/config', '/../README.md', '/%2e%2e/README.md', '/app.js/../README.md', '/server.cjs', '/LICENSE', '/scripts/build.cjs']) {
    assert.equal((await request(urlPath)).status, 404, urlPath + ' must not expose project files');
  }
  const head = await request('/app.js', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
  const post = await request('/', 'POST'); assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
});

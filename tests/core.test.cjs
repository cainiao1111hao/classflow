'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const core = require('../core.js');

function task(id, overrides = {}) {
  return {
    id, title: '完成实验报告', course: '计算机网络', dueDate: '2026-11-22', priority: 'medium',
    completed: false, createdAt: '2026-11-01T00:00:00.000Z', completedAt: null, ...overrides
  };
}
function session(id, completedAt, minutes = 25) {
  return { id, taskId: null, taskTitle: '自由专注', minutes, completedAt };
}

test('creates independent empty states and trims user-entered task fields', () => {
  const a = core.createEmptyState();
  const b = core.createEmptyState();
  a.tasks.push(task('a'));
  a.settings.focusMinutes = 50;
  assert.equal(b.tasks.length, 0);
  assert.equal(b.settings.focusMinutes, 25);
  assert.deepEqual(core.validateTask({ title: '  数据结构实验  ', course: ' 算法 ', dueDate: '2028-02-29' }), {
    title: '数据结构实验', course: '算法', dueDate: '2028-02-29', priority: 'medium'
  });
  assert.throws(() => core.validateTask({ title: '  ' }), /任务名称/);
  assert.throws(() => core.validateTask({ title: 'x'.repeat(121) }), /120/);
  assert.throws(() => core.validateTask({ title: 'a', priority: 'urgent' }), /优先级/);
});

test('dates use local calendar days, including year boundaries and leap dates', () => {
  const now = new Date(2026, 11, 31, 23, 59, 59);
  assert.equal(core.localDateKey(now), '2026-12-31');
  assert.equal(core.daysUntil('2027-01-01', now), 1);
  assert.equal(core.daysUntil('2026-12-30', now), -1);
  assert.equal(core.daysUntil('', now), null);
  assert.throws(() => core.daysUntil('2026-02-29', now), /日期/);
  assert.throws(() => core.daysUntil('2026-13-01', now), /日期/);
  assert.throws(() => core.daysUntil('2026-02-31', now), /日期/);
  assert.throws(() => core.daysUntil('2026-2-01', now), /日期/);
  assert.throws(() => core.localDateKey(new Date('invalid')), /日期/);
});

test('local day arithmetic stays correct in UTC+8 and across DST boundaries', () => {
  const corePath = path.resolve(__dirname, '../core.js');
  function inZone(zone, code) {
    return execFileSync(process.execPath, ['-e', 'const core = require(' + JSON.stringify(corePath) + ');' + code], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8'
    }).trim();
  }
  assert.equal(inZone('Asia/Shanghai', "console.log(core.localDateKey(new Date('2026-12-31T16:30:00.000Z')));"), '2027-01-01');
  assert.equal(inZone('America/New_York', "console.log(core.daysUntil('2026-03-09', new Date(2026,2,7,23,30)));"), '2');
  assert.equal(inZone('America/New_York', "console.log(core.daysUntil('2026-11-02', new Date(2026,9,31,23,30)));"), '2');
});

test('normalizes a complete backup into a detached state', () => {
  const input = core.createEmptyState();
  input.tasks.push(task('task-1'), task('task-2', { completed: true, completedAt: '2026-11-22T00:00:00.000Z' }));
  input.sessions.push(session('s-1', '2026-11-22T00:00:00.000Z'));
  const result = core.normalizeState(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.notEqual(result.tasks[0], input.tasks[0]);
  assert.notEqual(result.settings, input.settings);
  // Deleting a task does not invalidate historical focus sessions.
  input.sessions[0].taskId = 'deleted-task';
  assert.equal(core.normalizeState(input).sessions[0].taskId, 'deleted-task');
});

test('rejects malformed backups atomically, including invalid records and duplicate IDs', () => {
  const cases = [
    null, [], {}, { ...core.createEmptyState(), schemaVersion: 2 },
    { ...core.createEmptyState(), tasks: 'wrong' },
    { ...core.createEmptyState(), tasks: [task('a'), task('a')] },
    { ...core.createEmptyState(), tasks: [task('a', { completed: 'false' })] },
    { ...core.createEmptyState(), tasks: [task('a', { dueDate: '2026-04-31' })] },
    { ...core.createEmptyState(), tasks: [task('a', { completedAt: '2026-11-22T00:00:00.000Z' })] },
    { ...core.createEmptyState(), tasks: [task('a', { completed: true, completedAt: null })] },
    { ...core.createEmptyState(), tasks: [task('a', { createdAt: '2026-02-30T00:00:00.000Z' })] },
    { ...core.createEmptyState(), tasks: [task('a', { completed: true, completedAt: '2026-10-01T00:00:00.000Z' })] },
    { ...core.createEmptyState(), tasks: [task('a', { course: 'x'.repeat(61) })] },
    { ...core.createEmptyState(), tasks: [task('a', { id: '../bad/id' })] },
    { ...core.createEmptyState(), settings: { focusMinutes: Number.MAX_SAFE_INTEGER, breakMinutes: 5 } },
    { ...core.createEmptyState(), settings: { focusMinutes: 25.5, breakMinutes: 5 } },
    { ...core.createEmptyState(), sessions: [session('s', '2026-11-22T00:00:00.000Z'), session('s', '2026-11-22T00:00:00.000Z')] },
    { ...core.createEmptyState(), sessions: [session('s', '2026-11-22T00:00:00.000Z', 0)] },
    { ...core.createEmptyState(), tasks: new Array(10001).fill(task('a')) },
    { ...core.createEmptyState(), sessions: new Array(50001).fill(session('s', '2026-11-22T00:00:00.000Z')) },
    JSON.parse('{"schemaVersion":1,"tasks":[],"sessions":[],"settings":{"focusMinutes":25,"breakMinutes":5},"__proto__":{"polluted":true}}')
  ];
  for (const input of cases) assert.throws(() => core.normalizeState(input));
  assert.equal({}.polluted, undefined);
});

test('task filters combine title/course search, rolling week, completion and course', () => {
  const now = new Date(2026, 10, 22, 12);
  const tasks = [
    task('today'), task('late', { dueDate: '2026-11-21' }),
    task('tomorrow', { title: 'ALGORITHM exercise', course: '数据结构', dueDate: '2026-11-23' }),
    task('six', { dueDate: '2026-11-28' }), task('seven', { dueDate: '2026-11-29' }),
    task('none', { dueDate: '' }),
    task('done', { completed: true, completedAt: '2026-11-22T00:00:00.000Z' })
  ];
  assert.equal(core.filterTasks(tasks, {}, now).length, 6);
  assert.deepEqual(core.filterTasks(tasks, { filter: 'today' }, now).map(t => t.id), ['today']);
  assert.deepEqual(core.filterTasks(tasks, { filter: 'week' }, now).map(t => t.id), ['today', 'tomorrow', 'six']);
  assert.deepEqual(core.filterTasks(tasks, { filter: 'completed' }, now).map(t => t.id), ['done']);
  assert.deepEqual(core.filterTasks(tasks, { query: ' algorithm ', course: '数据结构' }, now).map(t => t.id), ['tomorrow']);
  assert.equal(core.filterTasks(tasks, { query: '网络' }, now).length, 5);
});

test('sorting keeps undated tasks last and does not mutate the source array', () => {
  const tasks = [task('undated', { dueDate: '', priority: 'high' }), task('low', { priority: 'low' }), task('high', { priority: 'high' })];
  assert.deepEqual(core.filterTasks(tasks).map(t => t.id), ['high', 'low', 'undated']);
  assert.deepEqual(core.filterTasks(tasks, { sort: 'priority' }).map(t => t.id), ['high', 'undated', 'low']);
  assert.equal(tasks[0].id, 'undated');
  const newer = task('new', { createdAt: '2026-11-21T00:00:00.000Z' });
  assert.equal(core.filterTasks([...tasks, newer], { sort: 'created' })[0].id, 'new');
});

test('statistics use local completion days and exclude old/future sessions from seven-day totals', () => {
  const now = new Date(2027, 0, 2, 12);
  const state = core.createEmptyState();
  state.tasks = [
    task('a', { dueDate: '2027-01-02' }), task('b', { dueDate: '2027-01-01' }),
    task('c', { dueDate: '' }), task('d', { completed: true, completedAt: '2026-11-22T00:00:00.000Z' })
  ];
  const localISO = (year, month, day, hour) => new Date(year, month - 1, day, hour).toISOString();
  state.sessions = [
    session('today', localISO(2027, 1, 2, 10), 50),
    session('week-start', localISO(2026, 12, 27, 12), 25),
    session('yesterday', localISO(2027, 1, 1, 12), 30),
    session('old', localISO(2026, 12, 26, 12), 90),
    session('future', localISO(2027, 1, 3, 12), 90)
  ];
  const stats = core.getStats(state, now);
  assert.deepEqual({ total: stats.total, pending: stats.pending, completed: stats.completed, overdue: stats.overdue, todayDue: stats.todayDue }, { total: 4, pending: 3, completed: 1, overdue: 1, todayDue: 1 });
  assert.equal(stats.todayMinutes, 50);
  assert.equal(stats.weekMinutes, 105);
  assert.equal(stats.completionRate, 25);
  assert.equal(stats.week.length, 7);
  assert.equal(stats.week[0].date, '2026-12-27');
  assert.equal(stats.week[6].date, '2027-01-02');
  assert.equal(core.getStats(core.createEmptyState(), now).completionRate, 0);
});

test('CSV is BOM-prefixed, escapes quotes/newlines and neutralizes spreadsheet formulas', () => {
  const csv = core.toCSV([
    task('a', { title: '=HYPERLINK("https://example.invalid")', course: '+CMD' }),
    task('b', { title: '报告,"第一节"\n附录', course: '正常课程' }),
    task('c', { title: '\t=1+1', course: '  @SUM(1)' })
  ]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'));
  assert.ok(csv.includes('"\'+CMD"'));
  assert.ok(csv.includes('"报告,""第一节""\n附录"'));
  assert.ok(csv.includes('"\'\t=1+1"'));
  assert.ok(csv.includes('"\'  @SUM(1)"'));
  assert.ok(csv.endsWith('\r\n'));
});

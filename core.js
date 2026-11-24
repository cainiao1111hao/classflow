/* ClassFlow v1.0.0 — MIT License. Pure data and date utilities. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClassFlowCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const LIMITS = Object.freeze({ tasks: 10000, sessions: 50000, title: 120, course: 60, id: 80 });
  const DAY_MS = 86400000;
  const PRIORITIES = ['high', 'medium', 'low'];

  function createEmptyState() {
    return {
      schemaVersion: 1,
      tasks: [],
      sessions: [],
      settings: { focusMinutes: 25, breakMinutes: 5 }
    };
  }

  function fail(message) { throw new Error(message); }

  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      fail(label + '必须是对象');
    }
  }

  function exactKeys(value, expected, label) {
    const keys = Object.keys(value);
    if (keys.length !== expected.length || expected.some(key => !Object.hasOwn(value, key)) ||
        keys.some(key => !expected.includes(key))) fail(label + '字段不完整或包含不支持的字段');
  }

  function shortString(value, max, label, allowEmpty) {
    if (typeof value !== 'string') fail(label + '必须是文字');
    if (value.length > max) fail(label + '不能超过 ' + max + ' 个字符');
    const result = value.trim();
    if (!allowEmpty && !result) fail('请填写' + label);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result)) fail(label + '包含无效控制字符');
    return result;
  }

  function validDateParts(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parts = value.split('-').map(Number);
    const [year, month, day] = parts;
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? parts : null;
  }

  function dueDate(value) {
    if (value === '') return '';
    if (!validDateParts(value)) fail('截止日期无效，请使用 YYYY-MM-DD 格式的真实日期');
    return value;
  }

  function validISO(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(label + '必须是有效的 ISO 时间');
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) fail(label + '无效');
    return value;
  }

  function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(label + '必须是 ' + min + ' 至 ' + max + ' 之间的整数');
    return value;
  }

  function validId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value)) fail(label + '无效');
    return value;
  }

  function validateTask(fields) {
    record(fields, '任务');
    const priority = fields.priority === undefined ? 'medium' : fields.priority;
    if (!PRIORITIES.includes(priority)) fail('任务优先级无效');
    return {
      title: shortString(fields.title, LIMITS.title, '任务名称', false),
      course: shortString(fields.course === undefined ? '' : fields.course, LIMITS.course, '课程名称', true),
      dueDate: dueDate(fields.dueDate === undefined ? '' : fields.dueDate),
      priority
    };
  }

  function normalizeState(input) {
    record(input, '备份');
    if (input.schemaVersion !== 1) fail('不支持此备份版本，请使用 ClassFlow v1 格式');
    exactKeys(input, ['schemaVersion', 'tasks', 'sessions', 'settings'], '备份');
    if (!Array.isArray(input.tasks) || input.tasks.length > LIMITS.tasks) fail('任务列表无效或超过 ' + LIMITS.tasks + ' 条');
    if (!Array.isArray(input.sessions) || input.sessions.length > LIMITS.sessions) fail('专注记录无效或超过 ' + LIMITS.sessions + ' 条');
    record(input.settings, '设置');
    exactKeys(input.settings, ['focusMinutes', 'breakMinutes'], '设置');
    const settings = {
      focusMinutes: integer(input.settings.focusMinutes, 1, 180, '专注时长'),
      breakMinutes: integer(input.settings.breakMinutes, 1, 60, '休息时长')
    };
    const taskIds = new Set();
    const sessionIds = new Set();
    const tasks = input.tasks.map((item, index) => {
      const label = '第 ' + (index + 1) + ' 条任务';
      record(item, label);
      exactKeys(item, ['id', 'title', 'course', 'dueDate', 'priority', 'completed', 'createdAt', 'completedAt'], label);
      const id = validId(item.id, label + ' ID');
      if (taskIds.has(id)) fail('备份包含重复的任务 ID');
      taskIds.add(id);
      if (typeof item.completed !== 'boolean') fail(label + '完成状态无效');
      const createdAt = validISO(item.createdAt, label + '创建时间');
      let completedAt = null;
      if (item.completed) {
        completedAt = validISO(item.completedAt, label + '完成时间');
        if (Date.parse(completedAt) < Date.parse(createdAt)) fail(label + '完成时间不能早于创建时间');
      } else if (item.completedAt !== null) fail(label + '待办任务的完成时间必须为空');
      return { id, ...validateTask(item), completed: item.completed, createdAt, completedAt };
    });
    const sessions = input.sessions.map((item, index) => {
      const label = '第 ' + (index + 1) + ' 条专注记录';
      record(item, label);
      exactKeys(item, ['id', 'taskId', 'taskTitle', 'minutes', 'completedAt'], label);
      const id = validId(item.id, label + ' ID');
      if (sessionIds.has(id)) fail('备份包含重复的专注记录 ID');
      sessionIds.add(id);
      return {
        id,
        // A session may outlive its task after the task is deleted.
        taskId: item.taskId === null ? null : validId(item.taskId, label + '任务 ID'),
        taskTitle: shortString(item.taskTitle, LIMITS.title, '专注任务名称', true),
        minutes: integer(item.minutes, 1, 180, '专注分钟数'),
        completedAt: validISO(item.completedAt, label + '完成时间')
      };
    });
    return { schemaVersion: 1, tasks, sessions, settings };
  }

  function localDateKey(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) fail('日期无效');
    return String(date.getFullYear()).padStart(4, '0') + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function daysUntil(value, now = new Date()) {
    if (value === '') return null;
    const target = validDateParts(value);
    if (!target) fail('截止日期无效');
    const today = validDateParts(localDateKey(now));
    return (Date.UTC(target[0], target[1] - 1, target[2]) - Date.UTC(today[0], today[1] - 1, today[2])) / DAY_MS;
  }

  function filterTasks(tasks, options = {}, now = new Date()) {
    const { query = '', filter = 'all', course = '', sort = 'due' } = options;
    const needle = String(query).trim().toLocaleLowerCase();
    const result = tasks.filter(task => {
      if (filter === 'completed' ? !task.completed : task.completed) return false;
      if (needle && !(task.title + '\n' + task.course).toLocaleLowerCase().includes(needle)) return false;
      if (course && course !== 'all' && task.course !== course) return false;
      const days = daysUntil(task.dueDate, now);
      if (filter === 'today' && days !== 0) return false;
      if (filter === 'week' && (days === null || days < 0 || days > 6)) return false;
      return true;
    });
    const dueCompare = (a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
    const priorityCompare = (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
    const createdCompare = (a, b) => b.createdAt.localeCompare(a.createdAt);
    return result.sort((a, b) => {
      if (sort === 'priority') return priorityCompare(a, b) || dueCompare(a, b) || createdCompare(a, b);
      if (sort === 'created') return createdCompare(a, b) || dueCompare(a, b);
      return dueCompare(a, b) || priorityCompare(a, b) || createdCompare(a, b);
    });
  }

  function getStats(state, now = new Date()) {
    const today = localDateKey(now);
    const week = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date(now.getTime());
      // Midday avoids DST changes that happen around midnight.
      day.setHours(12, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      week.push({ date: localDateKey(day), label: ['日', '一', '二', '三', '四', '五', '六'][day.getDay()], minutes: 0 });
    }
    const buckets = new Map(week.map(item => [item.date, item]));
    for (const session of state.sessions) {
      const bucket = buckets.get(localDateKey(new Date(session.completedAt)));
      if (bucket) bucket.minutes += session.minutes;
    }
    const total = state.tasks.length;
    const completed = state.tasks.filter(task => task.completed).length;
    const pending = state.tasks.filter(task => !task.completed);
    return {
      total,
      pending: pending.length,
      completed,
      overdue: pending.filter(task => { const days = daysUntil(task.dueDate, now); return days !== null && days < 0; }).length,
      todayDue: pending.filter(task => task.dueDate === today).length,
      todayMinutes: buckets.get(today).minutes,
      weekMinutes: week.reduce((sum, day) => sum + day.minutes, 0),
      completionRate: total ? Math.round(completed / total * 100) : 0,
      week
    };
  }

  function toCSV(tasks) {
    const priorities = { high: '高', medium: '中', low: '低' };
    function cell(value) {
      let text = value === null || value === undefined ? '' : String(value);
      // Excel/LibreOffice may evaluate formulas even in quoted CSV fields.
      if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    const rows = [['任务名称', '课程', '截止日期', '优先级', '状态', '创建时间', '完成时间']];
    for (const task of tasks) rows.push([task.title, task.course, task.dueDate, priorities[task.priority], task.completed ? '已完成' : '待办', task.createdAt, task.completedAt]);
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  return Object.freeze({ VERSION, LIMITS, createEmptyState, normalizeState, validateTask, localDateKey, daysUntil, filterTasks, getStats, toCSV });
}));

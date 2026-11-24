/* ClassFlow v1.0.0 — MIT License. No external dependencies or network requests. */
(function () {
  'use strict';
  const C = window.ClassFlowCore;
  const $ = id => document.getElementById(id);
  const KEY = 'classflow.state.v1';
  const TIMER_KEY = 'classflow.timer.v1';
  const DEMO_KEY = 'classflow.demo.v1';
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1 1 2-2m2 1h3M8 15h3m2 0h3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
    leaf:'<path d="M20 4C9 2 3 7 5 14s14 9 15-10Z"/><path d="M3 21 15 9M9 15v-4m0 4h4"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    play:'<path d="m8 4 12 8L8 20V4Z"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    reset:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>',
    settings:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2"/><circle cx="12" cy="12" r="5"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>',
    edit:'<path d="m15 4 5 5-11 11H4v-5L15 4Zm-2 2 5 5"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>'
  };
  const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.list) + '</svg>';
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  let state = C.createEmptyState();
  let lastRaw = null;
  let storageMode = 'ok';
  let isDemo = false;
  let filter = 'all';
  let view = 'overview';
  let toastTimeout;
  let confirmResolve;
  let lastDate = C.localDateKey();
  let timer = { mode:'focus', remainingMs:1500000, durationMs:1500000, running:false, deadline:0, sessionId:uid(), taskId:null, taskTitle:'' };

  function toast(message) {
    clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').hidden = false;
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function warning(message, allowReload) {
    const el = $('storage-warning'); el.replaceChildren(); el.append(document.createTextNode(message));
    if (allowReload) {
      const button = document.createElement('button'); button.textContent = '载入最新数据';
      button.onclick = () => {
        pauseTimer();
        loadState();
        if (storageMode === 'ok') {
          if (state.sessions.some(session => session.id === timer.sessionId)) resetTimer('break');
          else if (timer.remainingMs === 0) finishTimer();
          else if (timer.remainingMs === timer.durationMs) resetTimer(timer.mode);
        }
        render();
      };
      el.append(button);
    }
    el.hidden = false;
  }
  function loadState() {
    $('storage-warning').hidden = true; state = C.createEmptyState();
    try {
      lastRaw = localStorage.getItem(KEY);
      if (lastRaw) state = C.normalizeState(JSON.parse(lastRaw));
      storageMode = 'ok'; isDemo = localStorage.getItem(DEMO_KEY) === 'true';
    } catch (error) {
      storageMode = lastRaw ? 'corrupt' : 'memory';
      warning(lastRaw ? '已有数据无法读取，原始内容已保留。请从“数据与备份”恢复有效备份，或确认清空后重新开始。' : '浏览器不允许本地存储，当前使用临时模式。请及时导出 JSON 备份，关闭页面后记录可能丢失。');
    }
  }
  function saveState(next, force) {
    let clean;
    try { clean = C.normalizeState(next); }
    catch (error) { toast(error.message); return false; }
    if (!force && (storageMode === 'corrupt' || storageMode === 'conflict')) {
      toast('请先处理顶部数据提示，再继续编辑。'); return false;
    }
    try {
      const current = localStorage.getItem(KEY);
      if (!force && current !== lastRaw) {
        storageMode = 'conflict'; pauseTimer();
        warning('另一个标签页已更改数据。为防止覆盖，请载入最新数据后继续。', true); return false;
      }
      const raw = JSON.stringify(clean);
      localStorage.setItem(KEY, raw); lastRaw = raw; storageMode = 'ok';
      $('storage-warning').hidden = true;
    } catch (error) {
      storageMode = 'memory';
      warning('本地存储不可用或空间已满。更改仅暂存在当前页面，请立即导出 JSON 备份。');
    }
    state = clean; render(); return true;
  }
  function change(mutator) { const next = JSON.parse(JSON.stringify(state)); mutator(next); return saveState(next); }
  function setDemo(value) {
    isDemo = value;
    try { localStorage.setItem(DEMO_KEY, value ? 'true' : 'false'); } catch (_) { /* Temporary mode still works. */ }
    $('demo-banner').hidden = !value;
  }
  function confirmAction(title, message, label) {
    if ($('confirm-dialog').open) return Promise.resolve(false);
    $('confirm-title').textContent = title; $('confirm-message').textContent = message;
    $('confirm-ok').textContent = label || '确认'; $('confirm-dialog').showModal(); $('confirm-cancel').focus();
    return new Promise(resolve => { confirmResolve = resolve; });
  }
  function resolveConfirm(value) { $('confirm-dialog').close(); const resolve = confirmResolve; confirmResolve = null; if (resolve) resolve(value); }
  $('confirm-ok').onclick = () => resolveConfirm(true);
  $('confirm-cancel').onclick = () => resolveConfirm(false);
  $('confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); resolveConfirm(false); });
  document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });

  function setView(next) {
    view = next; document.body.dataset.view = view;
    const labels = { overview:'学习总览', tasks:'课程任务', focus:'专注时光', data:'数据与备份' };
    const titles = { overview:'今天，也从容一点。', tasks:'每一件事，都有着落。', focus:'此刻，只做一件事。', data:'把进步，好好保存。' };
    const descriptions = { overview:'理清手头的任务，把时间留给重要的事。', tasks:'整理课程任务，让截止日期不再措手不及。', focus:'关掉分心的念头，给自己一段完整的时间。', data:'定期备份，为每一份努力留下记录。' };
    $('view-label').textContent = labels[view]; $('page-title').textContent = titles[view]; $('page-description').textContent = descriptions[view];
    $('overview-stats').hidden = view === 'data' || view === 'focus';
    $('dashboard').hidden = view === 'data'; $('data-panel').hidden = view !== 'data';
    $('tasks-panel').hidden = view === 'focus'; $('right-column').hidden = view === 'tasks';
    $('add-task').hidden = view === 'data' || view === 'focus';
    document.querySelectorAll('[data-view]').forEach(el => { if (el.tagName === 'BUTTON') { el.classList.toggle('active', el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); } });
  }
  document.querySelectorAll('button[data-view]').forEach(button => { button.onclick = () => { setView(button.dataset.view); }; });
  document.querySelector('.brand').onclick = event => { event.preventDefault(); setView('overview'); };
  function render() {
    const stats = C.getStats(state);
    $('date-label').textContent = new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' });
    $('stat-pending').innerHTML = stats.pending + '<span>项</span>';
    $('stat-today').innerHTML = stats.todayDue + '<span>项</span>';
    $('stat-focus').innerHTML = stats.todayMinutes + '<span>分钟</span>';
    $('stat-rate').innerHTML = stats.completionRate + '<span>%</span>';
    $('stat-overdue').textContent = stats.overdue ? stats.overdue + ' 项已逾期，记得安排时间' : '一切都在计划之中';
    $('stat-overdue').classList.toggle('urgent', stats.overdue > 0);
    $('stat-week').textContent = '近七天累计 ' + stats.weekMinutes + ' 分钟';
    $('stat-complete').textContent = stats.total ? '已完成 ' + stats.completed + ' / ' + stats.total + ' 项任务' : '每一个小进展，都值得记录';
    $('nav-count').textContent = stats.pending; $('task-count').textContent = stats.pending;
    const courses = [...new Set(state.tasks.map(t => t.course).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-CN'));
    const selectedCourse = $('course-filter').value;
    $('course-filter').innerHTML = '<option value="">全部课程</option>' + courses.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    if (courses.includes(selectedCourse)) $('course-filter').value = selectedCourse;
    $('courses-list').innerHTML = courses.map(c => '<option value="' + esc(c) + '"></option>').join('');
    const selectedTask = timer.taskId || $('focus-task').value;
    $('focus-task').innerHTML = '<option value="">自由专注</option>' + state.tasks.filter(t => !t.completed).map(t => '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>').join('');
    if (timer.taskId && !state.tasks.some(t => !t.completed && t.id === timer.taskId)) {
      const option = document.createElement('option'); option.value = timer.taskId; option.textContent = timer.taskTitle || '原关联任务'; $('focus-task').append(option);
    }
    $('focus-task').value = selectedTask || '';
    $('demo-banner').hidden = !isDemo;
    $('week-total').textContent = stats.weekMinutes;
    const max = Math.max(...stats.week.map(d => d.minutes), 60);
    $('week-chart').innerHTML = stats.week.map((d,i) => '<div class="chart-column' + (i===6?' today':'') + '" title="' + d.date + '：' + d.minutes + ' 分钟"><div class="chart-bar-area"><div class="chart-bar"></div></div><span class="chart-label">' + (i===6?'今':d.label) + '</span></div>').join('');
    // Height is applied through CSSOM so the local server can keep inline style attributes disabled.
    $('week-chart').querySelectorAll('.chart-bar').forEach((el,i) => { el.style.height = Math.max(3, Math.round(stats.week[i].minutes/max*100)) + '%'; });
    $('week-chart').setAttribute('aria-label', stats.week.map(d => d.date + '：' + d.minutes + '分钟').join('；'));
    renderTasks(); renderTimer();
  }
  function dueLabel(task) {
    const days = C.daysUntil(task.dueDate);
    if (days === null) return '<span class="due-tag">未设截止</span>';
    let text = task.dueDate.slice(5).replace('-', '月') + '日';
    let style = '';
    if (!task.completed && days < 0) { text = '逾期 ' + Math.abs(days) + ' 天'; style = ' overdue'; }
    else if (!task.completed && days === 0) { text = '今天截止'; style = ' today'; }
    else if (!task.completed && days === 1) text = '明天截止';
    return '<span class="due-tag' + style + '" title="' + esc(task.dueDate) + '">' + icon('calendar') + text + '</span>';
  }
  function renderTasks() {
    const tasks = C.filterTasks(state.tasks, { filter, query:$('search').value, course:$('course-filter').value, sort:$('sort').value });
    const list = $('task-list');
    $('list-summary').textContent = tasks.length ? '当前显示 ' + tasks.length + ' 项' + (filter === 'completed' ? '已完成任务' : '待办任务') : '从一件小事开始。';
    if (!tasks.length) {
      const first = !state.tasks.length;
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon(first?'leaf':'check') + '</div><h3>' + (first?'给今天一个小小的开始':'这里暂时没有任务') + '</h3><p>' + (first?'记下课程作业、实验或阅读计划。\n从一个清晰的小目标开始。':'试试其他筛选条件，或为接下来的学习添加一个任务。') + '</p><div class="empty-actions"><button class="text-button" data-action="add">' + icon('plus') + '添加任务</button>' + (first?'<button class="text-button" data-action="demo">体验示例数据</button>':'') + '</div></div>';
    } else {
      const names = { high:'重要', medium:'普通', low:'较低' };
      list.innerHTML = tasks.map(t => '<article class="task-row' + (t.completed?' completed':'') + '" data-id="' + esc(t.id) + '"><input class="task-check" type="checkbox" data-action="complete" aria-label="' + esc((t.completed?'重新打开任务：':'完成任务：') + t.title) + '"' + (t.completed?' checked':'') + '><div class="task-details"><div class="task-title-row"><h3 class="task-title">' + esc(t.title) + '</h3><span class="priority ' + t.priority + '">' + names[t.priority] + '</span></div><div class="task-meta">' + (t.course?'<span class="course-tag">' + esc(t.course) + '</span>':'') + dueLabel(t) + '<div class="task-row-actions"><button data-action="edit" aria-label="' + esc('编辑任务：' + t.title) + '" title="编辑">' + icon('edit') + '</button><button data-action="delete" aria-label="' + esc('删除任务：' + t.title) + '" title="删除">' + icon('trash') + '</button></div></div></div></article>').join('');
    }
  }
  $('task-list').onclick = async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'add') return openTask();
    if (action === 'demo') return loadDemo();
    const row = button.closest('[data-id]'); const task = state.tasks.find(t => t.id === row.dataset.id); if (!task) return;
    if (action === 'edit') openTask(task);
    if (action === 'complete') {
      const completed = !task.completed;
      if (change(next => { const t = next.tasks.find(t => t.id === task.id); t.completed = completed; t.completedAt = completed ? new Date(Math.max(Date.now(),Date.parse(t.createdAt))).toISOString() : null; })) toast(completed ? '又完成了一件事，做得不错。' : '任务已重新打开。');
      else renderTasks();
    }
    if (action === 'delete' && await confirmAction('删除这项任务？', '“' + task.title + '”将被删除。相关的专注记录仍会保留。', '删除任务')) {
      if (change(next => { next.tasks = next.tasks.filter(t => t.id !== task.id); })) toast('任务已删除。');
    }
  };
  function openTask(task) {
    $('task-form').reset(); $('task-error').textContent = ''; $('task-id').value = task ? task.id : '';
    $('task-dialog-title').textContent = task ? '编辑任务' : '新建任务';
    if (task) { $('task-title').value = task.title; $('task-course').value = task.course; $('task-due').value = task.dueDate; $('task-priority').value = task.priority; }
    $('task-dialog').showModal(); $('task-title').focus();
  }
  $('add-task').onclick = () => openTask();
  $('task-form').onsubmit = event => {
    event.preventDefault();
    try {
      const fields = C.validateTask({ title:$('task-title').value, course:$('task-course').value, dueDate:$('task-due').value, priority:$('task-priority').value });
      const id = $('task-id').value;
      if (change(next => { const index = next.tasks.findIndex(t => t.id === id); if (index >= 0) next.tasks[index] = Object.assign({}, next.tasks[index], fields); else next.tasks.push(Object.assign({ id:uid(), completed:false, createdAt:new Date().toISOString(), completedAt:null }, fields)); })) {
        $('task-dialog').close(); toast(id ? '任务已更新。' : '新任务已记下，按自己的节奏来。');
      }
    } catch (error) { $('task-error').textContent = error.message; }
  };
  $('search').oninput = renderTasks; $('course-filter').onchange = renderTasks; $('sort').onchange = renderTasks;
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.onclick = () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-selected', String(b === button))); renderTasks(); };
    button.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); const tabs = [...document.querySelectorAll('[data-filter]')]; const i = tabs.indexOf(button);
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (i + (event.key==='ArrowRight'?1:-1) + tabs.length)%tabs.length]; next.click(); next.focus();
    };
  });

  function renderTimer() {
    const seconds = Math.max(0, Math.ceil(timer.remainingMs/1000));
    const text = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
    $('timer').textContent = text;
    $('timer-progress').style.strokeDashoffset = String(615.752 * (1 - Math.max(0,timer.remainingMs)/timer.durationMs));
    $('timer-toggle').innerHTML = icon(timer.running?'pause':'play') + (timer.running?'暂停计时':timer.remainingMs === 0?'保存专注记录':timer.remainingMs < timer.durationMs?'继续计时':timer.mode==='focus'?'开始专注':'开始休息');
    $('focus-status').textContent = timer.running ? (timer.mode==='focus'?'专注进行中':'休息一下') : timer.remainingMs === 0?'待保存':timer.remainingMs < timer.durationMs?'已暂停':'准备就绪';
    $('timer-caption').textContent = timer.mode==='focus'?'给当下，全心投入':'放松一下，再出发';
    $('mode-focus').classList.toggle('selected',timer.mode==='focus'); $('mode-break').classList.toggle('selected',timer.mode==='break');
    $('mode-focus').setAttribute('aria-pressed',String(timer.mode==='focus')); $('mode-break').setAttribute('aria-pressed',String(timer.mode==='break'));
    $('focus-task').disabled = timer.running || timer.remainingMs < timer.durationMs || timer.mode==='break';
    document.title = timer.running ? text + ' · ' + (timer.mode==='focus'?'专注中':'休息中') + ' · 课序' : '课序 ClassFlow · 让学习有条理';
  }
  function saveTimer() {
    try {
      const draft = { mode:timer.mode, remainingMs:timer.remainingMs, durationMs:timer.durationMs, sessionId:timer.sessionId, taskId:timer.taskId, taskTitle:timer.taskTitle, deadline:timer.remainingMs === 0 ? timer.deadline : 0 };
      localStorage.setItem(TIMER_KEY,JSON.stringify(draft));
    } catch (_) { /* Main storage banner already explains temporary mode. */ }
  }
  function resetTimer(mode) {
    const durationMs = (mode==='break'?state.settings.breakMinutes:state.settings.focusMinutes)*60000;
    timer = { mode, durationMs, remainingMs:durationMs, running:false, deadline:0, sessionId:uid(), taskId:null, taskTitle:'' };
    saveTimer(); renderTimer();
  }
  function pauseTimer() {
    if (!timer.running) return;
    timer.remainingMs = Math.min(timer.durationMs, Math.max(0, timer.deadline - Date.now()));
    timer.running = false;
    if (!timer.remainingMs && storageMode !== 'conflict' && storageMode !== 'corrupt') finishTimer();
    else { saveTimer(); renderTimer(); }
  }
  function finishTimer() {
    timer.running = false; timer.remainingMs = 0;
    if (timer.mode==='focus') {
      const session = { id:timer.sessionId, taskId:timer.taskId, taskTitle:timer.taskTitle, minutes:Math.round(timer.durationMs/60000), completedAt:new Date(timer.deadline || Date.now()).toISOString() };
      if (!change(next => { if (!next.sessions.some(s => s.id===session.id)) next.sessions.push(session); })) { saveTimer(); renderTimer(); return; }
      resetTimer('break'); toast('一个专注时段完成了。学习时间已记录，准备休息一下吧。');
    } else { resetTimer('focus'); toast('休息结束，准备好后再开始下一段专注。'); }
  }
  function tick() {
    if (timer.running) { timer.remainingMs = Math.min(timer.durationMs, Math.max(0,timer.deadline-Date.now())); if (!timer.remainingMs) finishTimer(); else renderTimer(); }
    if (lastDate !== C.localDateKey()) { lastDate = C.localDateKey(); render(); }
  }
  $('timer-toggle').onclick = () => {
    if (timer.running) return pauseTimer();
    if (storageMode==='conflict' || storageMode==='corrupt') return toast('请先处理顶部数据提示，再开始专注。');
    if (!timer.remainingMs) return finishTimer();
    if (timer.remainingMs === timer.durationMs) { const task = state.tasks.find(t => t.id === $('focus-task').value); timer.taskId = task ? task.id : null; timer.taskTitle = task ? task.title : ''; }
    timer.deadline = Date.now()+timer.remainingMs; timer.running = true; saveTimer(); renderTimer(); tick();
  };
  async function requestReset(mode) {
    if (timer.remainingMs < timer.durationMs || timer.running) {
      if (!await confirmAction('重新开始计时？','当前尚未完成的时段不会计入专注统计。','重新开始')) return;
    }
    resetTimer(mode);
  }
  $('timer-reset').onclick = () => requestReset(timer.mode);
  $('mode-focus').onclick = () => { if (timer.mode!=='focus') requestReset('focus'); };
  $('mode-break').onclick = () => { if (timer.mode!=='break') requestReset('break'); };
  $('timer-settings').onclick = () => { $('focus-minutes').value = state.settings.focusMinutes; $('break-minutes').value = state.settings.breakMinutes; $('settings-dialog').showModal(); };
  $('settings-form').onsubmit = async event => {
    event.preventDefault();
    if ((timer.running || timer.remainingMs < timer.durationMs) && !await confirmAction('保存设置并重置计时？','当前尚未完成的时段不会计入专注统计。','保存并重置')) return;
    if (change(next => { next.settings.focusMinutes = Number($('focus-minutes').value); next.settings.breakMinutes = Number($('break-minutes').value); })) { resetTimer(timer.mode); $('settings-dialog').close(); toast('计时时长已更新。'); }
  };
  window.addEventListener('pagehide',() => { pauseTimer(); saveTimer(); });
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('focus',tick);
  window.addEventListener('storage',event => {
    if ((event.key===KEY || event.key===null) && event.newValue!==lastRaw) { storageMode='conflict'; pauseTimer(); warning('另一个标签页已更改数据。请载入最新数据后继续，避免覆盖已有记录。',true); }
  });

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content],{type})); const anchor = document.createElement('a');
    anchor.href=url; anchor.download=filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),15000);
  }
  $('export-csv').onclick = () => { download('classflow-tasks-' + C.localDateKey() + '.csv', C.toCSV(state.tasks),'text/csv;charset=utf-8'); toast('任务清单已导出。CSV 不包含专注记录，请用 JSON 做完整备份。'); };
  $('backup-export').onclick = () => { download('classflow-backup-' + C.localDateKey() + '.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'); toast('完整备份已导出，请妥善保存。'); };
  $('backup-import').onclick = () => { $('backup-file').value=''; $('backup-file').click(); };
  $('backup-file').onchange = async () => {
    const file = $('backup-file').files[0]; if (!file) return;
    try {
      if (file.size > 15*1024*1024) throw new Error('备份文件过大，请选择不超过 15 MB 的 JSON 文件。');
      const imported = C.normalizeState(JSON.parse(await file.text()));
      if (!await confirmAction('用备份替换当前数据？','备份中有 ' + imported.tasks.length + ' 项任务和 ' + imported.sessions.length + ' 条专注记录。当前数据会被替换，建议先导出完整备份。','恢复备份')) return;
      if (saveState(imported,true)) { resetTimer('focus'); setDemo(false); toast('备份已恢复。'); }
    } catch (error) { toast('未导入：' + (error instanceof SyntaxError ? '文件不是有效的 JSON 备份。' : error.message)); }
    finally { $('backup-file').value=''; }
  };
  async function clearData(onlyDemo) {
    if (!await confirmAction(onlyDemo?'清空示例数据？':'清空全部数据？','任务、专注记录和设置会全部清空。此操作无法撤销，请先导出备份。','确认清空')) return;
    if (saveState(C.createEmptyState(),true)) { setDemo(false); resetTimer('focus'); $('search').value=''; filter='all'; document.querySelector('[data-filter="all"]').click(); render(); toast('数据已清空，可以重新开始了。'); }
  }
  $('clear-all').onclick = () => clearData(false); $('clear-demo').onclick = () => clearData(true);
  async function loadDemo() {
    if (state.tasks.length || state.sessions.length || lastRaw !== null || storageMode==='corrupt' || storageMode==='conflict') {
      if (!await confirmAction('载入示例并替换当前数据？','示例数据仅供体验，将替换当前任务、专注记录和设置。请先导出备份。','载入示例')) return;
    }
    const sample=C.createEmptyState();
    const date = offset => { const d=new Date(); d.setDate(d.getDate()+offset); return C.localDateKey(d); };
    const created=new Date(Date.now()-7*86400000).toISOString();
    const definitions=[['完成二叉树遍历实验','数据结构',0,'high',false],['整理第三章课堂笔记','计算机网络',1,'medium',false],['完成图书管理系统原型','软件工程',3,'high',false],['阅读并标注英文论文','学术英语',5,'low',false],['提交线性代数第二次作业','线性代数',-1,'medium',true]];
    definitions.forEach((d,i) => { sample.tasks.push({id:'demo-task-'+i,title:d[0],course:d[1],dueDate:date(d[2]),priority:d[3],completed:d[4],createdAt:created,completedAt:d[4]?new Date().toISOString():null}); });
    [25,50,0,75,50,25,50].forEach((minutes,i) => { if(minutes){ const day=new Date(); day.setDate(day.getDate()-6+i); if(i!==6) day.setHours(18,0,0,0); sample.sessions.push({id:'demo-session-'+i,taskId:null,taskTitle:'示例专注记录',minutes,completedAt:day.toISOString()}); } });
    if (saveState(sample,true)) { setDemo(true); resetTimer('focus'); filter='all'; $('search').value=''; document.querySelector('[data-filter="all"]').click(); render(); setView('overview'); toast('已载入示例，可随时清空。示例不代表真实学习记录。'); }
  }
  $('load-demo').onclick=loadDemo;
  $('help-button').onclick=() => $('help-dialog').showModal();
  loadState(); resetTimerWithoutSaving(); render(); setView('overview');
  function resetTimerWithoutSaving() {
    const duration=state.settings.focusMinutes*60000;
    timer.durationMs=duration; timer.remainingMs=duration;
    try {
      const draft=JSON.parse(localStorage.getItem(TIMER_KEY));
      if(draft && ['focus','break'].includes(draft.mode) && Number.isFinite(draft.remainingMs) && Number.isInteger(draft.durationMs/60000) && draft.durationMs>=60000 && draft.durationMs<=(draft.mode==='focus'?180:60)*60000 && draft.remainingMs>=0 && draft.remainingMs<=draft.durationMs && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(draft.sessionId) && (draft.taskId===null || typeof draft.taskId==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(draft.taskId)) && typeof draft.taskTitle==='string' && draft.taskTitle.length<=120) {
        const deadline = Number.isSafeInteger(draft.deadline) && draft.deadline > 0 && draft.deadline <= Date.now() ? draft.deadline : 0;
        if (state.sessions.some(session => session.id === draft.sessionId)) resetTimer('break');
        else timer = { mode:draft.mode, remainingMs:draft.remainingMs, durationMs:draft.durationMs, sessionId:draft.sessionId, taskId:draft.taskId, taskTitle:draft.taskTitle, running:false, deadline };
      }
    } catch (_) { /* A corrupt timer draft never invalidates learning records. */ }
  }
  setInterval(tick,250);
}());

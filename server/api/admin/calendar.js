import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import {
    BOOKING_SLOT_TIMES,
    appendCalendarHistory,
    clearCalendarBlock,
    getBlockedSlotsInRange,
    getCalendarHistory,
    seedDefaultCalendarBlocks,
    setCalendarBlockRange,
} from '../_lib/store.js';

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function getSuppliedKey(req) {
    return req.headers['x-calendar-key'] || req.headers['x-admin-key'];
}

function getExpectedKey() {
    return process.env.CALENDAR_API_KEY || process.env.ADMIN_API_KEY;
}

const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calendar Manager | A10tion To Detail</title>
<style>
  :root {
    --bg:#f2f5f1;
    --panel:#fff;
    --panel-soft:#edf3ee;
    --line:#d9e2db;
    --ink:#16251d;
    --muted:#586d61;
    --sage:#294633;
    --sage-soft:#dceae0;
    --sage-ink:#1a2a20;
    --danger:#b63737;
    --danger-soft:#f7e4e4;
    --accent:#c1dec7;
    --shadow:0 20px 40px -28px rgba(18,26,21,.35);
  }

  .login-overlay {
    position: fixed; inset: 0; background: rgba(11, 17, 15, 0.72); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 20;
  }
  .login-card {
    width: min(440px, 100%); background: white; border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); padding: 26px 22px;
  }
  .login-card h2 { margin: 0 0 8px; font-size: 28px; }
  .login-card p { margin: 0 0 18px; color: var(--muted); line-height: 1.6; }
  .login-form { display: grid; gap: 12px; }
  .login-form input { width: 100%; padding: 12px 13px; border-radius: 10px; border: 1px solid var(--line); font-size: 14px; }
  .login-actions { display: flex; gap: 10px; margin-top: 6px; }
  .login-actions button { flex: 1; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
  body { padding: 28px 16px 48px; }
  .shell { max-width: 1180px; margin: 0 auto; }
  .topbar {
    background: linear-gradient(135deg, #101d15, #1d3428 54%, #2b4b3a 100%);
    color: white; border-radius: 18px 18px 0 0; padding: 26px 28px; box-shadow: var(--shadow);
  }
  .eyebrow { margin: 0; font-size: 12px; letter-spacing: .15em; text-transform: uppercase; color: #bfd0bf; }
  .heading { margin: 10px 0 0; font-size: clamp(28px, 3vw, 42px); }
  .sub { margin: 10px 0 0; max-width: 760px; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,.78); }
  .panel {
    background: var(--panel); border: 1px solid var(--line); border-top: 0; border-radius: 0 0 18px 18px; padding: 22px 24px 24px; box-shadow: var(--shadow);
  }
  .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 18px; }
  .toolbar input { flex: 1 1 260px; min-width: 200px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); font-size: 14px; }
  .button-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
  button {
    appearance: none; border: 0; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; transition: transform .15s ease, opacity .15s ease;
  }
  button:hover { transform: translateY(-1px); }
  button:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .primary { background: var(--sage); color: white; padding: 12px 16px; }
  .secondary { background: var(--panel-soft); color: var(--sage-ink); padding: 12px 16px; }
  .ghost { background: #f8faf9; color: var(--ink); border: 1px solid var(--line); padding: 10px 12px; }
  .legend { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 20px; color: var(--muted); font-size: 12px; }
  .chip { display: inline-flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 999px; background: #f6faf7; border:1px solid var(--line); }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(218px, 1fr)); gap: 12px; }
  .date-card {
    background: #f9fbfa; border:1px solid var(--line); border-radius: 14px; padding: 12px; }
  .date-head { display:flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .date-name { font-weight: 700; font-size: 14px; }
  .date-meta { font-size: 11px; color: var(--muted); }
  .slot-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
  .slot {
    display:flex; align-items:center; justify-content:space-between; gap: 8px; width:100%; border-radius: 10px; border: 1px solid var(--line); background: white; padding: 8px 9px; font-size: 12px; color: var(--ink);
  }
  .slot.blocked { background: var(--danger-soft); border-color: #e7b2b2; color: #7b2121; }
  .slot.blocked .state-flag { background: var(--danger); }
  .state-flag { width: 8px; height: 8px; border-radius: 50%; background: #9cb4a4; }
  .date-actions { display:flex; gap:8px; margin-top:12px; }
  .date-actions button { flex:1; padding: 8px 10px; border-radius: 8px; font-size: 11px; }
  .status { min-height: 24px; margin-top: 16px; font-size: 13px; color: var(--sage-ink); }
  .status.error { color: var(--danger); }
  .status.ok { color: #166e3d; }
  .summary { margin-top: 16px; padding: 12px 14px; background: var(--panel-soft); border:1px solid var(--line); border-radius: 12px; font-size: 12px; color: var(--muted); white-space: pre-wrap; }
  @media (max-width: 620px) { body { padding: 14px 10px 32px; } .panel { padding: 18px 14px 20px; } .toolbar { flex-direction: column; align-items: stretch; } .button-row { display:grid; grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <p class="eyebrow">A10tion To Detail · Admin</p>
    <h1 class="heading">Calendar manager</h1>
    <p class="sub">Block or reopen any timeslot in real time. These updates feed directly into the public booking calendar and refresh the availability used by the live website.</p>
  </header>
  <main class="panel">
    <div class="toolbar">
      <input id="adminKey" type="password" autocomplete="current-password" placeholder="Calendar API key" aria-label="Calendar API key">
      <button id="loginBtn" class="secondary" type="button">Staff login</button>
      <button id="load" class="secondary" type="button">Load live calendar</button>
      <button id="save" class="primary" type="button">Save changes</button>
    </div>
    <div class="button-row">
      <button id="viewWeek" class="secondary" type="button">Week view</button>
      <button id="view30" class="secondary" type="button">30-day view</button>
      <button id="viewMonth" class="secondary" type="button">Month overview</button>
      <button id="blockNext30" class="secondary" type="button">Block next 30 days</button>
      <button id="clearNext30" class="ghost" type="button">Clear next 30 days</button>
      <button id="exportCsv" class="ghost" type="button">Export CSV</button>
    </div>
    <div class="legend">
      <span class="chip"><span class="dot" style="background:#9cb4a4"></span>Available</span>
      <span class="chip"><span class="dot" style="background:#b63737"></span>Blocked</span>
    </div>
    <div id="calendar" class="grid"></div>
    <div id="history" style="margin-top:18px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#f8faf8;max-height:180px;overflow:auto;font-size:12px;color:var(--muted)"></div>
    <p id="status" class="status" role="status"></p>
    <pre id="summary" class="summary"></pre>
  </main>
</div>
<div id="loginOverlay" class="login-overlay">
  <div class="login-card">
    <h2>Staff access</h2>
    <p>Enter your calendar key to manage the public booking schedule.</p>
    <div class="login-form">
      <input id="loginKeyInput" type="password" autocomplete="current-password" placeholder="Calendar API key">
      <div class="login-actions">
        <button id="unlockCalendar" class="primary" type="button">Unlock</button>
        <button id="closeLogin" class="ghost" type="button">Close</button>
      </div>
    </div>
  </div>
</div>
<script>
  const slots = ['08:00','10:30','13:00','15:30','18:00'];
  const keyInput = document.getElementById('adminKey');
  const loginKeyInput = document.getElementById('loginKeyInput');
  const calendarNode = document.getElementById('calendar');
  const statusNode = document.getElementById('status');
  const summaryNode = document.getElementById('summary');
  const historyNode = document.getElementById('history');
  const loginOverlay = document.getElementById('loginOverlay');
  const state = { blockedSlots: {}, history: [], viewMode: '30', isDragging: false, dragCache: new Set() };

  function setStatus(message, tone = '') {
    statusNode.textContent = message;
    statusNode.className = 'status' + (tone ? ' ' + tone : '');
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  }

  function isoDate(date) {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dateFromIso(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function buildDateRange(days = 30) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return isoDate(date);
    });
  }

  function buildWeekRange() {
    const start = new Date();
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return isoDate(date);
    });
  }

  function getVisibleDates() {
    if (state.viewMode === 'week') return buildWeekRange();
    if (state.viewMode === 'month') return buildDateRange(30);
    return buildDateRange(30);
  }

  function renderHistory() {
    if (!state.history.length) {
      historyNode.innerHTML = '<strong>Recent activity</strong><div style="margin-top:8px; color:var(--muted)">No recent changes yet.</div>';
      return;
    }

    const rows = state.history.slice(0, 12).map((entry) => {
      const stamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : 'now';
      return '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><strong>' + entry.action + '</strong> · ' + entry.date + ' ' + (entry.time || 'all slots') + ' · ' + stamp + '</div>';
    }).join('');
    historyNode.innerHTML = '<strong>Recent activity</strong>' + rows;
  }

  function exportCsv() {
    const rows = [['date', 'time', 'status']];
    getVisibleDates().forEach((date) => {
      const blockedSet = new Set(state.blockedSlots[date] || []);
      slots.forEach((time) => {
        rows.push([date, time, blockedSet.has(time) ? 'blocked' : 'available']);
      });
    });

    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'a10tion-booking-calendar-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function toggleSlot(date, time, reason = 'toggle') {
    const next = { ...state.blockedSlots };
    const set = new Set(next[date] || []);
    const isBlocked = set.has(time);
    if (isBlocked) set.delete(time); else set.add(time);
    next[date] = [...set].sort();
    if (!next[date].length) delete next[date];
    state.blockedSlots = next;
    state.history.unshift({
      action: isBlocked ? 'unblocked' : 'blocked',
      date,
      time,
      timestamp: new Date().toISOString(),
    });
    state.history = state.history.slice(0, 20);
    renderHistory();
    renderCalendar();
    setStatus('Live update queued for ' + date + ' ' + time + '.', 'ok');
  }

  function renderMonthOverview() {
    const monthDates = buildDateRange(30);
    const cells = monthDates.map((date) => {
      const count = (state.blockedSlots[date] || []).length;
      const percent = Math.min((count / slots.length) * 100, 100);
      const label = count + '/' + slots.length + ' blocked';
      return '<button type="button" data-date="' + date + '" class="date-card" style="padding:10px 8px; border:1px solid var(--line); border-radius:10px; background:linear-gradient(180deg, rgba(39,74,52,.10), rgba(39,74,52,.02)); min-height:86px; text-align:left; cursor:pointer;" title="' + label + '"><div style="font-size:10px; font-weight:700; color:var(--muted);">' + formatDate(dateFromIso(date)).replace(', ', ' ') + '</div><div style="margin-top:10px; height:10px; border-radius:999px; background:#edf3ee; overflow:hidden;"><span style="display:block; height:100%; width:' + percent + '%; background:linear-gradient(90deg,#8da895,#b63737); border-radius:999px;"></span></div><div style="margin-top:8px; font-size:10px; color:var(--muted);">' + label + '</div></button>';
    }).join('');
    return '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">' + cells + '</div>';
  }

  function renderCalendar() {
    const dates = getVisibleDates();
    const isMonthView = state.viewMode === 'month';
    const cards = isMonthView ? renderMonthOverview() : dates.map((date) => {
      const blockedSet = new Set(state.blockedSlots[date] || []);
      const slotButtons = slots.map((time) => {
        const blocked = blockedSet.has(time);
        return '<button class="slot ' + (blocked ? 'blocked' : '') + '" type="button" data-date="' + date + '" data-time="' + time + '" aria-label="' + date + ' ' + time + '"><span>' + time + '</span><span class="state-flag" aria-hidden="true"></span></button>';
      }).join('');

      return '<article class="date-card"><div class="date-head"><div><div class="date-name">' + formatDate(dateFromIso(date)) + '</div><div class="date-meta">' + date + '</div></div></div><div class="slot-grid">' + slotButtons + '</div><div class="date-actions"><button class="secondary" type="button" data-date="' + date + '" data-action="block-all">Block all</button><button class="ghost" type="button" data-date="' + date + '" data-action="clear-all">Clear</button></div></article>';
    }).join('');

    calendarNode.innerHTML = cards;
    if (isMonthView) {
      calendarNode.querySelectorAll('[data-date]').forEach((button) => {
        button.addEventListener('click', () => {
          const date = button.dataset.date;
          const set = new Set(state.blockedSlots[date] || []);
          const next = { ...state.blockedSlots };
          if (set.size === slots.length) {
            delete next[date];
          } else {
            next[date] = [...slots];
          }
          state.blockedSlots = next;
          state.history.unshift({ action: set.size === slots.length ? 'cleared' : 'blocked', date, time: 'all slots', timestamp: new Date().toISOString() });
          state.history = state.history.slice(0, 20);
          renderHistory();
          renderCalendar();
        });
      });
      return;
    }

    calendarNode.querySelectorAll('.slot').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        state.isDragging = true;
        state.dragCache.clear();
        const { date, time } = button.dataset;
        state.dragCache.add(date + ':' + time);
        toggleSlot(date, time, 'drag');
      });

      button.addEventListener('pointerenter', () => {
        if (!state.isDragging) return;
        const { date, time } = button.dataset;
        const key = date + ':' + time;
        if (state.dragCache.has(key)) return;
        state.dragCache.add(key);
        toggleSlot(date, time, 'drag');
      });
    });

    document.addEventListener('pointerup', () => {
      state.isDragging = false;
      state.dragCache.clear();
    }, { once: false });

    calendarNode.querySelectorAll('[data-action="block-all"]').forEach((button) => {
      button.addEventListener('click', () => {
        const { date } = button.dataset;
        state.blockedSlots[date] = [...slots];
        state.history.unshift({ action: 'blocked', date, time: 'all slots', timestamp: new Date().toISOString() });
        state.history = state.history.slice(0, 20);
        renderHistory();
        renderCalendar();
      });
    });

    calendarNode.querySelectorAll('[data-action="clear-all"]').forEach((button) => {
      button.addEventListener('click', () => {
        const { date } = button.dataset;
        const next = { ...state.blockedSlots };
        delete next[date];
        state.blockedSlots = next;
        state.history.unshift({ action: 'cleared', date, time: 'all slots', timestamp: new Date().toISOString() });
        state.history = state.history.slice(0, 20);
        renderHistory();
        renderCalendar();
      });
    });

    const blockedCount = Object.values(state.blockedSlots).reduce((sum, times) => sum + times.length, 0);
    const visibleCount = dates.length * slots.length;
    const availableCount = Math.max(visibleCount - blockedCount, 0);
    summaryNode.textContent = 'Visible schedule: ' + visibleCount + ' slots · ' + blockedCount + ' blocked · ' + availableCount + ' available';
  }

  async function callApi(method, body) {
    const response = await fetch(location.pathname, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-calendar-key': keyInput.value.trim(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Request failed.');
    return result;
  }

  async function loadCalendar() {
    setStatus('Loading live calendar…');
    try {
      const result = await callApi('GET');
      state.blockedSlots = result.blockedSlots || {};
      state.history = Array.isArray(result.history) ? result.history : [];
      renderHistory();
      renderCalendar();
      const totalBlocked = Object.values(state.blockedSlots).reduce((sum, times) => sum + times.length, 0);
      const summaryText = 'Blocked slots: ' + totalBlocked + '\n\n' + (Object.entries(state.blockedSlots).map(([date, times]) => date + ': ' + times.join(', ')).join('\n') || 'No manual blocks yet.');
      summaryNode.textContent = summaryText;
      setStatus('Calendar loaded.','ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function saveCalendar() {
    setStatus('Saving changes…');
    try {
      const payload = { blocks: state.blockedSlots, history: state.history.slice(0, 25) };
      const result = await callApi('PUT', payload);
      state.blockedSlots = result.blockedSlots || state.blockedSlots;
      state.history = Array.isArray(result.history) ? result.history : state.history;
      renderHistory();
      renderCalendar();
      const totalBlocked = Object.values(state.blockedSlots).reduce((sum, times) => sum + times.length, 0);
      const summaryText = 'Saved calendar blocks: ' + totalBlocked + '\n\n' + (Object.entries(state.blockedSlots).map(([date, times]) => date + ': ' + times.join(', ')).join('\n') || 'No manual blocks yet.');
      summaryNode.textContent = summaryText;
      setStatus('Changes saved and live on the booking page.','ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function unlockCalendar() {
    const key = (loginKeyInput.value || keyInput.value || '').trim();
    if (!key) {
      setStatus('Enter a valid calendar key first.', 'error');
      return;
    }

    keyInput.value = key;
    sessionStorage.setItem('a10tion-calendar-key', key);
    loginOverlay.style.display = 'none';
    loadCalendar();
  }

  document.getElementById('loginBtn').addEventListener('click', () => {
    loginOverlay.style.display = 'flex';
    loginKeyInput.focus();
  });

  document.getElementById('unlockCalendar').addEventListener('click', unlockCalendar);
  document.getElementById('closeLogin').addEventListener('click', () => {
    loginOverlay.style.display = 'none';
  });

  document.getElementById('load').addEventListener('click', loadCalendar);
  document.getElementById('save').addEventListener('click', saveCalendar);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  document.getElementById('viewWeek').addEventListener('click', () => {
    state.viewMode = 'week';
    renderCalendar();
  });

  document.getElementById('view30').addEventListener('click', () => {
    state.viewMode = '30';
    renderCalendar();
  });

  document.getElementById('viewMonth').addEventListener('click', () => {
    state.viewMode = 'month';
    renderCalendar();
  });

  document.getElementById('blockNext30').addEventListener('click', () => {
    const next = { ...state.blockedSlots };
    getVisibleDates().forEach((date) => {
      next[date] = [...slots];
    });
    state.blockedSlots = next;
    state.history.unshift({ action: 'blocked', date: 'next 30 days', time: 'all slots', timestamp: new Date().toISOString() });
    state.history = state.history.slice(0, 20);
    renderHistory();
    renderCalendar();
  });

  document.getElementById('clearNext30').addEventListener('click', () => {
    const next = { ...state.blockedSlots };
    getVisibleDates().forEach((date) => delete next[date]);
    state.blockedSlots = next;
    state.history.unshift({ action: 'cleared', date: 'next 30 days', time: 'all slots', timestamp: new Date().toISOString() });
    state.history = state.history.slice(0, 20);
    renderHistory();
    renderCalendar();
  });

  const savedKey = sessionStorage.getItem('a10tion-calendar-key');
  if (savedKey) {
    keyInput.value = savedKey;
    loginOverlay.style.display = 'none';
    loadCalendar();
  } else {
    loginOverlay.style.display = 'flex';
  }

  renderCalendar();
  renderHistory();
</script>
</body>
</html>`;

export default async function handler(req, res) {
    if (req.method === 'GET' && String(req.headers.accept || '').includes('text/html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(adminPage);
        return;
    }

    if (applyCors(req, res)) return;
    if (!['GET', 'PUT'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const expectedKey = getExpectedKey();
    const suppliedKey = getSuppliedKey(req);
    if (!expectedKey || !suppliedKey || !safeEqual(suppliedKey, expectedKey)) {
        res.status(401).json({ message: 'Calendar key is missing or invalid.' });
        return;
    }

    try {
        const start = req.query?.from || new Date().toISOString().slice(0, 10);
        const end = req.query?.to || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

        if (req.method === 'GET') {
            await seedDefaultCalendarBlocks();
            const [blockedSlots, history] = await Promise.all([
                getBlockedSlotsInRange(start, end),
                getCalendarHistory(20),
            ]);
            res.status(200).json({
                blockedSlots,
                history,
                totalBlocked: Object.values(blockedSlots).reduce((sum, times) => sum + (Array.isArray(times) ? times.length : 0), 0),
            });
            return;
        }

        const { blocks, history = [] } = req.body || {};
        if (blocks && typeof blocks === 'object') {
            const dateKeys = new Set([...Object.keys(blocks), ...Object.keys(await getBlockedSlotsInRange(start, end))]);
            for (const date of dateKeys) {
                const desired = new Set(Array.isArray(blocks[date]) ? blocks[date] : []);
                const current = new Set((await getBlockedSlotsInRange(date, date))[date] || []);
                for (const time of [...current]) {
                    if (!desired.has(time)) await clearCalendarBlock(date, time);
                }
                for (const time of [...desired]) {
                    if (!current.has(time)) await setCalendarBlockRange(date, [time], 'admin');
                }
            }

            for (const entry of history) {
                await appendCalendarHistory(entry);
            }

            const [blockedSlots, nextHistory] = await Promise.all([
                getBlockedSlotsInRange(start, end),
                getCalendarHistory(20),
            ]);
            res.status(200).json({
                blockedSlots,
                history: nextHistory,
                totalBlocked: Object.values(blockedSlots).reduce((sum, times) => sum + times.length, 0),
            });
            return;
        }

        res.status(400).json({ message: 'Expected a blocks object with date => [times].' });
    } catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Could not update the calendar.' });
    }
}

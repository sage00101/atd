import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import {
    BOOKING_SLOT_TIMES,
    appendCalendarHistory,
    clearCalendarBlock,
  getBookedSlotsInRange,
    getBlockedSlotsInRange,
    getCalendarHistory,
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
    --bg:#f4f7f5;
    --panel:#fff;
    --panel-soft:#edf3ef;
    --line:#dce5df;
    --ink:#192820;
    --muted:#68776e;
    --sage:#24513a;
    --sage-soft:#e3efe7;
    --sage-ink:#1a3828;
    --danger:#a73737;
    --danger-soft:#f9e9e8;
    --blue:#26718a;
    --blue-soft:#e5f1f5;
    --shadow:0 18px 48px -34px rgba(18,34,25,.42);
  }

  .login-overlay {
    position: fixed; inset: 0; background: rgba(14,24,18,.62); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 20; backdrop-filter: blur(5px);
  }
  .login-card {
    width: min(420px, 100%); background: white; border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow); padding: 28px;
  }
  .login-card h2 { margin: 0 0 7px; font-size: 23px; }
  .login-card p { margin: 0 0 20px; color: var(--muted); line-height: 1.55; font-size: 14px; }
  .login-form { display: grid; gap: 12px; }
  .login-form input { width: 100%; padding: 12px 13px; border-radius: 7px; border: 1px solid var(--line); font-size: 14px; }
  .login-actions { display: flex; gap: 9px; margin-top: 3px; }
  .login-actions button { flex: 1; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); font-family: "Avenir Next", "Segoe UI", sans-serif; }
  body { padding: 26px 24px 52px; }
  .shell { max-width: 1240px; margin: 0 auto; }
  .topbar { padding: 0 0 22px; border-bottom: 1px solid var(--line); }
  .brand-line { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--sage); }
  .live-mark { display:inline-flex; align-items:center; gap:7px; color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; }
  .live-mark::before { content:""; width:7px; height:7px; border-radius:50%; background:#2e9b64; box-shadow:0 0 0 3px #dcefe4; }
  .heading { margin: 17px 0 0; font-size: 31px; font-weight: 650; line-height: 1.15; }
  .sub { margin: 7px 0 0; max-width: 680px; font-size: 14px; line-height: 1.55; color: var(--muted); }
  .panel { padding: 20px 0 0; }
  .toolbar { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; padding-bottom: 17px; border-bottom: 1px solid var(--line); }
  .toolbar input { flex: 1 1 230px; max-width: 310px; min-width: 190px; padding: 10px 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel); font-size: 13px; }
  .button-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content:space-between; align-items:center; padding: 15px 0 14px; }
  .view-controls, .batch-controls { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  button {
    appearance: none; border: 0; border-radius: 7px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  button:hover { border-color:#adc2b4; }
  button:focus-visible, summary:focus-visible, input:focus-visible { outline:3px solid rgba(46,133,83,.24); outline-offset:2px; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .primary { background: var(--sage); color: white; padding: 10px 14px; }
  .primary:hover { background:#183c29; }
  .secondary { background: var(--panel); color: var(--sage-ink); border:1px solid var(--line); padding: 9px 12px; }
  .ghost { background: transparent; color: var(--muted); border: 1px solid transparent; padding: 9px 11px; }
  .view-controls { padding:3px; border:1px solid var(--line); border-radius:8px; background:#eaf0ec; }
  .view-button { padding:7px 11px; background:transparent; color:var(--muted); }
  .view-button[aria-pressed="true"] { background:#fff; color:var(--ink); box-shadow:0 1px 3px rgba(20,38,28,.12); }
  .legend { display: flex; gap: 16px; flex-wrap: wrap; margin: 3px 0 12px; color: var(--muted); font-size: 11px; }
  .legend-item { display: inline-flex; align-items: center; gap: 7px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .grid { display: flex; flex-direction:column; gap: 7px; }
  .date-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  .day-card[open] { border-color:#bdcec3; box-shadow:0 5px 18px rgba(23,47,32,.05); }
  .day-summary { display:grid; grid-template-columns:minmax(190px,1fr) auto 15px; align-items:center; gap:20px; min-height:66px; padding:12px 16px; cursor:pointer; list-style:none; }
  .day-summary::-webkit-details-marker { display:none; }
  .day-summary::marker { content:""; }
  .day-heading { display:flex; align-items:baseline; gap:10px; min-width:0; }
  .date-name { font-weight:700; font-size:14px; }
  .date-meta { font-size:11px; color:var(--muted); }
  .day-counts { display:flex; align-items:center; gap:13px; color:var(--muted); font-size:11px; white-space:nowrap; }
  .count-open { color:var(--sage); }
  .count-booked { color:var(--blue); }
  .day-chevron { width:8px; height:8px; border-right:1.5px solid #78877e; border-bottom:1.5px solid #78877e; transform:rotate(45deg); transition:transform .16s ease; }
  .day-card[open] .day-chevron { transform:rotate(225deg); }
  .day-content { padding:0 16px 15px; }
  .day-rule { height:1px; margin:0 0 13px; background:var(--line); }
  .slot-grid { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px; }
  .slot {
    display:flex; align-items:center; justify-content:space-between; gap: 8px; min-width:0; width:100%; min-height:42px; border-radius:7px; border:1px solid var(--line); background:#fbfcfb; padding:8px 10px; font-size:12px; color:var(--ink);
  }
  .slot:hover { background:#f1f6f2; }
  .slot.blocked { background:var(--danger-soft); border-color:#e9c5c2; color:#792f2d; }
  .slot.booked { background:var(--blue-soft); border-color:#c2dce5; color:#18566b; }
  .slot[aria-disabled="true"] { cursor:not-allowed; }
  .slot-status { font-size:10px; color:var(--muted); }
  .slot.blocked .slot-status { color:#9a3c37; }
  .slot.booked .slot-status { color:#18566b; }
  .date-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:11px; }
  .date-actions button { padding:7px 10px; font-size:11px; }
  .status { display:flex; align-items:center; gap:9px; min-height:38px; margin:12px 0 0; padding:9px 11px; border:1px solid var(--line); border-radius:7px; background:#f8faf9; color:var(--muted); font-size:12px; }
  .status:empty { display:none; }
  .status::before { content:""; width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:#8ba193; }
  .status.loading { color:var(--sage-ink); background:#f1f6f2; }
  .status.loading::before { border:2px solid #c8d6cd; border-top-color:var(--sage); background:transparent; animation:status-spin .7s linear infinite; }
  .status.error { color:var(--danger); background:var(--danger-soft); border-color:#e9c5c2; }
  .status.error::before { background:var(--danger); }
  .status.ok { color:#1d6840; background:#edf6ef; border-color:#c9e1cf; }
  .status.ok::before { background:#2e8a52; }
  @keyframes status-spin { to { transform:rotate(360deg); } }
  .summary { margin: 9px 0 0; color:var(--muted); font-size:11px; line-height:1.5; white-space:pre-wrap; }
  .history { margin-top:20px; border-top:1px solid var(--line); padding:15px 2px 0; max-height:165px; overflow:auto; font-size:11px; color:var(--muted); }
  .month-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:8px; }
  .month-day { display:grid; gap:10px; min-height:86px; padding:11px 12px; text-align:left; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
  .month-day-label { font-size:11px; font-weight:700; color:var(--ink); }
  .month-bar { height:5px; overflow:hidden; border-radius:4px; background:#edf2ee; }
  .month-bar-fill { display:block; height:100%; border-radius:4px; background:linear-gradient(90deg,#69a681,#b45e58); }
  .month-day-meta { color:var(--muted); font-size:10px; }
  @media (max-width: 760px) { body { padding:20px 16px 36px; } .day-summary { grid-template-columns:minmax(160px,1fr) 15px; gap:10px; } .day-counts { grid-column:1; grid-row:2; flex-wrap:wrap; gap:10px; } .day-chevron { grid-column:2; grid-row:1 / span 2; } .slot-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width: 520px) { body { padding:16px 11px 28px; } .heading { font-size:27px; } .toolbar { display:grid; grid-template-columns:1fr 1fr; } .toolbar input { grid-column:1 / -1; max-width:none; width:100%; } .toolbar button { width:100%; } .button-row { align-items:stretch; gap:9px; } .view-controls, .batch-controls { width:100%; } .view-controls button { flex:1; padding-inline:6px; } .batch-controls button { flex:1 1 auto; } .day-summary { padding:11px 12px; } .day-content { padding:0 11px 12px; } .month-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand-line"><p class="eyebrow">A10tion To Detail / Operations</p><span class="live-mark">Live schedule</span></div>
    <h1 class="heading">Calendar manager</h1>
    <p class="sub">Manage appointment availability and customer bookings.</p>
  </header>
  <main class="panel">
    <div class="toolbar">
      <input id="adminKey" type="password" autocomplete="current-password" placeholder="Calendar API key" aria-label="Calendar API key">
      <button id="loginBtn" class="secondary" type="button">Staff login</button>
      <button id="load" class="secondary" type="button">Load live calendar</button>
      <button id="save" class="primary" type="button">Save changes</button>
    </div>
    <p id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="button-row">
      <div class="view-controls" role="group" aria-label="Calendar view">
        <button id="viewWeek" class="view-button" data-view="week" aria-pressed="false" type="button">Week</button>
        <button id="view30" class="view-button" data-view="30" aria-pressed="true" type="button">30 days</button>
        <button id="viewMonth" class="view-button" data-view="month" aria-pressed="false" type="button">Overview</button>
      </div>
      <div class="batch-controls">
      <button id="blockNext30" class="secondary" type="button">Block next 30 days</button>
      <button id="clearNext30" class="ghost" type="button">Clear next 30 days</button>
      <button id="exportCsv" class="ghost" type="button">Export CSV</button>
      </div>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="dot" style="background:#6b9f7b"></span>Available</span>
      <span class="legend-item"><span class="dot" style="background:#b34e48"></span>Blocked</span>
      <span class="legend-item"><span class="dot" style="background:#287b99"></span>Booked</span>
    </div>
    <div id="calendar" class="grid"></div>
    <div id="history" class="history"></div>
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
  const state = { blockedSlots: {}, bookedSlots: {}, history: [], viewMode: '30', isDragging: false, dragCache: new Set(), openDates: new Set(), initializedOpenDate: false };

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

  function isWeekday(value) {
    const day = dateFromIso(value).getDay();
    return day !== 0 && day !== 6;
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

  function buildWeekdayRange(days = 30) {
    return buildDateRange(days).filter(isWeekday);
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
    }).filter(isWeekday);
  }

  function getVisibleDates() {
    if (state.viewMode === 'week') return buildWeekRange();
    return buildWeekdayRange(30);
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

    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\\n');
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
    if ((state.bookedSlots[date] || []).includes(time)) {
      state.isDragging = false;
      setStatus('A customer has booked or reserved ' + date + ' ' + time + '. This slot cannot be freed.', 'error');
      return;
    }

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
    const monthDates = buildWeekdayRange(30);
    const cells = monthDates.map((date) => {
      const blocked = new Set(state.blockedSlots[date] || []);
      const booked = new Set(state.bookedSlots[date] || []);
      const occupiedCount = new Set([...blocked, ...booked]).size;
      const percent = Math.min((occupiedCount / slots.length) * 100, 100);
      const label = blocked.size + ' blocked · ' + booked.size + ' booked';
      return '<button type="button" data-date="' + date + '" class="month-day" title="' + label + '"><span class="month-day-label">' + formatDate(dateFromIso(date)).replace(', ', ' ') + '</span><span class="month-bar"><span class="month-bar-fill" style="width:' + percent + '%"></span></span><span class="month-day-meta">' + label + '</span></button>';
    }).join('');
    return '<div class="month-grid">' + cells + '</div>';
  }

  function renderCalendar() {
    const dates = getVisibleDates();
    if (!state.initializedOpenDate && dates.length) {
      state.openDates.add(dates[0]);
      state.initializedOpenDate = true;
    }
    document.querySelectorAll('.view-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.viewMode));
    });
    const isMonthView = state.viewMode === 'month';
    const cards = isMonthView ? renderMonthOverview() : dates.map((date) => {
      const blockedSet = new Set(state.blockedSlots[date] || []);
      const bookedSet = new Set(state.bookedSlots[date] || []);
      const slotButtons = slots.map((time) => {
        const blocked = blockedSet.has(time);
        const booked = bookedSet.has(time);
        const slotClass = booked ? 'booked' : blocked ? 'blocked' : '';
        const slotStatus = booked ? 'Booked' : blocked ? 'Blocked' : 'Open';
        const label = booked ? 'Booked by a customer; cannot be freed' : blocked ? 'Manually blocked' : 'Available';
        return '<button class="slot ' + slotClass + '" type="button" data-date="' + date + '" data-time="' + time + '" data-booked="' + booked + '" aria-disabled="' + booked + '" aria-label="' + date + ' ' + time + ', ' + label + '" title="' + label + '"><span>' + time + '</span><span class="slot-status">' + slotStatus + '</span></button>';
      }).join('');

      const blockedCountForDate = blockedSet.size;
      const bookedCountForDate = bookedSet.size;
      const availableCountForDate = Math.max(slots.length - new Set([...blockedSet, ...bookedSet]).size, 0);
      const openAttribute = state.openDates.has(date) ? ' open' : '';
      return '<details class="date-card day-card" data-date-card="' + date + '"' + openAttribute + '><summary class="day-summary"><span class="day-heading"><span class="date-name">' + formatDate(dateFromIso(date)) + '</span><span class="date-meta">' + date + '</span></span><span class="day-counts"><span class="count-open">' + availableCountForDate + ' open</span><span>' + blockedCountForDate + ' blocked</span><span class="count-booked">' + bookedCountForDate + ' booked</span></span><span class="day-chevron" aria-hidden="true"></span></summary><div class="day-content"><div class="day-rule"></div><div class="slot-grid">' + slotButtons + '</div><div class="date-actions"><button class="secondary" type="button" data-date="' + date + '" data-action="block-all">Block open slots</button><button class="ghost" type="button" data-date="' + date + '" data-action="clear-all">Clear manual blocks</button></div></div></details>';
    }).join('');

    calendarNode.innerHTML = cards;
    calendarNode.querySelectorAll('details.day-card').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (details.open) state.openDates.add(details.dataset.dateCard);
        else state.openDates.delete(details.dataset.dateCard);
      });
    });
    if (isMonthView) {
      calendarNode.querySelectorAll('[data-date]').forEach((button) => {
        button.addEventListener('click', () => {
          const date = button.dataset.date;
          const set = new Set(state.blockedSlots[date] || []);
          const booked = new Set(state.bookedSlots[date] || []);
          const unbookedSlots = slots.filter((time) => !booked.has(time));
          const next = { ...state.blockedSlots };
          const allUnbookedSlotsBlocked = unbookedSlots.every((time) => set.has(time));
          if (allUnbookedSlotsBlocked) {
            const retained = [...set].filter((time) => booked.has(time));
            if (retained.length) next[date] = retained; else delete next[date];
          } else {
            next[date] = [...new Set([...set, ...unbookedSlots])].sort();
          }
          state.blockedSlots = next;
          state.history.unshift({ action: allUnbookedSlotsBlocked ? 'cleared' : 'blocked', date, time: 'all slots', timestamp: new Date().toISOString() });
          state.history = state.history.slice(0, 20);
          renderHistory();
          renderCalendar();
          if (booked.size) setStatus('Customer-booked slots remain protected and cannot be freed.', 'error');
        });
      });
      return;
    }

    calendarNode.querySelectorAll('.slot').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (button.dataset.booked === 'true') {
          toggleSlot(button.dataset.date, button.dataset.time);
          return;
        }
        state.isDragging = true;
        state.dragCache.clear();
        const { date, time } = button.dataset;
        state.dragCache.add(date + ':' + time);
        toggleSlot(date, time, 'drag');
      });

      button.addEventListener('pointerenter', () => {
        if (!state.isDragging) return;
        const { date, time } = button.dataset;
        if (button.dataset.booked === 'true') {
          toggleSlot(date, time);
          return;
        }
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
        const booked = new Set(state.bookedSlots[date] || []);
        const current = new Set(state.blockedSlots[date] || []);
        slots.filter((time) => !booked.has(time)).forEach((time) => current.add(time));
        state.blockedSlots[date] = [...current].sort();
        state.history.unshift({ action: 'blocked', date, time: 'all slots', timestamp: new Date().toISOString() });
        state.history = state.history.slice(0, 20);
        renderHistory();
        renderCalendar();
      });
    });

    calendarNode.querySelectorAll('[data-action="clear-all"]').forEach((button) => {
      button.addEventListener('click', () => {
        const { date } = button.dataset;
        const booked = new Set(state.bookedSlots[date] || []);
        const protectedBlocks = (state.blockedSlots[date] || []).filter((time) => booked.has(time));
        const next = { ...state.blockedSlots };
        if (protectedBlocks.length) next[date] = protectedBlocks; else delete next[date];
        state.blockedSlots = next;
        state.history.unshift({ action: 'cleared', date, time: 'all slots', timestamp: new Date().toISOString() });
        state.history = state.history.slice(0, 20);
        renderHistory();
        renderCalendar();
        if (booked.size) setStatus('Customer-booked slots remain protected and cannot be freed.', 'error');
      });
    });

    const blockedCount = dates.reduce((sum, date) => sum + (state.blockedSlots[date] || []).length, 0);
    const bookedCount = dates.reduce((sum, date) => sum + (state.bookedSlots[date] || []).length, 0);
    const visibleCount = dates.length * slots.length;
    const occupiedCount = dates.reduce((sum, date) => sum + new Set([...(state.blockedSlots[date] || []), ...(state.bookedSlots[date] || [])]).size, 0);
    const availableCount = Math.max(visibleCount - occupiedCount, 0);
    summaryNode.textContent = 'Visible schedule: ' + visibleCount + ' slots · ' + blockedCount + ' blocked · ' + bookedCount + ' booked · ' + availableCount + ' available';
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
    const button = document.getElementById('load');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Loading…';
    setStatus('Connecting to the live calendar…', 'loading');
    try {
      const result = await callApi('GET');
      state.blockedSlots = result.blockedSlots || {};
      state.bookedSlots = result.bookedSlots || {};
      state.history = Array.isArray(result.history) ? result.history : [];
      renderHistory();
      renderCalendar();
      const blockedCount = Object.values(state.blockedSlots).reduce((sum, times) => sum + times.length, 0);
      const bookedCount = Object.values(state.bookedSlots).reduce((sum, times) => sum + times.length, 0);
      setStatus('Calendar loaded: ' + blockedCount + ' manually blocked, ' + bookedCount + ' booked.', 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Load live calendar';
    }
  }

  async function saveCalendar() {
    const button = document.getElementById('save');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Saving…';
    setStatus('Saving calendar changes…', 'loading');
    try {
      const payload = { blocks: state.blockedSlots, history: state.history.slice(0, 25) };
      const result = await callApi('PUT', payload);
      state.blockedSlots = result.blockedSlots || state.blockedSlots;
      state.bookedSlots = result.bookedSlots || state.bookedSlots;
      state.history = Array.isArray(result.history) ? result.history : state.history;
      renderHistory();
      renderCalendar();
      const blockedCount = Object.values(state.blockedSlots).reduce((sum, times) => sum + times.length, 0);
      setStatus('Saved successfully: ' + blockedCount + ' manual blocks. Booked slots remain protected.', 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Save changes';
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
    let protectedCount = 0;
    getVisibleDates().forEach((date) => {
      const booked = new Set(state.bookedSlots[date] || []);
      const protectedBlocks = (next[date] || []).filter((time) => booked.has(time));
      protectedCount += protectedBlocks.length;
      if (protectedBlocks.length) next[date] = protectedBlocks; else delete next[date];
    });
    state.blockedSlots = next;
    state.history.unshift({ action: 'cleared', date: 'next 30 days', time: 'all slots', timestamp: new Date().toISOString() });
    state.history = state.history.slice(0, 20);
    renderHistory();
    renderCalendar();
    if (protectedCount) setStatus('Some slots were kept blocked because customers have booked them.', 'error');
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
          const [blockedSlots, bookedSlots, history] = await Promise.all([
                getBlockedSlotsInRange(start, end),
            getBookedSlotsInRange(start, end),
                getCalendarHistory(20),
            ]);
            res.status(200).json({
                blockedSlots,
            bookedSlots,
                history,
                totalBlocked: Object.values(blockedSlots).reduce((sum, times) => sum + (Array.isArray(times) ? times.length : 0), 0),
            });
            return;
        }

        const { blocks, history = [] } = req.body || {};
        if (blocks && typeof blocks === 'object') {
            const dateKeys = new Set([...Object.keys(blocks), ...Object.keys(await getBlockedSlotsInRange(start, end))]);
          const changes = [];
            for (const date of dateKeys) {
                const desired = new Set(Array.isArray(blocks[date]) ? blocks[date] : []);
            const [currentSlots, bookedForDate] = await Promise.all([
              getBlockedSlotsInRange(date, date),
              getBookedSlotsInRange(date, date),
            ]);
            const current = new Set(currentSlots[date] || []);
            const booked = new Set(bookedForDate[date] || []);
            const attemptedToFree = [...current].find((time) => !desired.has(time) && booked.has(time));
            if (attemptedToFree) {
              const conflict = new Error('A customer has booked or reserved ' + date + ' ' + attemptedToFree + '. This slot cannot be freed. Refresh the calendar and try again.');
              conflict.statusCode = 409;
              throw conflict;
            }
            changes.push({ date, current, desired });
          }

          for (const { date, current, desired } of changes) {
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

            const [blockedSlots, bookedSlots, nextHistory] = await Promise.all([
                getBlockedSlotsInRange(start, end),
              getBookedSlotsInRange(start, end),
                getCalendarHistory(20),
            ]);
            res.status(200).json({
                blockedSlots,
              bookedSlots,
                history: nextHistory,
                totalBlocked: Object.values(blockedSlots).reduce((sum, times) => sum + times.length, 0),
            });
            return;
        }

        res.status(400).json({ message: 'Expected a blocks object with date => [times].' });
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
      res.status(status).json({ message: error instanceof Error ? error.message : 'Could not update the calendar.' });
    }
}

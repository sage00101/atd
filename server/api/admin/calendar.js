import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { cancelBookedSlotRecords, findBookingRequestBySlot } from '../_lib/booking-approval.js';
import { sendBookingCancelledEmail } from '../_lib/email.js';
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

function getExpectedKeys() {
    return [process.env.CALENDAR_API_KEY, process.env.ADMIN_API_KEY].filter(Boolean);
}

const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calendar Manager | A10tion To Detail</title>
<style>
  :root {
    color-scheme:light;
    --bg:#f6f8f6;
    --panel:#fff;
    --panel-soft:#f1f6f2;
    --line:rgba(38,77,49,.12);
    --line-2:rgba(38,77,49,.2);
    --ink:#1d2c22;
    --muted:#718076;
    --sage:#4d8b5e;
    --sage-ink:#405448;
    --danger:#b44740;
    --danger-soft:rgba(180,71,64,.1);
    --blue:#347b94;
    --blue-soft:rgba(52,123,148,.1);
    --accent-soft:rgba(77,139,94,.1);
    --shadow:0 24px 60px -34px rgba(32,54,38,.22);
  }

  .login-overlay {
    position: fixed; inset: 0; background: rgba(24,39,28,.32); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 20; backdrop-filter: blur(6px);
  }
  .login-card {
    width: min(420px, 100%); background: linear-gradient(180deg,#fff,#f8faf8); border: 1px solid var(--line-2); border-radius: 20px; box-shadow: var(--shadow); padding: 28px;
  }
  .login-card h2 { margin: 0 0 7px; font-size: 22px; letter-spacing:-.02em; color:var(--ink); }
  .login-card p { margin: 0 0 20px; color: var(--muted); line-height: 1.55; font-size: 14px; }
  .login-form { display: grid; gap: 12px; }
  .login-form input, .toolbar input { width: 100%; padding: 12px 14px; border-radius: 11px; border: 1px solid var(--line-2); background: #fff; color: var(--ink); font: inherit; font-size: 14px; transition: border-color .15s, box-shadow .15s; }
  .login-form input:focus, .toolbar input:focus { outline:none; border-color: var(--sage); box-shadow:0 0 0 3px var(--accent-soft); }
  .login-actions { display: flex; gap: 9px; margin-top: 3px; }
  .login-actions button { flex: 1; }
  * { box-sizing: border-box; scrollbar-color:#d5e0d7 transparent; }
  html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased; }
  body { padding: 26px 24px 52px; }
  .shell { max-width: 1240px; margin: 0 auto; }
  .topbar { padding: 0 0 22px; border-bottom: 1px solid var(--line); }
  .brand-line { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--sage); }
  .live-mark { white-space:nowrap; display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border:1px solid rgba(95,224,122,.3); border-radius:999px; background:var(--accent-soft); color:var(--sage); font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
  .live-mark::before { content:""; width:7px; height:7px; border-radius:50%; background:var(--sage); animation:live 2.4s infinite; }
  @keyframes live { 0%{box-shadow:0 0 0 0 rgba(95,224,122,.55)} 70%{box-shadow:0 0 0 8px rgba(95,224,122,0)} 100%{box-shadow:0 0 0 0 rgba(95,224,122,0)} }
  .heading { margin: 17px 0 0; font-size: 31px; font-weight: 750; letter-spacing:-.03em; line-height: 1.15; color:var(--ink); }
  .sub { margin: 7px 0 0; max-width: 680px; font-size: 14px; line-height: 1.55; color: var(--muted); }
  .panel { padding: 20px 0 0; }
  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .toolbar input { flex: 1 1 230px; max-width: 310px; min-width: 190px; width:auto; padding: 10px 12px; font-size: 13px; }
  .button-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content:space-between; align-items:center; padding: 16px 0 14px; }
  .view-controls, .batch-controls { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  button {
    appearance: none; border: 0; border-radius: 10px; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 700; color:inherit; transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease, filter .15s ease;
  }
  button:focus-visible, summary:focus-visible, input:focus-visible { outline:2px solid var(--sage); outline-offset:2px; }
  [hidden] { display:none !important; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .primary { background: linear-gradient(135deg,#39764d,#4d8b5e); color: #fff; padding: 10px 18px; box-shadow:0 8px 20px -14px rgba(57,118,77,.42); }
  .primary:hover { transform:translateY(-1px); filter:brightness(1.07); }
  .secondary { background: #fff; color: var(--ink); border:1px solid var(--line-2); padding: 9px 14px; }
  .secondary:hover { background:#f5f8f5; border-color:rgba(77,139,94,.3); }
  .ghost { background: transparent; color: var(--muted); border: 1px solid transparent; padding: 9px 12px; }
  .ghost:hover { color:var(--ink); background:#f1f6f2; }
  .view-controls { padding:4px; border:1px solid var(--line); border-radius:12px; background:#f2f6f2; }
  .view-button { padding:8px 14px; background:transparent; color:var(--muted); border-radius:8px; }
  .view-button:hover { color:var(--ink); }
  .view-button[aria-pressed="true"] { background:linear-gradient(180deg,#fff,#f5f8f5); color:var(--ink); box-shadow:0 4px 12px -8px rgba(32,54,38,.18), inset 0 -2px 0 var(--sage); }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; margin: 3px 0 14px; color: var(--muted); font-size: 12px; font-weight:600; }
  .legend-item { display: inline-flex; align-items: center; gap: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; }
  .dot.open { background:var(--sage); box-shadow:0 0 8px rgba(95,224,122,.6); }
  .dot.blocked { background:var(--danger); }
  .dot.booked { background:var(--blue); }
  .grid { display: flex; flex-direction:column; gap: 9px; }
  .date-card { background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; transition:border-color .2s, box-shadow .2s; }
  .date-card:hover { border-color:var(--line-2); }
  .day-card[open] { border-color:rgba(77,139,94,.3); box-shadow:0 12px 28px -22px rgba(32,54,38,.24); }
  .day-summary { display:grid; grid-template-columns:minmax(190px,1fr) auto 15px; align-items:center; gap:20px; min-height:68px; padding:12px 18px; cursor:pointer; list-style:none; }
  .day-summary::-webkit-details-marker { display:none; }
  .day-summary::marker { content:""; }
  .day-heading { display:flex; align-items:baseline; gap:10px; min-width:0; }
  .date-name { font-weight:700; font-size:15px; color:var(--ink); letter-spacing:-.01em; }
  .date-meta { font-size:11.5px; color:var(--muted); }
  .day-counts { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:11px; font-weight:700; white-space:nowrap; }
  .day-counts span { padding:4px 10px; border-radius:999px; background:#f3f6f3; }
  .count-open { color:var(--sage); background:var(--accent-soft)!important; }
  .count-booked { color:var(--blue); background:var(--blue-soft)!important; }
  .day-chevron { width:8px; height:8px; border-right:2px solid var(--muted); border-bottom:2px solid var(--muted); transform:rotate(45deg); transition:transform .16s ease; }
  .day-card[open] .day-chevron { transform:rotate(225deg); }
  .day-content { padding:0 18px 18px; }
  .day-rule { height:1px; margin:0 0 15px; background:var(--line); }
  .slot-grid { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; }
  .slot {
    display:flex; align-items:center; justify-content:space-between; gap: 8px; min-width:0; width:100%; min-height:48px; border-radius:12px; border:1px solid rgba(95,224,122,.22); background:var(--accent-soft); padding:9px 12px; font-size:13px; font-weight:700; color:var(--ink);
  }
  .slot:hover { background:rgba(95,224,122,.2); border-color:rgba(95,224,122,.5); transform:translateY(-1px); }
  .slot.blocked { background:var(--danger-soft); border-color:rgba(180,71,64,.25); color:#8f3934; }
  .slot.blocked:hover { background:rgba(255,120,108,.22); border-color:rgba(255,143,134,.55); }
  .slot.booked { background:repeating-linear-gradient(135deg,rgba(52,123,148,.12) 0 8px,rgba(52,123,148,.06) 8px 16px); border-color:rgba(52,123,148,.28); color:#285f75; }
  .slot.booked:hover { transform:none; background:repeating-linear-gradient(135deg,rgba(52,123,148,.12) 0 8px,rgba(52,123,148,.06) 8px 16px); }
  .slot[aria-disabled="true"] { cursor:not-allowed; }
  .slot-status { font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--sage); }
  .slot.blocked .slot-status { color:var(--danger); }
  .slot.booked .slot-status { color:var(--blue); }
  .date-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
  .date-actions button { padding:8px 12px; font-size:11.5px; }
  .status { display:flex; align-items:center; gap:10px; min-height:40px; margin:14px 0 0; padding:10px 14px; border:1px solid var(--line); border-radius:11px; background:#fff; color:var(--muted); font-size:12.5px; }
  .status:empty { display:none; }
  .status::before { content:""; width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:#6b7f72; }
  .status.loading { color:var(--sage-ink); background:rgba(255,255,255,.04); }
  .status.loading::before { border:2px solid rgba(150,205,168,.3); border-top-color:var(--sage); background:transparent; animation:status-spin .7s linear infinite; }
  .status.error { color:var(--danger); background:var(--danger-soft); border-color:rgba(255,143,134,.3); }
  .status.error::before { background:var(--danger); }
  .status.ok { color:#34764a; background:var(--accent-soft); border-color:rgba(77,139,94,.24); }
  .status.ok::before { background:var(--sage); box-shadow:0 0 8px rgba(95,224,122,.7); }
  @keyframes status-spin { to { transform:rotate(360deg); } }
  .summary { margin: 9px 0 0; color:var(--muted); font-size:11px; line-height:1.5; white-space:pre-wrap; }
  .history { margin-top:22px; border-top:1px solid var(--line); padding:16px 2px 0; max-height:190px; overflow:auto; font-size:12px; color:var(--muted); }
  .history strong { color:var(--ink-2, #c6d9cb); }
  .month-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
  .month-day { display:grid; gap:10px; min-height:90px; padding:13px 14px; text-align:left; background:#fff; border:1px solid var(--line); border-radius:14px; color:var(--ink); }
  .month-day:hover { border-color:rgba(95,224,122,.4); transform:translateY(-2px); }
  .month-day-label { font-size:12px; font-weight:700; color:var(--ink); }
  .month-bar { height:6px; overflow:hidden; border-radius:4px; background:#e9efea; }
  .month-bar-fill { display:block; height:100%; border-radius:4px; background:linear-gradient(90deg,#4d8b5e,#b44740); }
  .month-day-meta { color:var(--muted); font-size:10.5px; }
  body.embedded { padding:20px 20px 36px; }
  body.embedded .topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 0 16px; }
  body.embedded .eyebrow, body.embedded .sub { display:none; }
  body.embedded .heading { order:1; margin:0; font-size:22px; }
  body.embedded .brand-line { order:2; }
  body.embedded .panel { padding-top:16px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
  @media (max-width: 760px) { body { padding:20px 16px 36px; } .day-summary { grid-template-columns:minmax(160px,1fr) 15px; gap:10px; } .day-counts { grid-column:1; grid-row:2; flex-wrap:wrap; gap:8px; } .day-chevron { grid-column:2; grid-row:1 / span 2; } .slot-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width: 520px) { body { padding:16px 11px 28px; } .live-mark { padding:5px 9px; font-size:10px; letter-spacing:.04em; } .heading { font-size:27px; } body.embedded .heading { font-size:19px; } .toolbar { display:grid; grid-template-columns:1fr 1fr; } .toolbar input { grid-column:1 / -1; max-width:none; width:100%; } .toolbar button { width:100%; } .button-row { align-items:stretch; gap:9px; } .view-controls, .batch-controls { width:100%; } .view-controls button { flex:1; padding-inline:6px; } .batch-controls button { flex:1 1 auto; } .day-summary { padding:11px 13px; } .day-content { padding:0 12px 14px; } .month-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand-line"><p class="eyebrow">A10tion To Detail / Operations</p><span class="live-mark">Live schedule</span></div>
    <h1 class="heading">Availability calendar</h1>
    <p class="sub">Manage appointment availability and customer bookings. Customers need at least one hour's notice; earlier slots are not shown as bookings here.</p>
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
      <span class="legend-item"><span class="dot open"></span>Available</span>
      <span class="legend-item"><span class="dot blocked"></span>Blocked</span>
      <span class="legend-item"><span class="dot booked"></span>Booked</span>
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
  const state = { blockedSlots: {}, bookedSlots: {}, history: [], viewMode: '30', isDragging: false, dragCache: new Set(), openDates: new Set(), initializedOpenDate: false, loaded: false };
  if (new URLSearchParams(location.search).get('embedded') === '1') {
    document.body.classList.add('embedded');
    keyInput.hidden = true;
    document.getElementById('loginBtn').hidden = true;
  }

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
      if (reason !== 'drag') cancelBooking(date, time);
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
        const label = booked ? 'Booked by a customer; click to cancel' : blocked ? 'Manually blocked' : 'Available';
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

  async function cancelBooking(date, time) {
    if (!confirm('Cancel the booking on ' + date + ' at ' + time + '?\\n\\nThe customer will be emailed first. The slot is only cancelled if that email is sent.')) return;
    const reason = prompt('Optional message to include in the customer email (e.g. why it is being cancelled):', '');
    if (reason === null) return;
    setStatus('Emailing the customer and cancelling ' + date + ' ' + time + '...');
    try {
      const result = await callApi('POST', { date, time, reason });
      setStatus(result.message, 'ok');
      await loadCalendar();
    } catch (error) {
      setStatus(error.message, 'error');
    }
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
      state.loaded = true;
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

  async function refreshBookedSlots() {
    if (!state.loaded || document.visibilityState !== 'visible' || state.isDragging) return;
    try {
      const result = await callApi('GET');
      state.bookedSlots = result.bookedSlots || {};
      renderCalendar();
    } catch (error) {
      setStatus('Could not refresh customer bookings: ' + error.message, 'error');
    }
  }

  window.setInterval(refreshBookedSlots, 30000);
  window.addEventListener('focus', refreshBookedSlots);

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
        if (req.query?.embedded !== '1') {
            res.setHeader('Cache-Control', 'no-store');
            res.status(302).setHeader('Location', '/api/admin/promo-codes?tab=calendar').end();
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(adminPage);
        return;
    }

    if (applyCors(req, res)) return;
    if (!['GET', 'PUT', 'POST'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const suppliedKey = getSuppliedKey(req);
    const expectedKeys = getExpectedKeys();
    if (!suppliedKey || !expectedKeys.some((expectedKey) => safeEqual(suppliedKey, expectedKey))) {
        res.status(401).json({ message: 'Calendar key is missing or invalid.' });
        return;
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            const date = String(body.date || '');
            const time = String(body.time || '');
            const reason = String(body.reason || '').trim().slice(0, 500);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !BOOKING_SLOT_TIMES.includes(time)) {
                res.status(400).json({ message: 'A valid date and time are required.' });
                return;
            }
            const { owner, request } = await findBookingRequestBySlot(date, time);
            if (!owner) {
                res.status(404).json({ message: 'This slot is not booked. Refresh the calendar.' });
                return;
            }
            const email = request?.booking?.customer?.email;
            if (!request || !email) {
                res.status(409).json({ message: 'No customer email was found for this slot, so it was NOT cancelled. The customer must be contacted manually.' });
                return;
            }
            let sent;
            try {
                sent = await sendBookingCancelledEmail(request, reason, crypto.randomBytes(4).toString('hex'));
            } catch (error) {
                sent = { skipped: true, reason: error instanceof Error ? error.message : 'Email failed.' };
            }
            if (!sent || sent.skipped) {
                res.status(502).json({ message: 'The cancellation email could not be sent' + (sent?.reason ? ' (' + sent.reason + ')' : '') + ', so the slot was NOT cancelled.' });
                return;
            }
            const cancelled = await cancelBookedSlotRecords(request);
            const refundStatus = cancelled?.monthlyRefund?.status;
            const refundNote = refundStatus === 'OK' ? ' The monthly wash credit was refunded.'
                : refundStatus === 'FAILED' ? ' WARNING: the monthly wash credit could not be refunded automatically.' : '';
            res.status(200).json({ message: 'Booking cancelled and ' + email + ' was emailed.' + refundNote, emailSent: true });
        } catch (error) {
            res.status(409).json({ message: error instanceof Error ? error.message : 'Could not cancel the booking.' });
        }
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
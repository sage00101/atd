import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { getSharedPromoBatchForAdmin, saveSharedPromoBatch } from '../_lib/store.js';

const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Business Manager | A10tion To Detail</title>
<style>
:root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#17241c;background:#f3f6f3}*{box-sizing:border-box}body{margin:0;padding:24px 16px}.shell{max-width:1240px;margin:0 auto;background:#fff;border:1px solid #dce6de;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px -50px rgba(18,34,25,.5)}.head{padding:24px 28px;background:linear-gradient(125deg,#14251c,#294c37);color:#fff}.head p{margin:0;color:#c5d9c9;font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700}.head h1{margin:8px 0 0;font-size:27px;letter-spacing:-.03em}.head .sub{margin:7px 0 0;color:#d4e1d7;font-size:13px;line-height:1.5}.content{padding:20px 24px}.auth-row{display:flex;gap:9px;align-items:center;margin-bottom:14px}.auth-row input,.manager-input,.manager-select,.manager-search{width:100%;min-width:0;padding:11px 12px;border:1px solid #cbd9cf;border-radius:8px;background:#fff;color:#17241c;font:inherit;font-size:13px}.auth-row input{flex:1}.buttons{display:flex;gap:8px;margin:10px 0}.buttons button,.auth-row button{border:1px solid transparent;border-radius:8px;padding:11px 16px;background:#1e4931;color:white;font-weight:700;cursor:pointer;transition:background .15s,transform .15s}.buttons button:hover,.auth-row button:hover{background:#183c29;transform:translateY(-1px)}.buttons button.secondary{background:#edf3ee;color:#1e3128;border-color:#dbe7dd}.buttons button.danger{background:#fff1ef;color:#973d35;border-color:#efd3cf}.buttons button:disabled,.auth-row button:disabled{opacity:.55;cursor:wait;transform:none}.tabs,.promo-tabs{display:flex;gap:6px;border-bottom:1px solid #dce6de;margin:0 -24px 18px;padding:0 24px}.tab,.promo-tab{padding:11px 16px;border:0;border-bottom:3px solid transparent;background:transparent;color:#52635a;font-size:13px;font-weight:700;cursor:pointer}.tab[aria-selected="true"],.promo-tab[aria-selected="true"]{border-bottom-color:#2b6542;color:#1e3128}.tab-panel[hidden],.promo-panel[hidden]{display:none}.promo-tabs{margin:0 0 18px;padding:0;gap:8px}.promo-tab{padding:10px 14px;background:#f2f6f2;border:1px solid #e1e9e2;border-radius:8px}.promo-tab[aria-selected="true"]{border-color:#b9d1bf;background:#eaf3ec;color:#1e4931}.note{padding:12px 14px;border-radius:9px;background:#edf4ee;color:#405b48;font-size:13px;line-height:1.5}.manager-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px;padding:16px;border:1px solid #e1e9e2;border-radius:12px;background:#fbfcfb}.field-label{display:block;margin:0;font-size:12px;font-weight:700;color:#35483b}.field-label .manager-input,.field-label .manager-select{display:block;margin-top:6px}.field-full{grid-column:1/-1}.manager-form-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.monthly-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin:18px 0 12px}.monthly-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px}.entitlement-card{min-width:0;padding:16px;border:1px solid #dce6de;border-radius:12px;background:#fff;box-shadow:0 8px 25px -24px rgba(18,34,25,.5)}.entitlement-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.entitlement-name{margin:0;font-size:16px;line-height:1.25;color:#1e3128}.entitlement-meta{margin:5px 0 0;color:#68776e;font-size:12px;line-height:1.45;overflow-wrap:anywhere}.status-pill{display:inline-flex;flex:0 0 auto;align-items:center;border-radius:999px;padding:5px 9px;background:#eaf4ec;color:#24603c;font-size:10px;font-weight:800}.status-pill.fully-used,.status-pill.expired,.status-pill.archived{background:#fbeceb;color:#943e38}.status-pill.reserved,.status-pill.scheduled{background:#fff5df;color:#806016}.entitlement-code{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding:10px 11px;border:1px dashed #cbd9cf;border-radius:8px;background:#f7faf7}.entitlement-code code{min-width:0;overflow-wrap:anywhere;color:#1e4931;font-size:13px;font-weight:800;letter-spacing:.04em}.entitlement-code button{flex:0 0 auto;padding:6px 9px;border:1px solid #d5e0d7;border-radius:7px;background:#fff;color:#31553c;font-size:11px;font-weight:700;cursor:pointer}.usage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:11px}.usage-cell{padding:9px;border-radius:8px;background:#f3f7f3;text-align:center}.usage-cell strong{display:block;font-size:16px;color:#1e3128}.usage-cell span{display:block;margin-top:3px;color:#68776e;font-size:10px}.entitlement-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.entitlement-actions button{flex:1 1 auto;padding:8px 9px;border:1px solid #d8e2da;border-radius:7px;background:#fff;color:#35483b;font-size:11px;font-weight:700;cursor:pointer}.entitlement-history{margin-top:11px;border-top:1px solid #edf1ed;padding-top:10px;color:#52635a;font-size:11px}.entitlement-history summary{cursor:pointer;font-weight:700}.history-list{display:grid;gap:6px;margin:9px 0 0;padding:0;list-style:none}.history-list li{padding:8px;border-radius:7px;background:#f6f8f6;line-height:1.45;overflow-wrap:anywhere}.distribution-panel{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 12px;padding:14px 16px;border:1px solid #dce6de;border-radius:12px;background:#f8faf8}.distribution-panel h3{margin:0;color:#1e3128;font-size:14px}.distribution-panel p{margin:4px 0 0;color:#68776e;font-size:12px;line-height:1.5}.distribution-panel button,.dialog-actions button{border:1px solid transparent;border-radius:8px;padding:10px 14px;background:#1e4931;color:white;font-size:12px;font-weight:700;cursor:pointer}.distribution-panel button:disabled,.dialog-actions button:disabled{opacity:.55;cursor:wait}.distribution-history{display:grid;gap:7px;margin:10px 0 18px}.distribution-history article{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e1e9e2;border-radius:9px;background:#fff;color:#52635a;font-size:11px;line-height:1.5}.distribution-history strong{color:#1e3128}.distribution-history button{border:1px solid #d8e2da;border-radius:7px;background:#fff;color:#35483b;font-size:11px;font-weight:700;padding:6px 9px;cursor:pointer}.manager-dialog{width:min(560px,calc(100vw - 24px));max-height:85vh;padding:0;border:1px solid #dce6de;border-radius:14px;color:#17241c;box-shadow:0 24px 70px -35px rgba(18,34,25,.6)}.manager-dialog::backdrop{background:rgba(15,27,19,.55)}.manager-dialog-inner{padding:20px}.manager-dialog h2{margin:0;font-size:18px}.manager-dialog p{color:#52635a;font-size:13px;line-height:1.5}.manager-dialog ul{max-height:240px;overflow:auto;padding-left:20px;color:#405b48;font-size:12px;line-height:1.7}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.dialog-actions .secondary{background:#edf3ee;color:#1e3128;border-color:#dbe7dd}.empty-state{padding:28px 16px;border:1px dashed #cfdbd1;border-radius:10px;text-align:center;color:#68776e;font-size:13px}label{display:block;margin-top:18px;font-size:13px;font-weight:700}textarea{display:block;width:100%;min-height:300px;margin-top:8px;padding:12px;border:1px solid #cbd9cf;border-radius:8px;font:13px/1.5 Consolas,monospace;white-space:pre;overflow:auto}#status{min-height:22px;margin:12px 0;font-size:13px}#status.error{color:#a22}#status.ok{color:#23603a}#summary{font-size:12px;color:#52635a;white-space:pre-wrap}.hint{font-size:12px;color:#64736a;line-height:1.5}.calendar-frame{display:block;width:100%;height:min(1050px,calc(100vh - 190px));min-height:680px;border:1px solid #dce6de;border-radius:10px;background:#f4f7f5}.tab-panel,.promo-panel{min-width:0}@media(max-width:700px){body{padding:12px 8px}.head,.content{padding:18px}.auth-row{align-items:stretch;flex-direction:column}.auth-row button{width:100%}.tabs{margin:0 -18px 16px;padding:0 18px}.tab{flex:1;padding:11px 6px;font-size:12px}.calendar-frame{height:calc(100vh - 230px);min-height:600px}.manager-form{grid-template-columns:1fr;padding:12px}.field-full{grid-column:auto}.monthly-toolbar{grid-template-columns:1fr}.manager-form-actions button{flex:1}.entitlement-card{padding:13px}.distribution-panel{align-items:stretch;flex-direction:column}.distribution-panel button{width:100%}.distribution-history article{align-items:flex-start;flex-direction:column}.distribution-history button{width:100%}.dialog-actions{flex-direction:column-reverse}.dialog-actions button{width:100%}}@media(max-width:420px){.calendar-frame{min-height:520px}.head h1{font-size:23px}.content{padding:14px}.tabs{margin-left:-14px;margin-right:-14px;padding-left:14px;padding-right:14px}.entitlement-top{display:block}.status-pill{margin-top:9px}.promo-tabs{gap:5px}.promo-tab{flex:1;padding:9px 6px;font-size:11px}.entitlement-actions button{flex-basis:40%}}
</style>
<style>
.status-pill.no-credits{background:#fbeceb;color:#943e38}
#pendingMonthlyPurchases{width:100%;min-width:0;margin:0}
#pendingMonthlyPurchases>article{align-items:center}
@media(max-width:700px){.usage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<main class="shell">
<header class="head"><p>A10tion To Detail · Operations</p><h1>Business manager</h1><p class="sub">Manage promo code batches and booking availability in one place.</p></header>
<section class="content">
<div class="auth-row"><input id="adminKey" type="password" autocomplete="current-password" placeholder="Admin or calendar API key" aria-label="Admin or calendar API key"><button id="connect" type="button">Connect managers</button></div>
<p id="status" role="status" aria-live="polite"></p>
<nav class="tabs" role="tablist" aria-label="Business manager sections">
  <button id="promoTab" class="tab" type="button" role="tab" aria-selected="true" aria-controls="promoPanel">Promo codes</button>
  <button id="bookingRequestsTab" class="tab" type="button" role="tab" aria-selected="false" aria-controls="bookingRequestsPanel">Booking requests</button>
  <button id="calendarTab" class="tab" type="button" role="tab" aria-selected="false" aria-controls="calendarPanel">Calendar</button>
</nav>
<section id="promoPanel" class="tab-panel" role="tabpanel" aria-labelledby="promoTab">
<nav class="promo-tabs" role="tablist" aria-label="Promo code type">
  <button id="singleWashTab" class="promo-tab" type="button" role="tab" aria-selected="true" aria-controls="singleWashPanel">Single Washes</button>
  <button id="monthlyWashTab" class="promo-tab" type="button" role="tab" aria-selected="false" aria-controls="monthlyWashPanel">Monthly Clients</button>
</nav>
<section id="singleWashPanel" class="promo-panel" role="tabpanel" aria-labelledby="singleWashTab">
<p class="note">Paste up to 50 rows from your spreadsheet. Use tab-separated columns: number, password, promo code (or just password, promo code). Saving replaces the active batch. Redeemed promo codes stay permanently blocked, even after rotating batches.</p>
<div class="buttons"><button id="load" class="secondary" type="button">Load current batch</button></div>
<label for="pairs">Password and promo-code rows</label>
<textarea id="pairs" spellcheck="false" placeholder="01&#9;A10x!7Qp&#9;Detail10&#10;02&#9;ATD#42Lm&#9;Shine10"></textarea>
<p class="hint">Passwords are exact and case-sensitive. Duplicate promo codes are allowed, but that promo code can only be redeemed once across the batch.</p>
<div class="buttons"><button id="save" type="button">Save active batch</button></div>
<pre id="summary"></pre>
</section>
<section id="monthlyWashPanel" class="promo-panel" role="tabpanel" aria-labelledby="monthlyWashTab" hidden>
  <p class="note">A confirmed first package payment automatically creates and emails a random access code. Standard permits up to 2 bookings per billing period and Premium up to 4. Unused prepaid washes roll over, but the per-period booking cap remains. Record each later payment here; the customer keeps the same code and receives the added wash credits by email.</p>
  <h2 id="monthlyFormTitle" style="margin:20px 0 10px;font-size:17px;color:#1e3128">Create monthly entitlement</h2>
  <form id="monthlyForm" class="manager-form">
    <input id="monthlyId" type="hidden">
    <label class="field-label">Customer name<input class="manager-input" name="customerName" maxlength="120" autocomplete="name" required></label>
    <label class="field-label">Customer email<input class="manager-input" name="email" type="email" autocomplete="email" required></label>
    <label class="field-label">Contact number<input class="manager-input" name="customerPhone" type="tel" autocomplete="tel" required></label>
    <label class="field-label">Business / family name <span style="font-weight:400;color:#68776e">(optional)</span><input class="manager-input" name="businessName" maxlength="120" autocomplete="organization"></label>
    <label class="field-label">Client group<select class="manager-select" name="clientType" required><option value="private">Private Client</option><option value="business">Business / Fleet / Family</option></select></label>
    <label class="field-label">Package<select class="manager-select" name="packageTier" required><option value="standard">Standard · 2 washes per billing period</option><option value="premium">Premium · 4 washes per billing period</option></select></label>
    <label class="field-label">Active from<input class="manager-input" name="validFrom" type="date" required></label>
    <label class="field-label">Active until <span style="font-weight:400;color:#68776e">(optional)</span><input class="manager-input" name="validUntil" type="date"></label>
    <div class="field-full manager-form-actions">
      <button id="monthlySubmit" type="submit">Generate monthly code</button>
      <button id="monthlyCancel" class="secondary" type="button" hidden>Cancel edit</button>
      <button id="monthlyReload" class="secondary" type="button">Refresh dashboard</button>
    </div>
  </form>
  <section class="distribution-panel" style="display:block" aria-label="Paid monthly purchases requiring review">
    <div><h3>Paid purchases needing review</h3><p>Purchases for an existing customer appear here so you can apply the payment to the correct entitlement.</p></div>
    <div id="pendingMonthlyPurchases" class="distribution-history" aria-live="polite"></div>
  </section>
  <section class="distribution-panel" aria-label="Monthly access code email distribution">
    <div><h3>Email monthly access codes</h3><p>Preview active clients before sending. Delivery status updates when Resend confirms it.</p><label class="field-label" style="margin-top:8px">Administrator name<input id="distributionAdmin" class="manager-input" maxlength="100" autocomplete="name" placeholder="Business Manager admin"></label></div>
    <button id="bulkEmail" type="button">Preview bulk email</button>
  </section>
  <div id="distributionHistory" class="distribution-history" aria-live="polite"></div>
  <div class="monthly-toolbar">
    <input id="monthlySearch" class="manager-search" type="search" placeholder="Search customer, email, package or code" aria-label="Search monthly entitlements">
    <span id="monthlyCount" class="hint" aria-live="polite"></span>
  </div>
  <div id="monthlyCards" class="monthly-grid"></div>
  <div id="monthlyEmpty" class="empty-state" hidden>No monthly entitlements match your search.</div>
  <dialog id="bulkConfirmDialog" class="manager-dialog">
    <div class="manager-dialog-inner">
      <h2>Confirm monthly code email</h2>
      <p id="bulkPreviewSummary"></p>
      <ul id="bulkPreviewClients"></ul>
      <div class="dialog-actions">
        <button id="bulkCancel" class="secondary" type="button">Cancel</button>
        <button id="bulkConfirm" type="button">Send to eligible clients</button>
      </div>
    </div>
  </dialog>
</section>
</section>
<section id="bookingRequestsPanel" class="tab-panel" role="tabpanel" aria-labelledby="bookingRequestsTab" hidden>
  <p class="note">New website bookings arrive here as Pending Approval. Approving sends the customer a secure continuation link; a booking is not confirmed or charged until the customer completes the next step. Declining releases any temporary slot and monthly wash reservation.</p>
  <div class="monthly-toolbar">
    <input id="bookingRequestSearch" class="manager-search" type="search" placeholder="Search customer, email, reference or status" aria-label="Search booking requests">
    <div class="buttons" style="margin:0"><button id="bookingRequestReload" class="secondary" type="button">Refresh requests</button></div>
  </div>
  <div id="bookingRequestCards" class="monthly-grid"></div>
  <div id="bookingRequestEmpty" class="empty-state" hidden>No booking requests found.</div>
</section>
<section id="calendarPanel" class="tab-panel" role="tabpanel" aria-labelledby="calendarTab" hidden>
  <iframe id="calendarFrame" class="calendar-frame" title="Booking calendar manager" loading="lazy"></iframe>
</section>
</section>
</main>
<script>
const keyInput=document.getElementById('adminKey');
const rowsInput=document.getElementById('pairs');
const statusNode=document.getElementById('status');
const summaryNode=document.getElementById('summary');
const loadButton=document.getElementById('load');
const saveButton=document.getElementById('save');
const connectButton=document.getElementById('connect');
const calendarFrame=document.getElementById('calendarFrame');
const promoTab=document.getElementById('promoTab');
const calendarTab=document.getElementById('calendarTab');
const bookingRequestsTab=document.getElementById('bookingRequestsTab');
const promoPanel=document.getElementById('promoPanel');
const bookingRequestsPanel=document.getElementById('bookingRequestsPanel');
const calendarPanel=document.getElementById('calendarPanel');
const bookingRequestSearch=document.getElementById('bookingRequestSearch');
const bookingRequestReload=document.getElementById('bookingRequestReload');
const bookingRequestCards=document.getElementById('bookingRequestCards');
const bookingRequestEmpty=document.getElementById('bookingRequestEmpty');
const singleWashTab=document.getElementById('singleWashTab');
const monthlyWashTab=document.getElementById('monthlyWashTab');
const singleWashPanel=document.getElementById('singleWashPanel');
const monthlyWashPanel=document.getElementById('monthlyWashPanel');
const monthlyForm=document.getElementById('monthlyForm');
const monthlyCards=document.getElementById('monthlyCards');
const pendingMonthlyPurchasesNode=document.getElementById('pendingMonthlyPurchases');
const monthlySearch=document.getElementById('monthlySearch');
const monthlyCount=document.getElementById('monthlyCount');
const monthlyEmpty=document.getElementById('monthlyEmpty');
const monthlySubmit=document.getElementById('monthlySubmit');
const monthlyCancel=document.getElementById('monthlyCancel');
const bulkEmailButton=document.getElementById('bulkEmail');
const distributionHistory=document.getElementById('distributionHistory');
const bulkConfirmDialog=document.getElementById('bulkConfirmDialog');
const bulkPreviewSummary=document.getElementById('bulkPreviewSummary');
const bulkPreviewClients=document.getElementById('bulkPreviewClients');
const bulkConfirmButton=document.getElementById('bulkConfirm');
const bulkCancelButton=document.getElementById('bulkCancel');
const distributionAdmin=document.getElementById('distributionAdmin');
let monthlyEntitlements=[];
let monthlyDistributionRuns=[];
let pendingMonthlyPurchases=[];
let pendingBulkRunId='';
let bookingRequests=[];
const managerStorageKey='a10tion-admin-manager-key';
function setStatus(message,type=''){statusNode.textContent=message;statusNode.className=type;}
function activateTab(tab){
  const isCalendar=tab==='calendar';
  const isBookingRequests=tab==='booking-requests';
  promoTab.setAttribute('aria-selected',String(!isCalendar&&!isBookingRequests));
  bookingRequestsTab.setAttribute('aria-selected',String(isBookingRequests));
  calendarTab.setAttribute('aria-selected',String(isCalendar));
  promoPanel.hidden=isCalendar||isBookingRequests;
  bookingRequestsPanel.hidden=!isBookingRequests;
  calendarPanel.hidden=!isCalendar;
  if(isBookingRequests) loadBookingRequests();
  if(isCalendar&&!calendarFrame.src){
    if(!connectManagers()) return;
  }
}
function activatePromoTab(tab){
  const isMonthly=tab==='monthly';
  singleWashTab.setAttribute('aria-selected',String(!isMonthly));
  monthlyWashTab.setAttribute('aria-selected',String(isMonthly));
  singleWashPanel.hidden=isMonthly;
  monthlyWashPanel.hidden=!isMonthly;
  if(isMonthly) loadMonthlyEntitlements();
}
function parseRows(text){
  const rows=[];
  for(const line of text.split(/\\r?\\n/)){
    if(!line.trim()) continue;
    let cells=line.includes('\\t')?line.split('\\t'):line.split(',');
    cells=cells.map(cell=>cell.trim());
    if(cells.some(cell=>/password/i.test(cell))&&cells.some(cell=>/promo/i.test(cell))) continue;
    if(cells.length>=3) rows.push({password:cells[cells.length-2],promoCode:cells[cells.length-1]});
    else if(cells.length===2) rows.push({password:cells[0],promoCode:cells[1]});
    else throw new Error('Each row needs a password and a promo code, separated by tabs or commas.');
  }
  return rows;
}
async function request(method,body){
  const response=await fetch(location.pathname,{method,headers:{'Accept':'application/json','Content-Type':'application/json','x-admin-key':keyInput.value.trim()},body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message||'Request failed.');
  return result;
}
async function monthlyRequest(method,body){
  const response=await fetch('/api/admin/monthly-promos',{method,headers:{'Accept':'application/json','Content-Type':'application/json','x-admin-key':keyInput.value.trim()},body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message||'Monthly entitlement request failed.');
  return result;
}
async function bookingRequestApi(method,body){
  const response=await fetch('/api/admin/booking-requests',{method,headers:{'Accept':'application/json','Content-Type':'application/json','x-admin-key':keyInput.value.trim()},body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message||'Booking request operation failed.');
  return result;
}
function renderBookingRequests(){
  const query=bookingRequestSearch.value.trim().toLowerCase();
  const filtered=bookingRequests.filter(item=>[
    item.reference,item.customer?.firstName,item.customer?.surname,item.customer?.email,item.customer?.mobile,item.status,item.customerType,item.monthlyPackageTier,
  ].some(value=>String(value||'').toLowerCase().includes(query)));
  bookingRequestEmpty.hidden=filtered.length>0;
  bookingRequestCards.innerHTML=filtered.map(item=>{
    const name=[item.customer?.firstName,item.customer?.surname].filter(Boolean).join(' ')||'Customer';
    const packageText=item.customerType?item.customerType+' · '+(item.monthlyPackageTier||'').replace(/^./,char=>char.toUpperCase())+' · '+item.monthlyAllowance+' washes per billing period':item.packageName;
    const history=(item.events||[]).map(event=>'<li><strong>'+escapeHtml(event.status)+'</strong> · '+escapeHtml(new Date(event.at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))+(event.reason?' · '+escapeHtml(event.reason):'')+'</li>').join('');
    const statusClass=String(item.status||'').toLowerCase().replace(/\\s+/g,'-');
    const actions=item.status==='pending'
      ? '<div class="entitlement-actions"><button type="button" data-action="approve" data-reference="'+escapeHtml(item.reference)+'">Approve request</button><button class="danger" type="button" data-action="decline" data-reference="'+escapeHtml(item.reference)+'">Decline</button></div>'
      : ['approved','declined','checkout_starting','payment_pending'].includes(item.status)&&item.notificationSent!==true
        ? '<div class="entitlement-actions"><button type="button" data-action="resend-notification" data-reference="'+escapeHtml(item.reference)+'">Resend outcome email</button></div>'
        : '';
    return '<article class="entitlement-card" data-reference="'+escapeHtml(item.reference)+'">'+
      '<div class="entitlement-top"><div><h3 class="entitlement-name">'+escapeHtml(name)+'</h3><p class="entitlement-meta">'+escapeHtml(item.customer?.email)+' · '+escapeHtml(item.customer?.mobile)+'<br>'+escapeHtml(packageText)+'<br>'+escapeHtml(item.vehicleType)+' · '+escapeHtml(item.customer?.registration)+'<br>'+escapeHtml(item.bookingDate)+' at '+escapeHtml(item.bookingTime)+' · '+(item.status==='pending'?'Payment chosen after approval':item.paymentMethod==='onsite'?'Pay on arrival':'Online payment')+'</p></div><span class="status-pill '+statusClass+'">'+escapeHtml(item.status.replaceAll('_',' '))+'</span></div>'+
      '<div class="entitlement-code"><code>Reference '+escapeHtml(item.reference)+'</code><span>Expires '+escapeHtml(new Date(item.expiresAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))+'</span></div>'+
      actions+
      '<details class="entitlement-history"><summary>Request history ('+(item.events||[]).length+')</summary><ul class="history-list">'+(history||'<li>No history.</li>')+'</ul></details>'+
      (item.notificationError?'<p class="hint">'+escapeHtml(item.notificationError)+'</p>':'')+
      '</article>';
  }).join('');
}
async function loadBookingRequests(){
  if(!keyInput.value.trim()){setStatus('Enter an admin or calendar API key to review booking requests.','error');return;}
  bookingRequestCards.setAttribute('aria-busy','true');
  bookingRequestCards.innerHTML='<div class="empty-state">Loading booking requests…</div>';
  try{
    const result=await bookingRequestApi('GET');
    bookingRequests=Array.isArray(result.requests)?result.requests:[];
    renderBookingRequests();
    setStatus('Booking requests refreshed.','ok');
  }catch(error){bookingRequestCards.innerHTML='';bookingRequestEmpty.hidden=false;bookingRequestEmpty.textContent=error.message;setStatus(error.message,'error');}
  finally{bookingRequestCards.removeAttribute('aria-busy');}
}
async function finishDistributionRun(runId,action){
  let result=await monthlyRequest('POST',{action,runId});
  while(result.run?.status==='sending'){
    const sent=(result.run.results||[]).length;
    setStatus('Processing monthly code email batch… '+sent+' of '+(result.run.recipientCount||result.run.recipients?.length||0)+' recorded.');
    await new Promise(resolve=>setTimeout(resolve,700));
    result=await monthlyRequest('POST',{action,runId});
  }
  return result;
}
function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function formatMonth(value){
  if(!value) return '';
  const date=String(value);
  const month=date.length===7?date:date.slice(0,7);
  return new Intl.DateTimeFormat('en-ZA',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));
}
function formatZar(cents){
  return 'R'+(Number(cents||0)/100).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function packageLabel(record){
  const group=record.clientType==='business'?'Business / Fleet / Family':'Private Client';
  const tier=record.packageTier==='premium'?'Premium':'Standard';
  return group+' · '+tier+' Package';
}
function renderMonthlyEntitlements(){
  const query=monthlySearch.value.trim().toLowerCase();
  const records=monthlyEntitlements.filter(record=>[
    record.customerName,record.email,record.customerPhone,record.businessName,record.code,record.clientType,record.packageTier,record.status,
  ].some(value=>String(value||'').toLowerCase().includes(query)));
  monthlyCount.textContent=records.length+' of '+monthlyEntitlements.length+' entitlements';
  monthlyEmpty.hidden=records.length>0;
  monthlyCards.innerHTML=records.map(record=>{
    const slug=String(record.status||'').toLowerCase().replace(/\\s+/g,'-');
    const codeHistory=(record.codeHistory||[]).map(entry=>{
      const oldCode=String(entry.code||'');
      const masked=oldCode.includes('****')?oldCode:(oldCode.length>4?oldCode.slice(0,5)+'****'+oldCode.slice(-4):'****');
      return '<li>Previous code <strong>'+escapeHtml(masked)+'</strong> · replaced '+escapeHtml(new Date(entry.replacedAt).toLocaleDateString('en-ZA'))+'</li>';
    }).join('');
    const auditHistory=(record.auditHistory||[]).map(entry=>{
      const changes=Object.entries(entry.changes||{}).map(([field,value])=>field+': '+String(value.from??'—')+' → '+String(value.to??'—')).join('; ');
      return '<li><strong>'+escapeHtml(entry.action||'updated')+'</strong> · '+escapeHtml(new Date(entry.createdAt).toLocaleString('en-ZA'))+(changes?' · '+escapeHtml(changes):'')+(entry.reason?' · Reason: '+escapeHtml(entry.reason):'')+'</li>';
    }).join('');
    const emailHistory=(record.distributionHistory||[]).map(entry=>{
      const emailStatus=entry.status==='accepted'?'accepted by provider · delivery pending':entry.status||'unknown';
      return '<li><strong>Access-code email '+escapeHtml(emailStatus)+'</strong> · '+escapeHtml(new Date(entry.createdAt).toLocaleString('en-ZA'))+' · '+escapeHtml(entry.recipient||record.email)+' · Code '+escapeHtml(entry.codeReference||'masked')+(entry.providerStatus?' · '+escapeHtml(entry.providerStatus):'')+(entry.providerEmailId?' · Resend ID '+escapeHtml(entry.providerEmailId):'')+(entry.failureReason?' · '+escapeHtml(entry.failureReason):'')+'</li>';
    }).join('');
    const usageHistory=(record.history||[]).map(entry=>{
      if(typeof entry==='string'){try{entry=JSON.parse(entry);}catch{return '';}}
      const packageDetails=entry.customerTypeLabel&&entry.packageLabel?' · '+escapeHtml(entry.customerTypeLabel)+' · '+escapeHtml(entry.packageLabel)+' ('+escapeHtml(entry.monthlyAllowance)+' washes)':'';
      const remainingDetails=entry.remainingAfter!==undefined?' · '+escapeHtml(entry.remainingAfter)+' remaining after booking':'';
      const contactDetails=[entry.businessName,entry.customerPhone].filter(Boolean).map(escapeHtml).join(' · ');
      return '<li><strong>'+escapeHtml(entry.bookingDate||'')+' '+escapeHtml(entry.bookingTime||'')+'</strong> · '+escapeHtml(entry.vehicleType||'Wash')+packageDetails+(contactDetails?' · '+contactDetails:'')+' · '+escapeHtml(entry.registration||'')+' · Ref '+escapeHtml(entry.reference||'')+' · '+escapeHtml(formatMonth(entry.period||''))+remainingDetails+'</li>';
    }).join('');
    const paymentHistory=(record.paymentHistory||[]).map(entry=>'<li><strong>'+escapeHtml(entry.type==='initial'?'Initial package payment':'Monthly payment')+'</strong> · '+escapeHtml(new Date(entry.paidAt).toLocaleString('en-ZA'))+' · '+escapeHtml(formatZar(entry.amountCents))+' · '+escapeHtml(entry.creditsAdded||record.monthlyAllowance)+' washes added · Ref '+escapeHtml(entry.reference||'')+(entry.packageName?' · '+escapeHtml(entry.packageName):'')+'</li>').join('');
    const dateRange='Active '+escapeHtml(record.validFrom||'')+(record.validUntil?' – '+escapeHtml(record.validUntil):' · no end date');
    return '<article class="entitlement-card" data-id="'+escapeHtml(record.id)+'">'+
      '<div class="entitlement-top"><div><h3 class="entitlement-name">'+escapeHtml(record.customerName)+'</h3><p class="entitlement-meta">'+escapeHtml(record.email)+' · '+escapeHtml(record.customerPhone||'No phone')+(record.businessName?'<br>'+escapeHtml(record.businessName):'')+'<br>'+escapeHtml(packageLabel(record))+' · '+escapeHtml(dateRange)+(record.vehicleType?'<br>'+escapeHtml(record.vehicleType):'')+(record.contractOption?'<br>'+escapeHtml(record.contractOption)+' contract':'')+'</p></div><span class="status-pill '+slug+'">'+escapeHtml(record.status)+'</span></div>'+
      '<div class="entitlement-code"><code>'+escapeHtml(record.code)+'</code><button type="button" data-action="copy" data-code="'+escapeHtml(record.code)+'">Copy</button></div>'+
      '<div class="usage-grid"><div class="usage-cell"><strong>'+record.monthlyAllowance+'</strong><span>Booking cap · '+escapeHtml(formatMonth(record.period))+'</span></div><div class="usage-cell"><strong>'+record.used+'</strong><span>Used this period'+(record.reserved?' · '+record.reserved+' pending':'')+'</span></div><div class="usage-cell"><strong>'+record.periodRemaining+'</strong><span>Booking slots left</span></div><div class="usage-cell"><strong>'+record.creditsAvailable+'</strong><span>Wash credits available</span></div></div>'+
      '<p class="hint" style="margin:8px 0 0">Reserved credits across bookings: '+escapeHtml(record.creditsReserved||0)+' · Billing period: '+escapeHtml(record.period)+' to '+escapeHtml(record.periodEnd||'')+'</p>'+
      '<div class="entitlement-actions"><button type="button" data-action="email">Email access code</button><button type="button" data-action="payment">Record monthly payment</button><button type="button" data-action="edit">Edit details</button><button type="button" data-action="replace">Replace code</button><button type="button" data-action="toggle">'+(record.active?'Deactivate':'Activate')+'</button><button class="danger" type="button" data-action="archive">Archive</button></div>'+
      '<details class="entitlement-history"><summary>Booking, payment, access and audit history ('+((record.history||[]).length+(record.paymentHistory||[]).length+(record.codeHistory||[]).length+(record.distributionHistory||[]).length+(record.auditHistory||[]).length)+')</summary><ul class="history-list">'+(usageHistory||'<li>No confirmed monthly wash bookings yet.</li>')+paymentHistory+codeHistory+emailHistory+auditHistory+(record.deactivationReason?'<li>Current status reason: '+escapeHtml(record.deactivationReason)+'</li>':'')+'</ul></details>'+
      '</article>';
  }).join('');
  renderPendingMonthlyPurchases();
  renderMonthlyDistributionRuns();
}
function renderPendingMonthlyPurchases(){
  if(!pendingMonthlyPurchases.length){
    pendingMonthlyPurchasesNode.innerHTML='<p class="hint">No paid purchases currently need review.</p>';
    return;
  }
  pendingMonthlyPurchasesNode.innerHTML=pendingMonthlyPurchases.map(purchase=>{
    const matched=monthlyEntitlements.some(record=>String(record.email||'').toLowerCase()===String(purchase.email||'').toLowerCase());
    return '<article><div><strong>'+escapeHtml(purchase.customerName)+' · '+escapeHtml(packageLabel(purchase))+'</strong><br>'+escapeHtml(purchase.email)+' · '+escapeHtml(formatZar(purchase.amountCents))+' · Paid '+escapeHtml(new Date(purchase.paidAt).toLocaleString('en-ZA'))+' · Ref '+escapeHtml(purchase.reference)+'<br>'+escapeHtml(purchase.packageName||'Monthly package')+' · '+escapeHtml(purchase.vehicleType||'')+'</div><button type="button" data-action="apply-purchase" data-reference="'+escapeHtml(purchase.reference)+'" '+(matched?'':'disabled')+'>'+(matched?'Apply payment':'Create matching customer record first')+'</button></article>';
  }).join('');
}
function renderMonthlyDistributionRuns(){
  distributionHistory.innerHTML=monthlyDistributionRuns.map(run=>{
    const failures=(run.results||[]).filter(result=>result.status==='failed').length;
    const reportStatus=' · business report '+escapeHtml(run.reportStatus||'pending');
    const outcomes=(run.results||[]).map(result=>'<tr><td>'+escapeHtml(result.customerName)+'</td><td>'+escapeHtml(result.customerTypeLabel)+'</td><td>'+escapeHtml(result.packageLabel)+'</td><td>'+escapeHtml(result.email)+'</td><td><code>'+escapeHtml(result.code)+'</code></td><td>'+escapeHtml(result.deliveryLabel||result.status)+(result.failureReason?' · '+escapeHtml(result.failureReason):'')+'</td></tr>').join('');
    const exclusions=(run.exclusions||[]).map(entry=>'<tr><td>'+escapeHtml(entry.customerName)+'</td><td>'+escapeHtml(entry.customerTypeLabel||'—')+'</td><td>'+escapeHtml(entry.packageLabel||'—')+'</td><td>'+escapeHtml(entry.email)+'</td><td>—</td><td>Excluded · '+escapeHtml(entry.reason)+'</td></tr>').join('');
    return '<article><div><strong>'+escapeHtml(run.runType==='individual'?'Individual code email':'Monthly code distribution')+' · '+escapeHtml(run.status)+'</strong><br>'+escapeHtml(run.initiatedAtSA||new Date(run.createdAt).toLocaleString('en-ZA'))+' · '+escapeHtml(run.adminName||'Business Manager admin')+' · '+escapeHtml(run.recipientCount||run.recipients?.length||0)+' clients'+(failures?' · '+failures+' failed':'')+reportStatus+
      '<details style="margin-top:8px"><summary>Open full distribution record</summary><div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Customer</th><th>Type</th><th>Package</th><th>Email</th><th>Code</th><th>Status / reason</th></tr></thead><tbody>'+outcomes+exclusions+'</tbody></table></div><p>Completed: '+escapeHtml(run.completedAtSA||'In progress')+' · Report: '+escapeHtml(run.reportStatus||'pending')+(run.reportFailureReason?' · '+escapeHtml(run.reportFailureReason):'')+'</p></details></div>'+
      (run.status==='completed_with_failures'?'<button type="button" data-action="retry-run" data-run-id="'+escapeHtml(run.id)+'">Retry failed emails</button>':run.status==='sending'?'<button type="button" data-action="continue-run" data-run-id="'+escapeHtml(run.id)+'">Continue sending</button>':run.reportStatus==='failed'?'<button type="button" data-action="retry-report" data-run-id="'+escapeHtml(run.id)+'">Retry business report</button>':'')+'</article>';
  }).join('');
}
async function loadMonthlyEntitlements(){
  if(!keyInput.value.trim()){setStatus('Enter an admin or calendar API key to manage monthly washes.','error');return;}
  monthlyCards.setAttribute('aria-busy','true');
  monthlyCards.innerHTML='<div class="empty-state">Loading monthly entitlements…</div>';
  try{
    const result=await monthlyRequest('GET');
    monthlyEntitlements=Array.isArray(result.entitlements)?result.entitlements:[];
    monthlyDistributionRuns=Array.isArray(result.distributionRuns)?result.distributionRuns:[];
    pendingMonthlyPurchases=Array.isArray(result.pendingPurchases)?result.pendingPurchases:[];
    renderMonthlyEntitlements();
    setStatus('Monthly entitlement dashboard refreshed.','ok');
  }catch(error){
    monthlyCards.innerHTML='';
    monthlyEmpty.hidden=false;
    monthlyEmpty.textContent=error.message;
    setStatus(error.message,'error');
  }finally{monthlyCards.removeAttribute('aria-busy');}
}
function resetMonthlyForm(){
  monthlyForm.reset();
  document.getElementById('monthlyId').value='';
  const now=new Date();
  monthlyForm.elements.validFrom.value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  document.getElementById('monthlyFormTitle').textContent='Create monthly entitlement';
  monthlySubmit.textContent='Generate monthly code';
  monthlyCancel.hidden=true;
}
function editMonthlyEntitlement(record){
  document.getElementById('monthlyId').value=record.id;
  monthlyForm.elements.customerName.value=record.customerName;
  monthlyForm.elements.email.value=record.email;
  monthlyForm.elements.customerPhone.value=record.customerPhone||'';
  monthlyForm.elements.businessName.value=record.businessName||'';
  monthlyForm.elements.clientType.value=record.clientType;
  monthlyForm.elements.packageTier.value=record.packageTier;
  monthlyForm.elements.validFrom.value=record.validFrom;
  monthlyForm.elements.validUntil.value=record.validUntil||'';
  document.getElementById('monthlyFormTitle').textContent='Edit monthly entitlement';
  monthlySubmit.textContent='Save entitlement';
  monthlyCancel.hidden=false;
  monthlyForm.scrollIntoView({behavior:'smooth',block:'start'});
}
monthlyForm.addEventListener('submit',async event=>{
  event.preventDefault();
  monthlySubmit.disabled=true;
  setStatus('Saving monthly entitlement…');
  const id=document.getElementById('monthlyId').value;
  const payload=Object.fromEntries(new FormData(monthlyForm).entries());
  try{
    const result=await monthlyRequest(id?'PUT':'POST',id?{...payload,id}:{...payload});
    resetMonthlyForm();
    await loadMonthlyEntitlements();
    setStatus(id?'Monthly entitlement updated.':'Monthly code generated. Copy it from the customer card to share it securely.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{monthlySubmit.disabled=false;}
});
monthlyCancel.addEventListener('click',resetMonthlyForm);
document.getElementById('monthlyReload').addEventListener('click',loadMonthlyEntitlements);
monthlySearch.addEventListener('input',renderMonthlyEntitlements);
monthlyCards.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');
  if(!button)return;
  const card=button.closest('.entitlement-card');
  const record=monthlyEntitlements.find(item=>item.id===card?.dataset.id);
  if(!record)return;
  try{
    if(button.dataset.action==='copy'){
      await navigator.clipboard.writeText(button.dataset.code);
      setStatus('Monthly code copied.','ok');
      return;
    }
    if(button.dataset.action==='email'){
      if(!window.confirm('Send a new monthly access-code email to '+record.customerName+' at '+record.email+'?'))return;
      button.disabled=true;
      const result=await monthlyRequest('POST',{action:'send-one',id:record.id,adminName:distributionAdmin.value.trim()});
      setStatus(result.run?.status==='completed'?'Email accepted by the provider; delivery confirmation is pending.':'Email status: '+(result.run?.status||'unknown'),'ok');
      await loadMonthlyEntitlements();
      return;
    }
    if(button.dataset.action==='payment'){
      const amountText=window.prompt('Enter the monthly payment received in rand (for example 1150.00):');
      if(amountText===null)return;
      const amountCents=Math.round(Number(amountText.replace(/[R\\s,]/g,''))*100);
      if(!Number.isSafeInteger(amountCents)||amountCents<1){setStatus('Enter a valid payment amount greater than zero.','error');return;}
      const paymentReference=window.prompt('Enter a unique bank, card-machine or receipt reference:');
      if(paymentReference===null)return;
      button.disabled=true;
      const result=await monthlyRequest('POST',{action:'record-payment',id:record.id,paymentReference:paymentReference.trim(),amountCents});
      await loadMonthlyEntitlements();
      setStatus(result.entitlement?.emailError?'Payment recorded, but code email failed: '+result.entitlement.emailError:'Payment recorded; '+record.monthlyAllowance+' wash credits were added and the access code email was queued.',result.entitlement?.emailError?'error':'ok');
      return;
    }
    if(button.dataset.action==='edit'){editMonthlyEntitlement(record);return;}
    if(button.dataset.action==='replace'){
      if(!window.confirm('Replace this code? The old code will stop working; booking history and monthly usage will stay attached to the customer.'))return;
      await monthlyRequest('PUT',{id:record.id,replaceCode:true});
      setStatus('Monthly code replaced; historical usage is preserved.','ok');
    }else if(button.dataset.action==='toggle'){
      const reason=window.prompt((record.active?'Why are you deactivating':'Why are you reactivating')+' this monthly client?');
      if(reason===null)return;
      if(reason.trim().length<3){setStatus('Enter a reason of at least 3 characters.','error');return;}
      await monthlyRequest('PUT',{id:record.id,active:!record.active,deactivationReason:reason,...(!record.active&&record.archived?{archived:false}:{})});
      setStatus(record.active?'Monthly entitlement deactivated.':'Monthly entitlement activated.','ok');
    }else if(button.dataset.action==='archive'){
      const reason=window.prompt('Why are you archiving this monthly client? Their code will stop working, but booking history will remain.');
      if(reason===null)return;
      if(reason.trim().length<3){setStatus('Enter a reason of at least 3 characters.','error');return;}
      await monthlyRequest('DELETE',{id:record.id,deactivationReason:reason});
      setStatus('Entitlement archived; historical records were retained.','ok');
    }
    await loadMonthlyEntitlements();
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
});
pendingMonthlyPurchasesNode.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action="apply-purchase"]');
  if(!button)return;
  const purchase=pendingMonthlyPurchases.find(item=>item.reference===button.dataset.reference);
  const record=monthlyEntitlements.find(item=>String(item.email||'').toLowerCase()===String(purchase?.email||'').toLowerCase());
  if(!purchase||!record)return;
  if(!window.confirm('Apply the paid '+packageLabel(purchase)+' purchase ('+formatZar(purchase.amountCents)+') to '+record.customerName+'? The package must match the existing customer record.'))return;
  button.disabled=true;
  try{
    const result=await monthlyRequest('POST',{action:'record-payment',id:record.id,paymentReference:purchase.reference,amountCents:purchase.amountCents});
    await loadMonthlyEntitlements();
    setStatus(result.entitlement?.emailError?'Payment applied, but code email failed: '+result.entitlement.emailError:'Paid purchase applied; wash credits were added and the current code email was queued.',result.entitlement?.emailError?'error':'ok');
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
});
distributionHistory.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action="retry-run"],button[data-action="continue-run"],button[data-action="retry-report"]');
  if(!button)return;
  const action=button.dataset.action==='retry-run'?'retry-bulk':'send-bulk';
  if(action==='retry-bulk'&&!window.confirm('Retry only the failed recipients in this bulk email run? Successful sends will not be repeated.'))return;
  button.disabled=true;
  try{
    const result=await finishDistributionRun(button.dataset.runId,action);
    setStatus(result.run?.status==='completed'?'Monthly code email run completed.':result.run?.status==='needs_review'?'A send has an uncertain provider status; review its history before sending again.':'Retry completed with remaining failures.',result.run?.status==='completed_with_failures'?'error':'ok');
    await loadMonthlyEntitlements();
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
});
bulkEmailButton.addEventListener('click',async()=>{
  bulkEmailButton.disabled=true;
  setStatus('Preparing recipient preview…');
  try{
    const preview=await monthlyRequest('POST',{action:'preview-bulk',adminName:distributionAdmin.value.trim()});
    pendingBulkRunId=preview.runId;
    bulkPreviewSummary.textContent=preview.counts.eligible+' active clients can receive a code email; '+preview.counts.excluded+' excluded (inactive, expired, missing contact, or invalid address).';
    bulkPreviewClients.innerHTML=preview.eligible.slice(0,20).map(client=>'<li>'+escapeHtml(client.customerName)+' · '+escapeHtml(client.email)+' · '+escapeHtml(packageLabel(client))+'</li>').join('');
    if(preview.eligible.length>20)bulkPreviewClients.innerHTML+='<li>And '+(preview.eligible.length-20)+' more clients.</li>';
    bulkConfirmButton.textContent='Send to '+preview.counts.eligible+' eligible clients';
    bulkConfirmButton.disabled=preview.counts.eligible===0;
    bulkConfirmDialog.showModal();
    setStatus('Review the recipients and confirm before sending.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{bulkEmailButton.disabled=false;}
});
bulkCancelButton.addEventListener('click',()=>bulkConfirmDialog.close());
bulkConfirmButton.addEventListener('click',async()=>{
  if(!pendingBulkRunId)return;
  bulkConfirmButton.disabled=true;
  setStatus('Sending monthly access-code emails…');
  try{
    const result=await finishDistributionRun(pendingBulkRunId,'send-bulk');
    bulkConfirmDialog.close();
    pendingBulkRunId='';
    setStatus(result.run?.status==='completed_with_failures'?'Bulk email completed with failures. Review the run below to retry failed messages.':result.run?.status==='needs_review'?'A send has an uncertain provider status; review its history before sending again.':'Bulk email run completed. Provider acceptance is recorded; delivery status may follow by webhook.',result.run?.status==='completed_with_failures'||result.run?.status==='needs_review'?'error':'ok');
    await loadMonthlyEntitlements();
  }catch(error){setStatus(error.message,'error');}
  finally{bulkConfirmButton.disabled=false;}
});
singleWashTab.addEventListener('click',()=>activatePromoTab('single'));
monthlyWashTab.addEventListener('click',()=>activatePromoTab('monthly'));
document.querySelectorAll('.promo-tab').forEach((tab,index)=>tab.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    const next=index===0?monthlyWashTab:singleWashTab;
    next.focus();
    next.click();
  }
}));
bookingRequestSearch.addEventListener('input',renderBookingRequests);
bookingRequestReload.addEventListener('click',loadBookingRequests);
bookingRequestCards.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');
  if(!button)return;
  const action=button.dataset.action;
  const reference=button.dataset.reference;
  if(action==='approve'&&!window.confirm('Approve booking request '+reference+'? The customer will receive a secure continuation link.'))return;
  const reason=action==='decline'?window.prompt('Optional reason for declining this request:'):'';
  if(action==='decline'&&reason===null)return;
  button.disabled=true;
  try{
    const result=await bookingRequestApi('POST',{reference,action,reason:reason||''});
    await loadBookingRequests();
    const warning=result.request?.notificationError;
    setStatus(warning?(action==='resend-notification'?'Outcome email resend failed: ':'Request '+(action==='approve'?'approved':'declined')+', but email notification needs attention: ')+warning:action==='approve'?'Request approved and customer notified.':action==='decline'?'Request declined and temporary reservations released.':action==='resend-notification'?'Outcome email sent.':'Booking request updated.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
});
function connectManagers(){
  const key=keyInput.value.trim();
  if(!key){setStatus('Enter an admin or calendar API key to connect.','error');keyInput.focus();return false;}
  sessionStorage.setItem(managerStorageKey,key);
  sessionStorage.setItem('a10tion-calendar-key',key);
  calendarFrame.src='/api/admin/calendar?embedded=1&v='+Date.now();
  return true;
}
connectButton.addEventListener('click',async()=>{
  connectButton.disabled=true;setStatus('Connecting to the business managers…');
  try{
    if(!connectManagers()) return;
    await loadBatch();
  }catch(error){setStatus(error.message,'error');}
  finally{connectButton.disabled=false;}
});
promoTab.addEventListener('click',()=>activateTab('promo'));
bookingRequestsTab.addEventListener('click',()=>activateTab('booking-requests'));
calendarTab.addEventListener('click',()=>activateTab('calendar'));
const managerTabs=[promoTab,bookingRequestsTab,calendarTab];
managerTabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    const direction=event.key==='ArrowRight'?1:-1;
    const next=managerTabs[(index+direction+managerTabs.length)%managerTabs.length];
    next.focus();
    next.click();
  }
}));
async function loadBatch(){
  loadButton.disabled=true;setStatus('Loading current batch…');summaryNode.textContent='';
  try{
    const result=await request('GET');
    rowsInput.value=(result.pairs||[]).map((pair,index)=>[String(index+1).padStart(2,'0'),pair.password,pair.promoCode].join('\\t')).join('\\n');
    const used=(result.pairs||[]).filter(pair=>pair.used).length;
    summaryNode.textContent=result.pairs?.length?\`Batch \${result.batchId} · \${result.pairs.length} passwords · \${used} promo codes redeemed\\n\`+(result.pairs||[]).map((pair,index)=>\`\${String(index+1).padStart(2,'0')}  \${pair.promoCode}  \${pair.used?'REDEEMED':'available'}\`).join('\\n'):'No active batch is saved yet.';
    setStatus('Current batch loaded.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{loadButton.disabled=false;}
}
loadButton.addEventListener('click',async()=>{
  if(!connectManagers()) return;
  await loadBatch();
});
saveButton.addEventListener('click',async()=>{
  saveButton.disabled=true;setStatus('Saving batch…');summaryNode.textContent='';
  try{
    const pairs=parseRows(rowsInput.value);
    const result=await request('PUT',{pairs});
    rowsInput.value=(result.pairs||[]).map((pair,index)=>[String(index+1).padStart(2,'0'),pair.password,pair.promoCode].join('\\t')).join('\\n');
    summaryNode.textContent=\`Batch \${result.batchId} saved with \${result.pairs.length} password/code pairs.\`;
    setStatus('Batch saved. Promo codes are ready to reveal.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{saveButton.disabled=false;}
});
keyInput.addEventListener('keydown',event=>{if(event.key==='Enter')connectButton.click();});
const savedKey=sessionStorage.getItem(managerStorageKey)||sessionStorage.getItem('a10tion-calendar-key');
if(savedKey){
  keyInput.value=savedKey;
  connectManagers();
  loadBatch();
}
resetMonthlyForm();
const initialTab=new URLSearchParams(location.search).get('tab');
if(initialTab==='calendar'){
activateTab('calendar');
}else if(initialTab==='booking-requests'){
  activateTab('booking-requests');
}
</script>
</body>
</html>`;

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function isValidAdminKey(suppliedKey) {
    const expectedKeys = [process.env.ADMIN_API_KEY, process.env.CALENDAR_API_KEY].filter(Boolean);
    return Boolean(suppliedKey && expectedKeys.some((expectedKey) => safeEqual(suppliedKey, expectedKey)));
}

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

    const suppliedKey = req.headers['x-admin-key'];
    if (!isValidAdminKey(suppliedKey)) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    try {
        if (req.method === 'GET') {
            res.status(200).json(await getSharedPromoBatchForAdmin());
            return;
        }

        const batch = await saveSharedPromoBatch(req.body?.pairs);
        res.status(200).json(batch);
    } catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Could not update promo batch.' });
    }
}

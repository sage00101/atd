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
:root{font-family:Arial,Helvetica,sans-serif;color:#17241c;background:#f4f7f3}*{box-sizing:border-box}body{margin:0;padding:24px 16px}.shell{max-width:1240px;margin:0 auto;background:#fff;border:1px solid #dce6de;border-radius:14px;overflow:hidden}.head{padding:22px 26px;background:#1e3128;color:#fff}.head p{margin:0;color:#bcd3c1;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.head h1{margin:8px 0 0;font-size:26px}.head .sub{margin:7px 0 0;color:#d4e1d7;font-size:13px;line-height:1.5}.content{padding:20px 24px}.auth-row{display:flex;gap:9px;align-items:center;margin-bottom:14px}.auth-row input{flex:1;min-width:0;padding:11px 12px;border:1px solid #cbd9cf;border-radius:8px;font-size:14px}.buttons{display:flex;gap:8px;margin:10px 0}.buttons button,.auth-row button{border:0;border-radius:8px;padding:11px 16px;background:#1e3128;color:white;font-weight:600;cursor:pointer}.buttons button.secondary{background:#eaf1eb;color:#1e3128}.buttons button:disabled,.auth-row button:disabled{opacity:.55;cursor:wait}.tabs{display:flex;gap:6px;border-bottom:1px solid #dce6de;margin:0 -24px 18px;padding:0 24px}.tab{padding:11px 16px;border:0;border-bottom:3px solid transparent;background:transparent;color:#52635a;font-size:14px;font-weight:700;cursor:pointer}.tab[aria-selected="true"]{border-bottom-color:#2b6542;color:#1e3128}.tab-panel[hidden]{display:none}.note{padding:12px 14px;border-radius:9px;background:#edf4ee;color:#405b48;font-size:13px;line-height:1.5}label{display:block;margin-top:18px;font-size:13px;font-weight:700}textarea{display:block;width:100%;min-height:300px;margin-top:8px;padding:12px;border:1px solid #cbd9cf;border-radius:8px;font:13px/1.5 Consolas,monospace;white-space:pre;overflow:auto}#status{min-height:22px;margin:12px 0;font-size:13px}#status.error{color:#a22}#status.ok{color:#23603a}#summary{font-size:12px;color:#52635a;white-space:pre-wrap}.hint{font-size:12px;color:#64736a;line-height:1.5}.calendar-frame{display:block;width:100%;height:min(1050px,calc(100vh - 190px));min-height:680px;border:1px solid #dce6de;border-radius:10px;background:#f4f7f5}@media(max-width:700px){body{padding:12px 8px}.head,.content{padding:18px}.auth-row{align-items:stretch;flex-direction:column}.auth-row button{width:100%}.tabs{margin:0 -18px 16px;padding:0 18px}.tab{flex:1;padding:11px 6px;font-size:12px}.calendar-frame{height:calc(100vh - 230px);min-height:600px}}@media(max-width:420px){.calendar-frame{min-height:520px}}
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
  <button id="calendarTab" class="tab" type="button" role="tab" aria-selected="false" aria-controls="calendarPanel">Calendar</button>
</nav>
<section id="promoPanel" class="tab-panel" role="tabpanel" aria-labelledby="promoTab">
<p class="note">Paste up to 50 rows from your spreadsheet. Use tab-separated columns: number, password, promo code (or just password, promo code). Saving replaces the active batch. Redeemed promo codes stay permanently blocked, even after rotating batches.</p>
<div class="buttons"><button id="load" class="secondary" type="button">Load current batch</button></div>
<label for="pairs">Password and promo-code rows</label>
<textarea id="pairs" spellcheck="false" placeholder="01&#9;A10x!7Qp&#9;Detail10&#10;02&#9;ATD#42Lm&#9;Shine10"></textarea>
<p class="hint">Passwords are exact and case-sensitive. Duplicate promo codes are allowed, but that promo code can only be redeemed once across the batch.</p>
<div class="buttons"><button id="save" type="button">Save active batch</button></div>
<pre id="summary"></pre>
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
const promoPanel=document.getElementById('promoPanel');
const calendarPanel=document.getElementById('calendarPanel');
const managerStorageKey='a10tion-admin-manager-key';
function setStatus(message,type=''){statusNode.textContent=message;statusNode.className=type;}
function activateTab(tab){
  const isCalendar=tab==='calendar';
  promoTab.setAttribute('aria-selected',String(!isCalendar));
  calendarTab.setAttribute('aria-selected',String(isCalendar));
  promoPanel.hidden=isCalendar;
  calendarPanel.hidden=!isCalendar;
  if(isCalendar&&!calendarFrame.src){
    if(!connectManagers()) return;
  }
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
calendarTab.addEventListener('click',()=>activateTab('calendar'));
document.querySelectorAll('.tab').forEach((tab,index)=>tab.addEventListener('keydown',event=>{
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();
    const next=index===0?calendarTab:promoTab;
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

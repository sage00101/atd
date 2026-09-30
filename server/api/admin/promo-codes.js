import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { getSharedPromoBatchForAdmin, saveSharedPromoBatch } from '../_lib/store.js';

const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Promo Code Manager | A10tion To Detail</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#17241c;background:#f4f7f3}*{box-sizing:border-box}body{margin:0;padding:32px 16px}.shell{max-width:860px;margin:0 auto;background:#fff;border:1px solid #dce6de;border-radius:16px;overflow:hidden}.head{padding:24px 28px;background:#1e3128;color:#fff}.head p{margin:0;color:#bcd3c1;font-size:12px;text-transform:uppercase}.head h1{margin:8px 0 0;font-size:24px}.content{padding:24px 28px}.note{padding:12px 14px;border-radius:9px;background:#edf4ee;color:#405b48;font-size:13px;line-height:1.5}.row{display:flex;gap:10px;margin:18px 0 10px}.row input{flex:1;min-width:0;padding:11px 12px;border:1px solid #cbd9cf;border-radius:8px;font-size:14px}.buttons{display:flex;gap:8px;margin:10px 0}.buttons button{border:0;border-radius:8px;padding:11px 16px;background:#1e3128;color:white;font-weight:600;cursor:pointer}.buttons button.secondary{background:#eaf1eb;color:#1e3128}.buttons button:disabled{opacity:.55;cursor:wait}label{display:block;margin-top:20px;font-size:13px;font-weight:700}textarea{display:block;width:100%;min-height:300px;margin-top:8px;padding:12px;border:1px solid #cbd9cf;border-radius:8px;font:13px/1.5 Consolas,monospace;white-space:pre;overflow:auto}#status{min-height:22px;margin:12px 0;font-size:13px}#status.error{color:#a22}#status.ok{color:#23603a}#summary{font-size:12px;color:#52635a;white-space:pre-wrap}.hint{font-size:12px;color:#64736a;line-height:1.5}@media(max-width:560px){body{padding:12px 8px}.head,.content{padding:18px}.row{flex-direction:column}.buttons button{flex:1}}
</style>
</head>
<body>
<main class="shell">
<header class="head"><p>A10tion To Detail · Admin</p><h1>Promo code batches</h1></header>
<section class="content">
<p class="note">Paste up to 50 rows from your spreadsheet. Use tab-separated columns: number, password, promo code (or just password, promo code). Saving replaces the active batch. Redeemed promo codes stay permanently blocked, even after rotating batches.</p>
<div class="row"><input id="adminKey" type="password" autocomplete="current-password" placeholder="Admin API key" aria-label="Admin API key"></div>
<div class="buttons"><button id="load" class="secondary" type="button">Load current batch</button></div>
<label for="pairs">Password and promo-code rows</label>
<textarea id="pairs" spellcheck="false" placeholder="01&#9;A10x!7Qp&#9;Detail10&#10;02&#9;ATD#42Lm&#9;Shine10"></textarea>
<p class="hint">Passwords are exact and case-sensitive. Duplicate promo codes are allowed, but that promo code can only be redeemed once across the batch.</p>
<div class="buttons"><button id="save" type="button">Save active batch</button></div>
<p id="status" role="status"></p><pre id="summary"></pre>
</section>
</main>
<script>
const keyInput=document.getElementById('adminKey');
const rowsInput=document.getElementById('pairs');
const statusNode=document.getElementById('status');
const summaryNode=document.getElementById('summary');
const loadButton=document.getElementById('load');
const saveButton=document.getElementById('save');
function setStatus(message,type=''){statusNode.textContent=message;statusNode.className=type;}
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
loadButton.addEventListener('click',async()=>{
  loadButton.disabled=true;setStatus('Loading current batch…');summaryNode.textContent='';
  try{
    const result=await request('GET');
    rowsInput.value=(result.pairs||[]).map((pair,index)=>[String(index+1).padStart(2,'0'),pair.password,pair.promoCode].join('\\t')).join('\\n');
    const used=(result.pairs||[]).filter(pair=>pair.used).length;
    summaryNode.textContent=result.pairs?.length?`Batch ${result.batchId} · ${result.pairs.length} passwords · ${used} promo codes redeemed\\n`+(result.pairs||[]).map((pair,index)=>`${String(index+1).padStart(2,'0')}  ${pair.promoCode}  ${pair.used?'REDEEMED':'available'}`).join('\\n'):'No active batch is saved yet.';
    setStatus('Current batch loaded.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{loadButton.disabled=false;}
});
saveButton.addEventListener('click',async()=>{
  saveButton.disabled=true;setStatus('Saving batch…');summaryNode.textContent='';
  try{
    const pairs=parseRows(rowsInput.value);
    const result=await request('PUT',{pairs});
    rowsInput.value=(result.pairs||[]).map((pair,index)=>[String(index+1).padStart(2,'0'),pair.password,pair.promoCode].join('\\t')).join('\\n');
    summaryNode.textContent=`Batch ${result.batchId} saved with ${result.pairs.length} password/code pairs.`;
    setStatus('Batch saved. Promo codes are ready to reveal.','ok');
  }catch(error){setStatus(error.message,'error');}
  finally{saveButton.disabled=false;}
});
</script>
</body>
</html>`;

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
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

    const expectedKey = process.env.ADMIN_API_KEY;
    const suppliedKey = req.headers['x-admin-key'];
    if (!expectedKey || !suppliedKey || !safeEqual(suppliedKey, expectedKey)) {
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

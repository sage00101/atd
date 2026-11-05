import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { getSharedPromoBatchForAdmin, saveSharedPromoBatch } from '../_lib/store.js';

const managerLogoUrl = new URL(
    'assets/android-chrome-192x192.png',
    process.env.SITE_URL || 'https://sage00101.github.io/atd/',
).toString();

const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Business Manager | A10tion To Detail</title>
<style>
:root{color-scheme:light;--bg:#f6f8f6;--surface:#fff;--surface-2:#f8faf8;--surface-3:#eef4ef;--line:rgba(38,77,49,.12);--line-2:rgba(38,77,49,.2);--ink:#1d2c22;--ink-2:#405448;--muted:#718076;--accent:#4d8b5e;--accent-2:#39764d;--accent-ink:#fff;--accent-soft:rgba(77,139,94,.1);--danger:#b44740;--danger-soft:rgba(180,71,64,.1);--warn:#896516;--warn-soft:rgba(180,137,40,.12);--info:#347b94;--info-soft:rgba(52,123,148,.1);font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box;scrollbar-color:#d5e0d7 transparent}
body{margin:0;padding:28px 18px 56px;min-height:100vh;background:radial-gradient(1000px 520px at 12% -8%,rgba(77,139,94,.08),transparent 62%),radial-gradient(760px 420px at 104% 2%,rgba(77,139,94,.04),transparent 58%),var(--bg);background-attachment:fixed}
.shell.auth-locked>.head,.shell.auth-locked>.content{filter:blur(8px);pointer-events:none;user-select:none}
.auth-gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(22,39,28,.26);backdrop-filter:blur(10px)}
.auth-gate[hidden]{display:none}
.auth-card{width:min(440px,100%);padding:30px;border:1px solid rgba(38,77,49,.16);border-radius:24px;background:rgba(255,255,255,.97);box-shadow:0 32px 100px -38px rgba(20,40,27,.42);text-align:center}
.auth-logo{width:128px;height:128px;object-fit:contain;padding:12px;border-radius:22px;background:#1d3425}
.auth-card h2{margin:16px 0 6px;font-size:26px;letter-spacing:-.04em}
.auth-card p{margin:0 0 20px;color:var(--muted);font-size:13px;line-height:1.55}
.auth-card .field-label{text-align:left}
.inline-notice{margin:10px 0 0;padding:11px 14px;border-radius:11px;font-size:13px;font-weight:650;line-height:1.5;border:1px solid var(--line-2);background:var(--surface-3);color:var(--ink-2)}
.inline-notice[hidden]{display:none}
.inline-notice.ok{background:var(--accent-soft);border-color:rgba(77,139,94,.35);color:var(--accent-2)}
.inline-notice.error{background:var(--danger-soft);border-color:rgba(180,71,64,.3);color:var(--danger)}
.auth-card #connect{position:relative;width:100%;margin-top:22px;padding:15px 20px;border:0;border-radius:14px;background:linear-gradient(135deg,#5aa06d 0%,#39764d 55%,#2f6542 100%);color:#fff;font-size:15px;font-weight:700;letter-spacing:.03em;box-shadow:0 14px 28px -12px rgba(47,101,66,.65),inset 0 1px 0 rgba(255,255,255,.25);overflow:hidden;cursor:pointer;transition:transform .18s,box-shadow .18s,filter .18s}
.auth-card #connect::after{content:"→";display:inline-block;margin-left:10px;transition:transform .2s}
.auth-card #connect::before{content:"";position:absolute;top:0;left:-70%;width:50%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);transition:left .6s}
.auth-card #connect:hover{transform:translateY(-2px);filter:brightness(1.05);box-shadow:0 18px 32px -12px rgba(47,101,66,.75),inset 0 1px 0 rgba(255,255,255,.3)}
.auth-card #connect:hover::before{left:130%}
.auth-card #connect:hover::after{transform:translateX(4px)}
.auth-card #connect:active{transform:translateY(0);box-shadow:0 8px 18px -10px rgba(47,101,66,.7)}
.auth-card #connect:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(77,139,94,.3),0 14px 28px -12px rgba(47,101,66,.65)}
.auth-card #connect:disabled{opacity:.7;cursor:wait;transform:none}
.auth-gate{background:radial-gradient(700px 420px at 15% 10%,rgba(77,139,94,.22),transparent 60%),radial-gradient(600px 400px at 90% 90%,rgba(77,139,94,.16),transparent 60%),rgba(238,244,239,.82)}
.auth-card{position:relative;overflow:hidden;padding:34px 30px 28px}
.auth-card::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,var(--accent-2),#8cc79c)}
.auth-card .auth-eyebrow{margin:14px 0 0;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2)}
.auth-card .auth-status{min-height:18px;margin:14px 0 0;font-size:13px;font-weight:600;color:var(--danger)}
.auth-card .auth-status.ok{color:var(--accent-2)}
.auth-card .manager-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px rgba(77,139,94,.15)}
.auth-card #status{margin-top:12px;text-align:left}
.manager-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px}
.manager-brand{display:flex;align-items:center;gap:14px;min-width:0}
.manager-brand img{width:62px;height:62px;flex:0 0 62px;object-fit:contain;padding:5px;border-radius:15px;background:#1d3425}
.manager-brand h1{margin:0;font-size:clamp(25px,4vw,36px);line-height:1;letter-spacing:-.04em;color:#1d3425}
.manager-brand p{margin:7px 0 0;color:var(--muted);font-size:13px}
.manager-tools{display:flex;align-items:center;gap:8px}
.menu-button{display:none}
.icon-button,.menu-button{position:relative;align-items:center;justify-content:center;gap:8px;min-width:42px;min-height:42px;padding:9px 12px;border:1px solid var(--line-2);border-radius:12px;background:#fff;color:var(--ink-2);font-weight:750}
.icon-button{display:inline-flex}
.icon-button svg,.menu-button svg{width:18px;height:18px}
.notification-count{position:absolute;top:-6px;right:-6px;display:grid;place-items:center;min-width:19px;height:19px;padding:0 4px;border-radius:999px;background:var(--danger);color:#fff;font-size:10px;font-weight:800}
.manager-navbar{margin-top:22px}
.manager-drawer-backdrop{position:fixed;inset:0;z-index:800;background:rgba(20,36,26,.36);opacity:0;pointer-events:none;transition:opacity .2s}
.manager-drawer-backdrop.open{opacity:1;pointer-events:auto}
.notification-drawer{position:fixed;z-index:810;inset:0 0 0 auto;width:min(420px,92vw);padding:24px;background:#fff;box-shadow:-24px 0 80px -35px rgba(18,34,24,.35);transform:translateX(105%);transition:transform .24s;overflow:auto}
.notification-drawer.open{transform:translateX(0)}
.drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.drawer-head h2{margin:0;font-size:20px}
.drawer-close{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:20px}
.notification-list{display:grid;gap:10px;margin-top:18px}
.notification-item{padding:14px;border:1px solid var(--line);border-radius:13px;background:#f8faf8}
.notification-item strong{display:block;color:var(--ink);font-size:13px}
.notification-item span{display:block;margin-top:5px;color:var(--muted);font-size:12px;line-height:1.5}
.notification-item button{margin-top:10px;padding:7px 10px;border:1px solid var(--line-2);border-radius:8px;background:#fff;color:var(--accent-2);font-size:11px;font-weight:750}
.toolbar-inline{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.toolbar-inline .manager-search{flex:1;min-width:min(100%,240px)}
.account-collapse{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}
.account-collapse>summary{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:#f8faf8;color:var(--ink-2);font-size:12px;font-weight:750;cursor:pointer;list-style:none}
.account-collapse>summary::-webkit-details-marker{display:none}
.account-collapse>summary::after{content:"";width:9px;height:9px;border-right:2.5px solid var(--accent-2);border-bottom:2.5px solid var(--accent-2);transform:rotate(45deg) translate(-2px,-2px);transition:transform .2s}
.account-collapse[open]>summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
.entitlement-title{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.entitlement-title .status-pill{margin:0}
.account-collapse-body{padding-top:8px}
.payment-form{display:grid;gap:14px}
.payment-form .field-label{margin:0}
.payment-form .manager-input{margin-top:7px}
.dialog-close{position:absolute;top:15px;right:15px;width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:20px}
.manager-dialog-inner.has-close{position:relative;padding-top:30px}
.notification-empty{padding:18px;border:1px dashed var(--line-2);border-radius:12px;color:var(--muted);font-size:13px;text-align:center}

/* ---------- shell + header ---------- */
.shell{max-width:1240px;margin:0 auto;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:var(--surface);box-shadow:0 28px 80px -52px rgba(32,54,38,.22),0 1px 3px rgba(32,54,38,.06)}
.head{position:relative;padding:30px 34px 28px;border-bottom:1px solid var(--line);background:radial-gradient(520px 220px at 88% -30%,rgba(77,139,94,.08),transparent 70%),linear-gradient(125deg,#fff,#f8fbf8 62%)}
.head-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.eyebrow{margin:0;display:inline-flex;align-items:center;gap:9px;color:var(--ink-2);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 2.4s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(95,224,122,.55)}70%{box-shadow:0 0 0 9px rgba(95,224,122,0)}100%{box-shadow:0 0 0 0 rgba(95,224,122,0)}}
.head h1{margin:14px 0 0;font-size:clamp(28px,4vw,38px);line-height:1.08;letter-spacing:-.035em;font-weight:750;color:#1d3425;background:linear-gradient(90deg,#1d3425 35%,#4d8b5e);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.head .sub{margin:9px 0 0;max-width:620px;color:var(--muted);font-size:14px;line-height:1.55}
.conn{white-space:nowrap;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid var(--line-2);background:rgba(255,255,255,.82);color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.conn::before{content:"";width:7px;height:7px;border-radius:50%;background:#6b7f72}
.conn[data-state="on"]{color:var(--accent);border-color:rgba(95,224,122,.35);background:var(--accent-soft)}
.conn[data-state="on"]::before{background:var(--accent);box-shadow:0 0 10px rgba(95,224,122,.8)}

.content{padding:26px 32px 36px}

/* ---------- inputs ---------- */
.auth-row{display:flex;gap:10px;align-items:center}
.auth-row input{flex:1}
.auth-row input,.manager-input,.manager-select,.manager-search,textarea{width:100%;min-width:0;padding:12px 14px;border:1px solid var(--line-2);border-radius:11px;background:#fff;color:var(--ink);font:inherit;font-size:14px;transition:border-color .15s,box-shadow .15s,background .15s}
.auth-row input::placeholder,.manager-input::placeholder,.manager-search::placeholder,textarea::placeholder{color:#79877d}
.auth-row input:hover,.manager-input:hover,.manager-select:hover,.manager-search:hover,textarea:hover{border-color:rgba(77,139,94,.35)}
.auth-row input:focus,.manager-input:focus,.manager-select:focus,.manager-search:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:#fff}
.manager-select{appearance:none;padding-right:38px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23718076' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.manager-select option{background:#fff;color:var(--ink)}
textarea{display:block;min-height:300px;margin-top:8px;padding:14px 16px;font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;white-space:pre;overflow:auto;resize:vertical}
label{display:block;margin-top:20px;font-size:13px;font-weight:700;color:var(--ink-2)}
.field-label{display:block;margin:0;font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--ink-2)}
.field-label .manager-input,.field-label .manager-select{display:block;margin-top:7px}
.optional{font-weight:500;color:var(--muted)}

/* ---------- buttons ---------- */
[hidden]{display:none!important}
button{font:inherit;cursor:pointer}
button:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.auth-row button,.buttons button,.manager-form-actions button,.distribution-panel>button,.dialog-actions button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:11px;padding:12px 18px;background:linear-gradient(135deg,var(--accent-2),var(--accent));color:var(--accent-ink);font-size:13px;font-weight:750;letter-spacing:.01em;box-shadow:0 8px 20px -14px rgba(57,118,77,.42);transition:transform .15s,box-shadow .15s,filter .15s,background .15s,border-color .15s}
.auth-row button:hover,.buttons button:hover,.manager-form-actions button:hover,.distribution-panel>button:hover,.dialog-actions button:hover{transform:translateY(-1px);filter:brightness(1.04);box-shadow:0 12px 24px -14px rgba(57,118,77,.48)}
.auth-row button:active,.buttons button:active,.manager-form-actions button:active,.distribution-panel>button:active,.dialog-actions button:active{transform:translateY(0)}
.auth-row button.secondary,.buttons button.secondary,.manager-form-actions button.secondary,.dialog-actions button.secondary{background:#fff;color:var(--ink);border-color:var(--line-2);box-shadow:none}
.auth-row button.secondary:hover,.buttons button.secondary:hover,.manager-form-actions button.secondary:hover,.dialog-actions button.secondary:hover{background:#f5f8f5;border-color:rgba(77,139,94,.3);box-shadow:none}
.buttons button.danger{background:var(--danger-soft);color:var(--danger);border-color:rgba(255,143,134,.3);box-shadow:none}
button:disabled{opacity:.5;cursor:not-allowed;transform:none!important;filter:none!important}
.buttons{display:flex;gap:10px;margin:14px 0}
.manager-form-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

/* ---------- status line ---------- */
#status{display:flex;align-items:center;gap:10px;margin:14px 0 4px;padding:10px 14px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--muted);font-size:13px}
#status:empty{display:none}
#status::before{content:"";flex:0 0 8px;height:8px;border-radius:50%;background:#6b7f72}
#status.ok{color:#34764a;border-color:rgba(77,139,94,.24);background:var(--accent-soft)}
#status.ok::before{background:var(--accent);box-shadow:0 0 8px rgba(95,224,122,.7)}
#status.error{color:var(--danger);border-color:rgba(255,143,134,.3);background:var(--danger-soft)}
#status.error::before{background:var(--danger)}

/* ---------- tabs ---------- */
.tabs,.promo-tabs{display:flex;gap:6px}
.tabs{display:inline-flex;margin:22px 0 22px;padding:5px;border:1px solid var(--line);border-radius:14px;background:#f2f6f2}
.tab,.promo-tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;color:var(--muted);font-weight:700;transition:color .15s,background .15s,border-color .15s,box-shadow .15s}
.tab{padding:10px 20px;border-radius:10px;background:transparent;font-size:13px}
.tab svg{width:16px;height:16px;flex:0 0 16px}
.tab:hover,.promo-tab:hover{color:var(--ink)}
.tab[aria-selected="true"]{color:var(--ink);background:linear-gradient(180deg,#fff,#f5f8f5);border-color:var(--line-2);box-shadow:0 4px 12px -8px rgba(32,54,38,.18),inset 0 -2px 0 var(--accent)}
.promo-tabs{margin:0 0 20px;flex-wrap:wrap}
.promo-tab{padding:9px 16px;border-radius:999px;background:#f6f9f6;border-color:var(--line);font-size:12.5px}
.promo-tab[aria-selected="true"]{color:var(--accent);background:var(--accent-soft);border-color:rgba(95,224,122,.35)}
.tab-panel[hidden],.promo-panel[hidden]{display:none}
.tab-panel,.promo-panel{min-width:0;animation:rise .28s ease both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ---------- notes, titles, hints ---------- */
.note{padding:14px 16px;border:1px solid rgba(95,224,122,.16);border-left:3px solid var(--accent);border-radius:12px;background:var(--accent-soft);color:var(--ink-2);font-size:13px;line-height:1.6}
.section-title{margin:26px 0 12px;font-size:17px;font-weight:700;letter-spacing:-.01em;color:var(--ink)}
.hint{font-size:12px;color:var(--muted);line-height:1.55}
#summary{margin:12px 0 0;padding:0;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;color:var(--ink-2);white-space:pre-wrap}
#summary:not(:empty){padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}
.empty-state{padding:34px 16px;border:1px dashed var(--line-2);border-radius:14px;text-align:center;color:var(--muted);font-size:13px;background:rgba(255,255,255,.015)}

/* ---------- stat tiles ---------- */
.stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 4px}
.stat-row[hidden]{display:none}
.stat{position:relative;overflow:hidden;padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(160deg,#fff,#f9fbf9)}
.stat::after{content:"";position:absolute;right:-30px;top:-30px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,rgba(95,224,122,.18),transparent 70%)}
.stat strong{display:block;font-size:28px;font-weight:750;letter-spacing:-.03em;color:var(--ink);line-height:1.1}
.stat span{display:block;margin-top:6px;color:var(--muted);font-size:12px;font-weight:600}
.stat.warn strong{color:var(--warn)}

/* ---------- forms ---------- */
.manager-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 16px;padding:22px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,#fff,#fbfcfb)}
.field-full{grid-column:1/-1}
.monthly-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;margin:22px 0 14px}
.monthly-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,370px),1fr));gap:16px}
.booking-requests-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0}
.booking-requests-toolbar .field-label{flex:1;min-width:220px}
.booking-requests-toolbar>button{min-height:42px;padding:10px 14px;border:1px solid var(--line-2);border-radius:10px;background:#fff;color:var(--ink-2);font-size:12px;font-weight:700}
.booking-requests-toolbar>button:disabled,.booking-request-actions button:disabled{cursor:wait;opacity:.6}
.booking-request-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr));gap:14px}
.booking-request-card{min-width:0;padding:18px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 12px 30px -24px rgba(32,54,38,.22)}
.booking-request-card h3{margin:0;color:var(--ink);font-size:16px}
.booking-request-meta{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.booking-request-card details{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.booking-request-card summary{cursor:pointer;color:var(--ink-2);font-size:12px;font-weight:700}
.booking-request-details{display:grid;grid-template-columns:minmax(100px,.6fr) minmax(0,1fr);gap:7px 12px;margin:12px 0 0;font-size:12px;line-height:1.5}
.booking-request-details dt{color:var(--muted)}
.booking-request-details dd{margin:0;color:var(--ink);font-weight:600;overflow-wrap:anywhere;white-space:pre-wrap}
.booking-request-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.booking-request-actions button{flex:1 1 145px;padding:10px 12px;border:1px solid var(--line-2);border-radius:9px;background:var(--accent-soft);color:var(--accent-2);font-size:12px;font-weight:750}
.booking-request-actions button.danger{border-color:rgba(180,71,64,.25);background:var(--danger-soft);color:var(--danger)}
.booking-request-actions button:disabled{opacity:.55}

/* ---------- entitlement cards ---------- */
.entitlement-card{min-width:0;padding:20px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 12px 30px -24px rgba(32,54,38,.24);transition:transform .2s,border-color .2s,box-shadow .2s}
.entitlement-card:hover{transform:translateY(-2px);border-color:var(--line-2);box-shadow:0 16px 34px -24px rgba(32,54,38,.28)}
.entitlement-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.bin-button{display:inline-grid;place-items:center;flex:0 0 auto;width:36px;height:36px;margin-left:auto;padding:0;border:1px solid #f0c8c8;border-radius:10px;background:#fff;color:var(--danger);cursor:pointer;transition:background .15s,border-color .15s}
.bin-button:hover{background:#fdeeee;border-color:#e59a9a}
.bin-button svg{width:17px;height:17px}
.top-end{display:flex;align-items:center;gap:8px;margin-left:auto}
.drawer-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px}
.drawer-tools .hint{margin:0}
.drawer-tools button{padding:7px 12px;font-size:12px}
.entitlement-name{margin:0;font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.25;color:var(--ink)}
.entitlement-meta{margin:7px 0 0;color:var(--muted);font-size:12.5px;line-height:1.6;overflow-wrap:anywhere}
.status-pill{display:inline-flex;flex:0 0 auto;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;background:var(--accent-soft);color:var(--accent);border:1px solid rgba(95,224,122,.28);font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.status-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.status-pill.fully-used,.status-pill.expired,.status-pill.archived,.status-pill.no-credits,.status-pill.deactivated{background:var(--danger-soft);color:var(--danger);border-color:rgba(255,143,134,.3)}
.status-pill.reserved,.status-pill.scheduled{background:var(--warn-soft);color:var(--warn);border-color:rgba(244,200,102,.3)}
.entitlement-code{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding:11px 12px 11px 14px;border:1px dashed rgba(77,139,94,.3);border-radius:12px;background:#f8faf8}
.entitlement-code code{min-width:0;overflow-wrap:anywhere;color:var(--accent);font:700 13.5px/1.3 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;letter-spacing:.05em}
.entitlement-code button{flex:0 0 auto;padding:7px 12px;border:1px solid var(--line-2);border-radius:8px;background:rgba(255,255,255,.06);color:var(--ink);font-size:11.5px;font-weight:700;transition:background .15s,border-color .15s}
.entitlement-code button:hover{background:var(--accent-soft);border-color:rgba(95,224,122,.45);color:var(--accent)}
.usage-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}
.usage-cell{padding:11px 8px;border:1px solid var(--line);border-radius:11px;background:#f5f8f5;text-align:center}
.usage-cell strong{display:block;font-size:20px;font-weight:750;color:var(--ink);letter-spacing:-.02em}
.usage-cell span{display:block;margin-top:4px;color:var(--muted);font-size:10px;line-height:1.35}
.entitlement-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:16px}
.entitlement-actions button{flex:1 1 auto;padding:9px 11px;border:1px solid var(--line-2);border-radius:9px;background:rgba(255,255,255,.04);color:var(--ink-2);font-size:11.5px;font-weight:700;transition:background .15s,border-color .15s,color .15s}
.entitlement-actions button:hover{background:var(--accent-soft);border-color:rgba(95,224,122,.4);color:var(--accent)}
.entitlement-actions button.danger{color:var(--danger);border-color:rgba(255,143,134,.25);background:var(--danger-soft)}
.entitlement-actions button.danger:hover{background:rgba(255,120,108,.22);border-color:rgba(255,143,134,.5);color:#ffb3ac}
.entitlement-history{margin-top:14px;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:12px}
.entitlement-history summary,.distribution-history summary{cursor:pointer;font-weight:700;color:var(--ink-2);list-style:none;display:flex;align-items:center;gap:8px}
.entitlement-history summary::-webkit-details-marker,.distribution-history summary::-webkit-details-marker{display:none}
.entitlement-history summary::before,.distribution-history summary::before{content:"";width:7px;height:7px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);transition:transform .15s}
.entitlement-history[open] summary::before,.distribution-history details[open]>summary::before{transform:rotate(45deg)}
.history-list{display:grid;gap:7px;margin:12px 0 0;padding:0;list-style:none}
.history-list li{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#f8faf8;line-height:1.55;overflow-wrap:anywhere}
.history-list li button{margin:0 6px;padding:4px 8px;border:1px solid var(--line-2);border-radius:7px;background:#fff;color:var(--ink-2);font-size:10px;font-weight:700;cursor:pointer}
.history-list li button:hover{border-color:rgba(77,139,94,.35);color:var(--accent-2)}
.history-list strong{color:var(--ink)}

/* ---------- distribution + purchases ---------- */
.distribution-panel{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:20px 0 14px;padding:18px 20px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012))}
.distribution-panel h3{margin:0;color:var(--ink);font-size:15px;font-weight:700}
.distribution-panel p{margin:5px 0 0;color:var(--muted);font-size:12.5px;line-height:1.55}
.distribution-panel .field-label{max-width:340px}
#pendingMonthlyPurchases{width:100%;min-width:0;margin:12px 0 0}
#pendingMonthlyPurchases>article{align-items:center}
.distribution-history{display:grid;gap:9px;margin:12px 0 20px}
.distribution-history:empty{display:none}
.distribution-history article{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:13px;background:#f8faf8;color:var(--muted);font-size:12px;line-height:1.6}
.distribution-history article>div{min-width:0;flex:1}
.distribution-history strong{color:var(--ink)}
.distribution-history article>button{flex:0 0 auto;border:1px solid rgba(95,224,122,.35);border-radius:9px;background:var(--accent-soft);color:var(--accent);font-size:11.5px;font-weight:700;padding:8px 12px;transition:background .15s}
.distribution-history article>button:hover:not(:disabled){background:rgba(95,224,122,.22)}
.distribution-history article>button:disabled{border-color:var(--line);background:rgba(255,255,255,.03);color:var(--muted)}
.distribution-history table{width:100%;border-collapse:collapse;font-size:11.5px}
.distribution-history th{padding:8px 10px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--line-2);white-space:nowrap}
.distribution-history td{padding:9px 10px;border-bottom:1px solid var(--line);color:var(--ink-2);vertical-align:top}
.distribution-history td code{color:var(--accent);font:700 11.5px ui-monospace,SFMono-Regular,Consolas,Menlo,monospace}

/* ---------- dialog ---------- */
.manager-dialog{width:min(580px,calc(100vw - 24px));max-height:86vh;padding:0;border:1px solid var(--line-2);border-radius:20px;background:linear-gradient(180deg,#fff,#f8faf8);color:var(--ink);box-shadow:0 28px 80px -34px rgba(24,41,29,.28)}
.manager-dialog[open]{animation:rise .22s ease both}
.manager-dialog::backdrop{background:rgba(24,39,28,.32);backdrop-filter:blur(5px)}
.manager-dialog-inner{padding:26px}
.manager-dialog h2{margin:0;font-size:20px;letter-spacing:-.02em;color:var(--ink)}
.manager-dialog p{color:var(--muted);font-size:13.5px;line-height:1.6}
.manager-dialog ul{max-height:240px;overflow:auto;margin:12px 0 0;padding:12px 12px 12px 30px;border:1px solid var(--line);border-radius:12px;background:#f8faf8;color:var(--ink-2);font-size:12.5px;line-height:1.8}
.dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}

/* ---------- calendar frame ---------- */
.calendar-frame{display:block;width:100%;height:min(1050px,calc(100vh - 190px));min-height:680px;border:1px solid var(--line);border-radius:18px;background:#fff}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media(max-width:900px){.stat-row{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){body{padding:12px 8px 40px}.shell{border-radius:18px}.head{padding:22px 20px}.content{padding:18px 16px 28px}.auth-row{align-items:stretch;flex-direction:column}.auth-row button{width:100%}.tabs{display:flex;width:100%}.tab{flex:1;padding:11px 8px;font-size:12.5px}.calendar-frame{height:calc(100vh - 230px);min-height:600px}.manager-form{grid-template-columns:1fr;padding:16px}.field-full{grid-column:auto}.monthly-toolbar{grid-template-columns:1fr}.manager-form-actions button{flex:1}.entitlement-card{padding:16px}.distribution-panel{align-items:stretch;flex-direction:column}.distribution-panel>button{width:100%}.distribution-history article{align-items:flex-start;flex-direction:column}.distribution-history article>button{width:100%}.dialog-actions{flex-direction:column-reverse}.dialog-actions button{width:100%}.usage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:420px){.calendar-frame{min-height:520px}.content{padding:16px 12px 24px}.entitlement-top{display:block}.status-pill{margin-top:10px}.promo-tab{flex:1;padding:9px 6px;font-size:11.5px}.entitlement-actions button{flex-basis:40%}.stat strong{font-size:23px}}

.calendar-frame{display:block;width:100%;height:min(1050px,calc(100vh - 190px));min-height:680px;border:1px solid var(--line);border-radius:18px;background:#fff}
.manager-navbar{display:flex;flex-wrap:wrap;width:100%;align-items:center}
.manager-navbar .tab{flex:1 1 auto;padding:10px 12px}
.manager-navbar .tab.active{color:var(--ink);background:linear-gradient(180deg,#fff,#f5f8f5);border-color:var(--line-2);box-shadow:inset 0 -2px 0 var(--accent)}
.manager-navbar .tab[aria-current="page"]{color:var(--ink)}
.account-collapse .entitlement-actions{margin-top:12px}
.account-collapse .entitlement-history{margin-top:12px}
.archive-label{display:inline-flex;margin-top:8px;padding:4px 8px;border-radius:999px;background:var(--danger-soft);color:var(--danger);font-size:10px;font-weight:800;text-transform:uppercase}
@media(max-width:700px){
  body{padding:8px 6px 24px}
  .shell{border-radius:16px}
  .head{padding:16px 14px}
  .head-top{align-items:flex-start}
  .manager-tools{margin-left:auto}
  .manager-brand{gap:10px}
  .manager-brand img{width:48px;height:48px;flex-basis:48px;border-radius:12px}
  .manager-brand h1{font-size:25px}
  .manager-brand p{font-size:11px}
  .head .sub{font-size:12px}
  .content{padding:15px 11px 22px}
  .menu-button{display:inline-flex;font-size:0;width:42px;padding:9px}
  .menu-button svg{width:19px;height:19px}
  .manager-navbar{position:fixed;z-index:805;inset:0 auto 0 0;width:min(330px,88vw);height:100dvh;margin:0;padding:72px 14px 18px;border:0;border-radius:0 20px 20px 0;background:#fff;box-shadow:24px 0 70px -38px rgba(18,34,24,.4);display:flex;flex-direction:column;align-items:stretch;flex-wrap:nowrap;overflow:auto;transform:translateX(-105%);transition:transform .24s}
  .manager-navbar.open{transform:translateX(0)}
  .manager-navbar .tab{flex:0 0 auto;justify-content:flex-start;min-height:46px;padding:12px 14px;text-align:left}
  .manager-drawer-backdrop{z-index:800}
  .entitlement-card{padding:13px;border-radius:14px}
  .entitlement-top{display:flex;align-items:flex-start;gap:8px}
  .entitlement-name{font-size:15px}
  .entitlement-meta{font-size:11.5px;line-height:1.5}
  .status-pill{font-size:9px;padding:5px 8px}
  .entitlement-code{margin-top:11px;padding:9px}
  .usage-grid{gap:6px;margin-top:10px}
  .usage-cell{padding:8px 5px}
  .usage-cell strong{font-size:17px}
  .usage-cell span{font-size:9px}
  .entitlement-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:11px}
  .entitlement-actions button{min-width:0;padding:9px 7px;font-size:10.5px;line-height:1.25}
  .booking-request-grid,.monthly-grid{grid-template-columns:minmax(0,1fr);gap:10px}
  .booking-request-card{padding:13px}
  .booking-request-actions{display:grid;grid-template-columns:1fr}
  .booking-request-actions button{min-height:42px}
  .manager-dialog{max-height:90dvh;border-radius:16px}
  .manager-dialog-inner{padding:20px}
  .dialog-actions{flex-direction:column-reverse}
  .dialog-actions button{width:100%;min-height:43px}
  .payment-form{gap:12px}
  .calendar-frame{height:calc(100dvh - 185px);min-height:460px}
}
@media(max-width:420px){
  .conn{padding:5px 8px;font-size:9px}
  .manager-brand h1{font-size:21px}
  .manager-brand p{max-width:185px}
  .icon-button,.menu-button{min-width:38px;min-height:38px}
  .manager-tools{gap:5px}
  .entitlement-top{display:flex}
  .entitlement-actions{grid-template-columns:1fr 1fr}
  .usage-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .toolbar-inline{align-items:stretch}
}
</style>
</head>
<body>
<main class="shell auth-locked" id="managerShell">
<header class="head">
  <div class="head-top"><p class="eyebrow"><span class="pulse"></span>A10tion To Detail · Operations</p><div class="manager-tools"><span id="connState" class="conn" data-state="off" role="status">Not connected</span><button id="notificationButton" class="icon-button" type="button" aria-label="Open notifications" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span id="notificationCount" class="notification-count" hidden>0</span></button><button id="menuButton" class="menu-button" type="button" aria-expanded="false" aria-controls="managerTabs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span></button></div></div>
  <div class="manager-topbar"><div class="manager-brand"><img src="${managerLogoUrl}" alt="A10tion To Detail logo"><div><h1>Welcome A10tion</h1><p>Your bookings and customer accounts, at a glance.</p></div></div></div>
  <p class="sub">Start with new booking requests, then manage monthly clients, activity, and availability from one place.</p>
  <div class="manager-drawer-backdrop" id="managerDrawerBackdrop"></div>
  <nav id="managerTabs" class="tabs manager-navbar" role="navigation" aria-label="Business manager menu">
    <button id="bookingRequestsTab" class="tab active" data-tab="requests" type="button" aria-current="page">New requests</button>
    <button id="clientsTab" class="tab" data-tab="clients" type="button">Monthly clients</button>
    <button id="archivedTab" class="tab" data-tab="archived" type="button">Archived</button>
    <button id="expiredTab" class="tab" data-tab="expired" type="button">Expired requests</button>
    <button id="activityTab" class="tab" data-tab="activity" type="button">Activity</button>
    <button id="promoTab" class="tab" data-tab="promo" type="button">Promo codes</button>
    <button id="calendarTab" class="tab" data-tab="calendar" type="button">Calendar</button>
  </nav>
</header>
<section class="content">
<p id="status" role="status" aria-live="polite"></p>
<section id="promoPanel" class="tab-panel" role="tabpanel" aria-labelledby="promoTab" hidden>
<section id="singleWashPanel" class="promo-panel" role="tabpanel" aria-labelledby="promoTab">
<p class="note">Paste up to 50 rows from your spreadsheet. Use tab-separated columns: number, password, promo code (or just password, promo code). Saving replaces the active batch. Redeemed promo codes stay permanently blocked, even after rotating batches.</p>
<div class="buttons"><button id="load" class="secondary" type="button">Load current batch</button></div>
<label for="pairs">Password and promo-code rows</label>
<textarea id="pairs" spellcheck="false" placeholder="01&#9;A10x!7Qp&#9;Detail10&#10;02&#9;ATD#42Lm&#9;Shine10"></textarea>
<p class="hint">Passwords are exact and case-sensitive. Duplicate promo codes are allowed, but that promo code can only be redeemed once across the batch.</p>
<div class="buttons"><button id="save" type="button">Save active batch</button></div>
<pre id="summary"></pre>
</section>
<section id="monthlyWashPanel" class="promo-panel" role="tabpanel" aria-labelledby="clientsTab" hidden>
  <p class="note">A confirmed first package payment automatically creates and emails a random access code. Standard permits up to 2 bookings per billing period and Premium up to 4. Unused prepaid washes roll over, but the per-period booking cap remains. Each recorded payment creates a fresh access code, and emails the customer.</p>
  <div id="monthlyStats" class="stat-row" hidden></div>
  <h2 id="monthlyFormTitle" class="section-title">Create monthly entitlement</h2>
  <form id="monthlyForm" class="manager-form">
    <input id="monthlyId" type="hidden">
    <label class="field-label">First name<input class="manager-input" name="firstName" maxlength="60" autocomplete="given-name" required></label>
    <label class="field-label">Surname<input class="manager-input" name="surname" maxlength="60" autocomplete="family-name" required></label>
    <label class="field-label">Customer email<input class="manager-input" name="email" type="email" autocomplete="email" required></label>
    <label class="field-label">Cell number<input class="manager-input" name="customerPhone" type="tel" autocomplete="tel" required></label>
    <label class="field-label">Package type<select class="manager-select" name="clientType" required><option value="private">Private Client</option><option value="business">Business / Fleet / Family</option></select></label>
    <label class="field-label">Package level<select class="manager-select" name="packageTier" required><option value="standard">Standard · 2 washes per billing period</option><option value="premium">Premium · 4 washes per billing period</option></select></label>
    <label class="field-label">Vehicle category<select class="manager-select" name="vehicleType" required><option value="">Choose vehicle…</option><option>Sedan / Hatchback</option><option>SUV / Bakkie</option><option>Minibus / Van</option></select></label>
    <label class="field-label">Active from<input class="manager-input" name="validFrom" type="date" required></label>
    <label class="field-label">Active until <span class="optional">(optional)</span><input class="manager-input" name="validUntil" type="date"></label>
    <div class="field-full manager-form-actions">
      <button id="monthlySubmit" type="submit">Save client</button>
      <button id="monthlyCancel" class="secondary" type="button">Cancel</button>
      <button id="monthlyReload" class="secondary" type="button">Refresh dashboard</button>
    </div>
    <p id="monthlyFormNotice" class="inline-notice field-full" role="status" aria-live="polite" hidden></p>
  </form>
  <section class="distribution-panel" style="display:block" aria-label="Paid monthly purchases requiring review">
    <div><h3>Paid purchases needing review</h3><p>Purchases for an existing customer appear here so you can apply the payment to the correct entitlement.</p></div>
    <div id="pendingMonthlyPurchases" class="distribution-history" aria-live="polite"></div>
  </section>
  <section class="distribution-panel" aria-label="Monthly access code email distribution">
    <div><h3>Email monthly access codes</h3><p>Preview active clients before sending. Delivery status updates when Resend confirms it.</p></div>
    <button id="bulkEmail" type="button">Preview bulk email</button>
  </section>
  <p id="bulkEmailNotice" class="inline-notice" role="status" aria-live="polite" hidden></p>
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
  <dialog id="paymentDialog" class="manager-dialog">
    <form id="paymentForm" class="manager-dialog-inner has-close payment-form">
      <button id="paymentClose" class="dialog-close" type="button" aria-label="Close payment form">×</button>
      <h2>Record payment</h2>
      <p>Save the payment and email the customer a newly generated access code.</p>
      <label class="field-label">Amount paid (R)<input id="paymentAmount" class="manager-input" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
      <label class="field-label">Payment date<input id="paymentDate" class="manager-input" type="date" required></label>
      <label class="field-label">Payment reference <span class="optional">(optional)</span><input id="paymentReference" class="manager-input" maxlength="120" placeholder="Receipt, bank or card reference"></label>
      <div class="dialog-actions">
        <button id="paymentCancel" class="secondary" type="button">Close</button>
        <button id="paymentSubmit" type="submit">Record payment</button>
      </div>
    </form>
  </dialog>
</section>
</section>
<section id="bookingRequestsPanel" class="tab-panel" role="tabpanel" aria-labelledby="bookingRequestsTab">
  <p class="note">Review website booking requests before payment or final confirmation. Pending requests hold their selected time for 3 days; monthly wash credits are not reserved until the approved customer completes the booking.</p>
  <div class="booking-requests-toolbar">
    <button id="bookingRequestsReload" class="secondary" type="button">Refresh requests</button>
    <span id="bookingRequestsCount" class="hint" aria-live="polite"></span>
  </div>
  <div id="bookingRequestCards" class="booking-request-grid" aria-live="polite"></div>
  <div id="bookingRequestsEmpty" class="empty-state" hidden>No booking requests are available.</div>
  <dialog id="declineConfirmDialog" class="manager-dialog">
    <div class="manager-dialog-inner">
      <h2>Decline booking request?</h2>
      <p>Are you sure you want to decline this booking request?</p>
      <div class="dialog-actions">
        <button id="declineNo" class="secondary" type="button">No, Go Back</button>
        <button id="declineYes" type="button">Yes, Continue</button>
      </div>
    </div>
  </dialog>
  <dialog id="declineReasonDialog" class="manager-dialog">
    <div class="manager-dialog-inner">
      <h2>Reason for declining</h2>
      <p>The customer will receive this explanation by email.</p>
      <label class="field-label" for="declineReason">Decline reason</label>
      <textarea id="declineReason" maxlength="1000" minlength="3" placeholder="Enter the reason for declining this request." style="min-height:130px;white-space:pre-wrap"></textarea>
      <div class="dialog-actions">
        <button id="declineReasonCancel" class="secondary" type="button">Cancel</button>
        <button id="declineSubmit" type="button">Decline Booking</button>
      </div>
    </div>
  </dialog>
</section>
<section id="archivedPanel" class="tab-panel" hidden>
  <div class="toolbar-inline"><div><h2 class="section-title" style="margin-top:0">Archived monthly clients</h2><p class="hint">Archived records are retained for history and cannot use access codes.</p></div><input id="archiveSearch" class="manager-search" type="search" placeholder="Search archived accounts" aria-label="Search archived clients"></div>
  <p id="archiveCount" class="hint" aria-live="polite"></p>
  <div id="archiveCards" class="monthly-grid"></div>
  <div id="archiveEmpty" class="empty-state" hidden>No archived clients match your search.</div>
</section>
<section id="expiredRequestsPanel" class="tab-panel" hidden>
  <h2 class="section-title" style="margin-top:0">Expired requests</h2>
  <p class="hint">Booking requests and continuation links that expired or were cancelled.</p>
  <div id="expiredRequestCards" class="booking-request-grid"></div>
  <div id="expiredRequestsEmpty" class="empty-state" hidden>No expired or cancelled requests.</div>
</section>
<section id="activityPanel" class="tab-panel" hidden>
  <h2 class="section-title" style="margin-top:0">Recent booking activity</h2>
  <p class="hint">Recently accepted and declined booking requests.</p>
  <div id="activityCards" class="booking-request-grid"></div>
  <h2 class="section-title">Code email activity</h2>
  <p class="hint">Recent monthly access-code email previews and sends.</p>
  <div id="distributionHistory" class="distribution-history" aria-live="polite"></div>
  <h2 class="section-title">Code email activity</h2>
  <p class="hint">Recent monthly access-code email previews and sends.</p>
  <div id="activityEmpty" class="empty-state" hidden>No recent accepted or declined requests.</div>
</section>
<section id="calendarPanel" class="tab-panel" role="tabpanel" aria-labelledby="calendarTab" hidden>
  <iframe id="calendarFrame" class="calendar-frame" title="Booking calendar manager" loading="lazy"></iframe>
</section>
</section>
</main>
<div id="authGate" class="auth-gate">
  <form id="authForm" class="auth-card">
    <img class="auth-logo" src="${managerLogoUrl}" alt="A10tion To Detail logo">
    <p class="auth-eyebrow">A10tion To Detail · Operations</p>
    <h2>Welcome A10tion</h2>
    <p>Sign in with your administrator name and API key to open your operations dashboard.</p>
    <label class="field-label" for="adminName">Administrator name</label>
    <input id="adminName" class="manager-input" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="40" placeholder="Your name" required>
    <label class="field-label" for="adminKey" style="margin-top:12px">API key (password)</label>
    <input id="adminKey" class="manager-input" type="password" autocomplete="current-password" placeholder="Enter API key" required>
    <button id="connect" type="submit">Sign in</button>
    <p id="authStatus" class="auth-status" role="alert" aria-live="polite"></p>
  </form>
</div>
<dialog id="confirmDialog" class="manager-dialog">
  <div class="manager-dialog-inner">
    <h2>Are you sure?</h2>
    <p id="confirmMessage"></p>
    <div class="dialog-actions">
      <button id="confirmNo" class="secondary" type="button">No</button>
      <button id="confirmYes" class="danger" type="button">Yes</button>
    </div>
  </div>
</dialog>
<aside id="notificationDrawer" class="notification-drawer" aria-label="Important notifications" aria-hidden="true">
  <div class="drawer-head"><h2>Important notifications</h2><button id="notificationClose" class="drawer-close" type="button" aria-label="Close notifications">×</button></div>
  <div class="drawer-tools"><p class="hint">Accounts that need attention appear here.</p><button id="notificationClearAll" class="secondary" type="button" hidden>Clear all</button></div>
  <div id="notificationList" class="notification-list"></div>
</aside>
<script>
const keyInput=document.getElementById('adminKey');
const adminNameInput=document.getElementById('adminName');
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
const calendarPanel=document.getElementById('calendarPanel');
const bookingRequestsPanel=document.getElementById('bookingRequestsPanel');
const archivedPanel=document.getElementById('archivedPanel');
const expiredRequestsPanel=document.getElementById('expiredRequestsPanel');
const activityPanel=document.getElementById('activityPanel');
const archiveCards=document.getElementById('archiveCards');
const managerTabsNode=document.getElementById('managerTabs');
const archiveSearch=document.getElementById('archiveSearch');
const archiveCount=document.getElementById('archiveCount');
const archiveEmpty=document.getElementById('archiveEmpty');
const expiredRequestCards=document.getElementById('expiredRequestCards');
const expiredRequestsEmpty=document.getElementById('expiredRequestsEmpty');
const activityCards=document.getElementById('activityCards');
const activityEmpty=document.getElementById('activityEmpty');
const managerTabs=[...document.querySelectorAll('#managerTabs .tab')];
const managerShell=document.getElementById('managerShell');
const authGate=document.getElementById('authGate');
const authForm=document.getElementById('authForm');
const authStatus=document.getElementById('authStatus');
const menuButton=document.getElementById('menuButton');
const managerDrawerBackdrop=document.getElementById('managerDrawerBackdrop');
const notificationButton=document.getElementById('notificationButton');
const notificationCount=document.getElementById('notificationCount');
const notificationDrawer=document.getElementById('notificationDrawer');
const notificationClose=document.getElementById('notificationClose');
const notificationList=document.getElementById('notificationList');
const paymentDialog=document.getElementById('paymentDialog');
const paymentForm=document.getElementById('paymentForm');
const paymentAmount=document.getElementById('paymentAmount');
const paymentDate=document.getElementById('paymentDate');
const paymentReference=document.getElementById('paymentReference');
const paymentSubmit=document.getElementById('paymentSubmit');
const bookingRequestCards=document.getElementById('bookingRequestCards');
const bookingRequestsEmpty=document.getElementById('bookingRequestsEmpty');
const bookingRequestsCount=document.getElementById('bookingRequestsCount');
const bookingRequestsReload=document.getElementById('bookingRequestsReload');
const declineConfirmDialog=document.getElementById('declineConfirmDialog');
const declineReasonDialog=document.getElementById('declineReasonDialog');
const declineReason=document.getElementById('declineReason');
const declineSubmit=document.getElementById('declineSubmit');
const singleWashPanel=document.getElementById('singleWashPanel');
const monthlyWashPanel=document.getElementById('monthlyWashPanel');
const monthlyForm=document.getElementById('monthlyForm');
const monthlyCards=document.getElementById('monthlyCards');
const pendingMonthlyPurchasesNode=document.getElementById('pendingMonthlyPurchases');
const monthlySearch=document.getElementById('monthlySearch');
const monthlyCount=document.getElementById('monthlyCount');
const monthlyStatsNode=document.getElementById('monthlyStats');
const connStateNode=document.getElementById('connState');
const monthlyEmpty=document.getElementById('monthlyEmpty');
const monthlySubmit=document.getElementById('monthlySubmit');
const monthlyFormNotice=document.getElementById('monthlyFormNotice');
const bulkEmailNotice=document.getElementById('bulkEmailNotice');
const monthlyCancel=document.getElementById('monthlyCancel');
const bulkEmailButton=document.getElementById('bulkEmail');
const distributionHistory=document.getElementById('distributionHistory');
const bulkConfirmDialog=document.getElementById('bulkConfirmDialog');
const bulkPreviewSummary=document.getElementById('bulkPreviewSummary');
const bulkPreviewClients=document.getElementById('bulkPreviewClients');
const bulkConfirmButton=document.getElementById('bulkConfirm');
const bulkCancelButton=document.getElementById('bulkCancel');
let monthlyEntitlements=[];
let monthlyDistributionRuns=[];
let pendingMonthlyPurchases=[];
let pendingBulkRunId='';
let bookingRequests=[];
let selectedDeclineRequestId='';
let selectedPaymentEntitlementId='';
const managerStorageKey='a10tion-admin-manager-key';
const binIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const confirmDialog=document.getElementById('confirmDialog');
const confirmMessage=document.getElementById('confirmMessage');
const notificationClearAll=document.getElementById('notificationClearAll');
function askYesNo(message){
  return new Promise(resolve=>{
    confirmMessage.textContent=message;
    const finish=answer=>{
      confirmYesButton.removeEventListener('click',onYes);
      confirmNoButton.removeEventListener('click',onNo);
      confirmDialog.removeEventListener('cancel',onNo);
      if(confirmDialog.open)confirmDialog.close();
      resolve(answer);
    };
    const onYes=()=>finish(true);
    const onNo=()=>finish(false);
    const confirmYesButton=document.getElementById('confirmYes');
    const confirmNoButton=document.getElementById('confirmNo');
    confirmYesButton.addEventListener('click',onYes);
    confirmNoButton.addEventListener('click',onNo);
    confirmDialog.addEventListener('cancel',onNo);
    confirmDialog.showModal();
  });
}
const dismissedStorageKey='a10tion-dismissed-notifications';
function readDismissedNotifications(){try{return JSON.parse(localStorage.getItem(dismissedStorageKey)||'[]');}catch{return [];}}
let currentNotificationKeys=[];
function showNotice(node,message,type=''){node.textContent=message;node.className='inline-notice'+(type?' '+type:'');node.hidden=!message;}
function setStatus(message,type=''){statusNode.textContent=message;statusNode.className=type;}
function setConn(isOn){connStateNode.dataset.state=isOn?'on':'off';connStateNode.textContent=isOn?'Connected':'Not connected';}
function isArchivedRecord(record){return Boolean(record.archived)||record.active===false;}
function renderMonthlyStats(){
  const liveClients=monthlyEntitlements.filter(record=>!isArchivedRecord(record));
  const activeCount=liveClients.filter(record=>record.status==='Active').length;
  const review=pendingMonthlyPurchases.length;
  const tiles=[
    [liveClients.length,'Monthly clients',''],
    [activeCount,'Active right now',''],
    [review,'Payments to review',review?' warn':'']
  ];
  monthlyStatsNode.innerHTML=tiles.map(tile=>'<div class="stat'+tile[2]+'"><strong>'+escapeHtml(tile[0])+'</strong><span>'+escapeHtml(tile[1])+'</span></div>').join('');
  monthlyStatsNode.hidden=false;
}
function activateTab(tab){
  bookingRequestsPanel.hidden=tab!=='requests';
  promoPanel.hidden=tab!=='clients'&&tab!=='promo';
  archivedPanel.hidden=tab!=='archived';
  expiredRequestsPanel.hidden=tab!=='expired';
  activityPanel.hidden=tab!=='activity';
  calendarPanel.hidden=tab!=='calendar';
  managerTabs.forEach(button=>{
    const active=button.dataset.tab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
  if(tab==='clients') activatePromoTab('monthly');
  if(tab==='promo') activatePromoTab('single');
  closeManagerMenu();
  if(['requests','expired','activity'].includes(tab)) loadBookingRequests();
  if(tab==='archived') loadMonthlyEntitlements();
  if(tab==='calendar'&&!calendarFrame.src) connectManagers();
}
function activatePromoTab(tab){
  const isMonthly=tab==='monthly';
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
async function bookingRequestsApi(body){
  const response=await fetch('/api/admin/booking-requests',{method:body?'POST':'GET',headers:{'Accept':'application/json','Content-Type':'application/json','x-admin-key':keyInput.value.trim()},body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.message||'Booking request action failed.');
  return result;
}
function requestDisplayValue(value){
  if(value===null||value===undefined||value==='') return '—';
  return typeof value==='object'?JSON.stringify(value):String(value);
}
function renderBookingRequestCard(record,showActions=false){
    const customer=record.booking?.customer||{};
    const identity=(String(customer.firstName||'')+' '+String(customer.surname||'')).trim()||'Customer';
    const detailRows=[];
    detailRows.push(['Booking reference',record.reference],['Request kind',record.kind],['Submitted',record.submittedAt],['Current status',record.publicStatus]);
    Object.entries(record.booking||{}).forEach(([key,value])=>{
      if(key==='contractFileBase64'||key==='customer') return;
      detailRows.push([key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase()),value]);
    });
    Object.entries(customer).forEach(([key,value])=>{
      detailRows.push(['Customer '+key.replace(/([A-Z])/g,' $1'),value]);
    });
    if(record.approvedBy) detailRows.push(['Approved by',record.approvedBy],['Approved at',record.approvedAt]);
    if(record.declinedBy) detailRows.push(['Declined by',record.declinedBy],['Declined at',record.declinedAt],['Decline reason',record.declineReason]);
    const details=detailRows.map(([label,value])=>'<dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(requestDisplayValue(value))+'</dd>').join('');
    const actions=showActions&&record.status==='pending_approval'
      ?'<div class="booking-request-actions"><button type="button" data-request-action="accept" data-id="'+escapeHtml(record.id)+'">Accept Booking</button><button type="button" class="danger" data-request-action="decline" data-id="'+escapeHtml(record.id)+'">Decline Booking</button></div>'
      :showActions&&['approved','awaiting_completion','declined'].includes(record.status)
        ?'<div class="booking-request-actions"><button type="button" data-request-action="resend-email" data-id="'+escapeHtml(record.id)+'">Resend customer decision email</button></div>'
        :'';
    const occurredAt=record.approvedAt||record.declinedAt||record.updatedAt||record.submittedAt;
    return '<article class="booking-request-card" data-id="'+escapeHtml(record.id)+'"><div class="entitlement-top"><div><h3>'+escapeHtml(identity)+'</h3><p class="booking-request-meta">'+escapeHtml(customer.email||'')+' · '+escapeHtml(record.reference)+'</p></div><span class="top-end"><span class="status-pill">'+escapeHtml(record.publicStatus||record.status)+'</span>'+(showActions?'':'<button type="button" class="bin-button" data-request-action="delete" data-id="'+escapeHtml(record.id)+'" aria-label="Delete permanently" title="Delete permanently">'+binIcon+'</button>')+'</span></div>'+(showActions?'':'<p class="booking-request-meta">Activity · '+escapeHtml(occurredAt||'')+'</p>')+'<details><summary>Open full request details</summary><dl class="booking-request-details">'+details+'</dl></details>'+actions+'</article>';
}
function renderBookingRequests(){
  const pending=bookingRequests.filter(record=>record.status==='pending_approval');
  bookingRequestsCount.textContent=pending.length+' pending request'+(pending.length===1?'':'s');
  bookingRequestsEmpty.hidden=pending.length>0;
  bookingRequestCards.innerHTML=pending.map(record=>renderBookingRequestCard(record,true)).join('');
}
function renderExpiredRequests(){
  const expired=bookingRequests.filter(record=>['expired','cancelled'].includes(record.status));
  expiredRequestCards.innerHTML=expired.map(record=>renderBookingRequestCard(record)).join('');
  expiredRequestsEmpty.hidden=expired.length>0;
}
function renderBookingActivity(){
  const activity=bookingRequests.filter(record=>['approved','awaiting_completion','confirmed','declined'].includes(record.status))
    .sort((left,right)=>new Date(right.approvedAt||right.declinedAt||right.updatedAt||0)-new Date(left.approvedAt||left.declinedAt||left.updatedAt||0))
    .slice(0,100);
  activityCards.innerHTML=activity.map(record=>renderBookingRequestCard(record)).join('');
  activityEmpty.hidden=activity.length>0;
}
function renderNotifications(){
  const exhausted=monthlyEntitlements.filter(record=>!isArchivedRecord(record)&&record.active&&Number(record.creditsAvailable)<1);
  const expired=bookingRequests.filter(record=>['expired','cancelled'].includes(record.status));
  const pending=bookingRequests.filter(record=>record.status==='pending_approval');
  const entries=[
    ...exhausted.map(record=>({key:'credits:'+record.id,html:'<article class="notification-item"><strong>Wash credits exhausted</strong><span>'+escapeHtml(record.customerName)+' · '+escapeHtml(record.email)+' has no prepaid washes remaining.</span><button type="button" data-open-tab="clients">Open monthly clients</button></article>'})),
    ...(expired.length?[{key:'expired:'+expired.map(record=>record.id).sort().join(','),html:'<article class="notification-item"><strong>'+expired.length+' expired or cancelled request'+(expired.length===1?'':'s')+'</strong><span>Review requests that can no longer be completed.</span><button type="button" data-open-tab="expired">Review expired requests</button></article>'}]:[]),
    ...(pending.length?[{key:'pending:'+pending.map(record=>record.id).sort().join(','),html:'<article class="notification-item"><strong>'+pending.length+' request'+(pending.length===1?'':'s')+' awaiting review</strong><span>New bookings are waiting for an accept or decline decision.</span><button type="button" data-open-tab="requests">Open new requests</button></article>'}]:[]),
  ];
  const dismissed=readDismissedNotifications();
  const visible=entries.filter(entry=>!dismissed.includes(entry.key));
  currentNotificationKeys=entries.map(entry=>entry.key);
  const count=visible.length;
  notificationCount.textContent=count>99?'99+':String(count);
  notificationCount.hidden=count===0;
  notificationClearAll.hidden=count===0;
  notificationList.innerHTML=visible.map(entry=>entry.html).join('')||'<div class="notification-empty">You’re all caught up. No important notifications.</div>';
}function renderBookingDashboards(){
  renderBookingRequests();
  renderExpiredRequests();
  renderBookingActivity();
  renderNotifications();
}
async function loadBookingRequests(){
  bookingRequestsReload.disabled=true;
  bookingRequestCards.setAttribute('aria-busy','true');
  try{
    const result=await bookingRequestsApi();
    bookingRequests=Array.isArray(result.requests)?result.requests:[];
    renderBookingDashboards();
    if(['requests','expired','activity'].some(tab=>managerTabs.find(button=>button.dataset.tab===tab)?.classList.contains('active')))setStatus('Booking requests refreshed.','ok');
  }catch(error){
    bookingRequests=[];
    bookingRequestCards.innerHTML='';
    expiredRequestCards.innerHTML='';
    activityCards.innerHTML='';
    renderNotifications();
    bookingRequestsEmpty.hidden=false;
    bookingRequestsEmpty.textContent=error.message;
    expiredRequestsEmpty.hidden=false;
    activityEmpty.hidden=false;
    setStatus(error.message,'error');
  }finally{
    bookingRequestCards.removeAttribute('aria-busy');
    bookingRequestsReload.disabled=false;
  }
}
async function processBookingRequest(action,id,reason=''){
  const buttons=[...bookingRequestCards.querySelectorAll('button[data-id="'+CSS.escape(id)+'"]')];
  buttons.forEach(button=>button.disabled=true);
  try{
    const result=await bookingRequestsApi({action,id,reason,adminName:bookingRequestAdminName()});
    await loadBookingRequests();
    if(!result.emailSent){
      setStatus('Request updated, but the customer email was NOT sent: '+(result.emailProblem||'delivery was not confirmed')+' Use the resend option once this is fixed.','error');
    }else{
      setStatus(action==='accept'?'Booking approved and approval email sent.':action==='decline'?'Booking declined and customer email sent.':'Customer email sent.','ok');
    }
  }catch(error){
    await loadBookingRequests();
    setStatus(error.message,'error');
  }
}
let loggedInAdmin='';
function managerAdminName(){return loggedInAdmin||'Business Manager admin';}
function bookingRequestAdminName(){
  return managerAdminName();
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
function localToday(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(({type,value})=>[type,value]));
  return values.year+'-'+values.month+'-'+values.day;
}
function packageLabel(record){
  const group=record.clientType==='business'?'Business / Fleet / Family':'Private Client';
  const tier=record.packageTier==='premium'?'Premium':'Standard';
  return group+' · '+tier+' Package';
}
function normalizeSearch(value){
  return String(value||'').toLocaleLowerCase('en-ZA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function matchesEntitlement(record,query){
  if(!query)return true;
  const fields=[
    record.customerName,record.firstName,record.surname,record.email,record.customerPhone,
    String(record.customerPhone||'').replace(/\D/g,''),record.businessName,record.clientType,
    record.packageTier,record.status,record.id,record.code,
    ...(record.codes||[]).map(entry=>entry.code),
    ...(record.codeHistory||[]).map(entry=>entry.code),
    ...(record.paymentHistory||[]).flatMap(entry=>[entry.reference,entry.gatewayReference]),
  ].filter(Boolean).map(normalizeSearch);
  const tokens=normalizeSearch(query).split(/\s+/).filter(Boolean);
  return tokens.every(token=>fields.some(field=>field.includes(token)));
}
function renderEntitlementCard(record){
  const slug=String(record.status||'').toLowerCase().replace(/\\s+/g,'-');
  const codeHistory=(record.codeHistory||[]).map(entry=>{
    const oldCode=String(entry.code||'');
    const masked=oldCode.includes('****')?oldCode:(oldCode.length>4?oldCode.slice(0,5)+'****'+oldCode.slice(-4):'****');
    return '<li>Previous code <strong>'+escapeHtml(masked)+'</strong> · revoked/replaced '+escapeHtml(new Date(entry.replacedAt).toLocaleDateString('en-ZA'))+'</li>';
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
  const paymentHistory=(record.paymentHistory||[]).map(entry=>'<li><strong>'+escapeHtml(entry.type==='initial'?'Initial package payment':'Payment')+'</strong> · '+escapeHtml(entry.paidAt?new Date(entry.paidAt).toLocaleDateString('en-ZA'):'')+' · '+escapeHtml(formatZar(entry.amountCents))+' · '+escapeHtml(entry.creditsAdded||record.monthlyAllowance)+' washes added · Ref '+escapeHtml(entry.reference||'')+(entry.packageName?' · '+escapeHtml(entry.packageName):'')+'</li>').join('');
  const additionalCodes=(record.codes||[])
    .filter(entry=>entry.code&&entry.code!==record.code)
    .map(entry=>'<li><code>'+escapeHtml(entry.code)+'</code><button type="button" data-action="copy" data-code="'+escapeHtml(entry.code)+'">Copy</button> · generated '+escapeHtml(new Date(entry.createdAt).toLocaleDateString('en-ZA'))+'</li>').join('');
  const dateRange='Active '+escapeHtml(record.validFrom||'')+(record.validUntil?' – '+escapeHtml(record.validUntil):' · no end date');
  const canIssueCode=record.active&&!isArchivedRecord(record);
  const actions=[
    canIssueCode?'<button type="button" data-action="generate-code">'+(record.code?'Generate another code':'Generate code')+'</button>':'',
    canIssueCode&&record.code?'<button type="button" data-action="email">Email latest code</button>':'',
    canIssueCode?'<button type="button" data-action="payment">Record payment</button>':'',
    '<button type="button" data-action="edit">Edit details</button>',
    '<button'+(isArchivedRecord(record)?'':' class="danger"')+' type="button" data-action="toggle">'+(isArchivedRecord(record)?'Restore & reactivate':'Deactivate account')+'</button>',

  ].filter(Boolean).join('');
  const codeBlock=record.code
    ?'<div class="entitlement-code"><code>'+escapeHtml(record.code)+'</code><button type="button" data-action="copy" data-code="'+escapeHtml(record.code)+'">Copy</button></div>'
    :'<p class="hint" role="status">'+(record.active?'No active code. Generate a new code to restore customer access.':'Access code revoked. Reactivate, then generate a fresh code if needed.')+'</p>';
  return '<article class="entitlement-card" data-id="'+escapeHtml(record.id)+'">'+
    '<div class="entitlement-top"><div><div class="entitlement-title"><h3 class="entitlement-name">'+escapeHtml(record.customerName)+'</h3><span class="status-pill '+slug+'">'+escapeHtml(isArchivedRecord(record)&&record.active===false?'Deactivated':record.status)+'</span></div><p class="entitlement-meta">'+escapeHtml(record.email)+' · '+escapeHtml(record.customerPhone||'No phone')+'<br>'+escapeHtml(packageLabel(record))+(record.vehicleType?' · '+escapeHtml(record.vehicleType):'')+'</p></div>'+(isArchivedRecord(record)?'<button type="button" class="bin-button" data-action="delete-permanent" aria-label="Delete account permanently" title="Delete account permanently">'+binIcon+'</button>':'')+'</div>'+
    ''+
    '<details class="account-collapse"><summary aria-label="Expand or collapse account"></summary><div class="account-collapse-body">'+
    '<p class="entitlement-meta">'+escapeHtml(record.businessName||'')+(record.businessName?'<br>':'')+escapeHtml(dateRange)+(record.contractOption?'<br>'+escapeHtml(record.contractOption)+' contract':'')+'</p>'+
    codeBlock+(additionalCodes?'<details class="entitlement-history"><summary>Other account codes ('+(record.codes.length-1)+')</summary><ul class="history-list">'+additionalCodes+'</ul></details>':'')+
    '<div class="usage-grid"><div class="usage-cell"><strong>'+record.monthlyAllowance+'</strong><span>Booking cap · '+escapeHtml(formatMonth(record.period))+'</span></div><div class="usage-cell"><strong>'+record.used+'</strong><span>Used this period'+(record.reserved?' · '+record.reserved+' pending':'')+'</span></div><div class="usage-cell"><strong>'+record.periodRemaining+'</strong>    <span>Booking slots left</span></div></div>'+
    '<p class="hint" style="margin:8px 0 0">Billing period: '+escapeHtml(record.period)+' to '+escapeHtml(record.periodEnd||'')+'</p>'+
    '<div class="entitlement-actions">'+actions+'</div>'+
    '<details class="entitlement-history"><summary>Booking, payment, access and audit history ('+((record.history||[]).length+(record.paymentHistory||[]).length+(record.codeHistory||[]).length+(record.distributionHistory||[]).length+(record.auditHistory||[]).length)+')</summary><ul class="history-list">'+(usageHistory||'<li>No confirmed monthly wash bookings yet.</li>')+paymentHistory+codeHistory+emailHistory+auditHistory+(record.deactivationReason?'<li>Current status reason: '+escapeHtml(record.deactivationReason)+'</li>':'')+'</ul></details>'+
    '</div></details></article>';
}
function renderMonthlyEntitlements(){
  const records=monthlyEntitlements.filter(record=>!isArchivedRecord(record)&&matchesEntitlement(record,monthlySearch.value));
  const activeClients=monthlyEntitlements.filter(record=>!isArchivedRecord(record));
  monthlyCount.textContent=records.length+' of '+activeClients.length+' clients';
  monthlyEmpty.hidden=records.length>0;
  monthlyCards.innerHTML=records.map(renderEntitlementCard).join('');
  renderArchivedEntitlements();
  renderMonthlyStats();
  renderPendingMonthlyPurchases();
  renderMonthlyDistributionRuns();
  renderNotifications();
}
function renderArchivedEntitlements(){
  const records=monthlyEntitlements.filter(record=>isArchivedRecord(record)&&matchesEntitlement(record,archiveSearch.value));
  archiveCount.textContent=records.length+' archived clients';
  archiveEmpty.hidden=records.length>0;
  archiveCards.innerHTML=records.map(renderEntitlementCard).join('');
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
    setConn(true);
    setStatus('Monthly entitlement dashboard refreshed.','ok');
  }catch(error){
    monthlyEntitlements=[];
    monthlyDistributionRuns=[];
    pendingMonthlyPurchases=[];
    monthlyCards.innerHTML='';
    archiveCards.innerHTML='';
    monthlyEmpty.hidden=false;
    monthlyEmpty.textContent=error.message;
    renderNotifications();
    setStatus(error.message,'error');
  }finally{monthlyCards.removeAttribute('aria-busy');}
}
function resetMonthlyForm(){
  monthlyForm.reset();
  document.getElementById('monthlyId').value='';
  const now=new Date();
  monthlyForm.elements.validFrom.value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  document.getElementById('monthlyFormTitle').textContent='Create monthly entitlement';
  monthlySubmit.textContent='Save client';
  monthlyCancel.hidden=false;
}
function editMonthlyEntitlement(record){
  document.getElementById('monthlyId').value=record.id;
  const [firstName='',...surnameParts]=String(record.customerName||'').trim().split(/\\s+/);
  monthlyForm.elements.firstName.value=record.firstName||firstName;
  monthlyForm.elements.surname.value=record.surname||surnameParts.join(' ');
  monthlyForm.elements.email.value=record.email;
  monthlyForm.elements.customerPhone.value=record.customerPhone||'';
  monthlyForm.elements.clientType.value=record.clientType;
  monthlyForm.elements.packageTier.value=record.packageTier;
  monthlyForm.elements.vehicleType.value=record.vehicleType||'';
  monthlyForm.elements.validFrom.value=record.validFrom;
  monthlyForm.elements.validUntil.value=record.validUntil||'';
  document.getElementById('monthlyFormTitle').textContent='Edit monthly entitlement';
  monthlySubmit.textContent='Save changes';
  monthlyForm.scrollIntoView({behavior:'smooth',block:'start'});
}
monthlyForm.addEventListener('submit',async event=>{
  event.preventDefault();
  monthlySubmit.disabled=true;
  setStatus('Saving monthly entitlement…');
  showNotice(monthlyFormNotice,'Saving…');
  const id=document.getElementById('monthlyId').value;
  const payload=Object.fromEntries(new FormData(monthlyForm).entries());
  try{
    const result=await monthlyRequest(id?'PUT':'POST',id?{...payload,id}:{...payload});
    resetMonthlyForm();
    await loadMonthlyEntitlements();
    const savedMessage=id?'Monthly client details saved.':'Monthly client saved and random access code generated. Copy it from the customer card to share it securely.';
    setStatus(savedMessage,'ok');
    showNotice(monthlyFormNotice,'✓ '+savedMessage,'ok');
  }catch(error){setStatus(error.message,'error');showNotice(monthlyFormNotice,error.message,'error');}
  finally{monthlySubmit.disabled=false;}
});
monthlyCancel.addEventListener('click',resetMonthlyForm);
document.getElementById('monthlyReload').addEventListener('click',loadMonthlyEntitlements);
monthlySearch.addEventListener('input',renderMonthlyEntitlements);
archiveSearch.addEventListener('input',renderArchivedEntitlements);
async function handleMonthlyCardAction(event){
  const button=event.target.closest('button[data-action]');
  if(!button||button.disabled)return;
  const card=button.closest('.entitlement-card');
  const record=monthlyEntitlements.find(item=>item.id===card?.dataset.id);
  if(!record)return;
  button.disabled=true;
  try{
    if(button.dataset.action==='copy'){
      await navigator.clipboard.writeText(button.dataset.code);
      setStatus('Monthly code copied.','ok');
      return;
    }
    if(button.dataset.action==='delete-permanent'){
      if(!await askYesNo('This will permanently delete '+record.customerName+' and all of their saved information from the system. This cannot be undone.'))return;
      await monthlyRequest('POST',{action:'delete-permanently',id:record.id});
      await loadMonthlyEntitlements();
      setStatus(record.customerName+' was permanently deleted.','ok');
      return;
    }
    if(button.dataset.action==='generate-code'){
      button.disabled=true;
      await monthlyRequest('POST',{action:'generate-code',id:record.id});
      await loadMonthlyEntitlements();
      setStatus('A new account code was generated. Previous active account codes remain linked to the same balance.','ok');
      return;
    }
    if(button.dataset.action==='email'){
      if(!window.confirm('Send a new monthly access-code email to '+record.customerName+' at '+record.email+'?'))return;
      button.disabled=true;
      const result=await monthlyRequest('POST',{action:'send-one',id:record.id,adminName:managerAdminName()});
      setStatus(result.run?.status==='completed'?'Email accepted by the provider; delivery confirmation is pending.':'Email status: '+(result.run?.status||'unknown'),'ok');
      await loadMonthlyEntitlements();
      return;
    }
    if(button.dataset.action==='payment'){
      selectedPaymentEntitlementId=record.id;
      paymentForm.reset();
      paymentDate.value=localToday();
      paymentDialog.showModal();
      paymentAmount.focus();
      return;
    }
    if(button.dataset.action==='edit'){editMonthlyEntitlement(record);return;}
    if(button.dataset.action==='toggle'){
      if(isArchivedRecord(record)){
        if(!window.confirm('Restore this archived account? Previously issued codes remain revoked; generate a new code after restoring if the customer needs access.'))return;
        await monthlyRequest('PUT',{id:record.id,active:true,archived:false,deactivationReason:'Restored and reactivated by '+managerAdminName()+'.'});
        setStatus('Client restored to Monthly clients. Old codes remain invalid; generate a new code to issue access.','ok');
      }else{
        if(!window.confirm("Are you sure? This will deactivate this user's account, revoke every code already issued to them and move them to the Archived tab."))return;
        await monthlyRequest('DELETE',{id:record.id,deactivationReason:'Deactivated by '+managerAdminName()+'.'});
        setStatus('Client deactivated, all issued codes were revoked and the account moved to the Archived tab.','ok');
      }
    }
    await loadMonthlyEntitlements();
  }catch(error){setStatus(error.message,'error');}
  finally{button.disabled=false;}
}
monthlyCards.addEventListener('click',handleMonthlyCardAction);
archiveCards.addEventListener('click',handleMonthlyCardAction);
function closePaymentDialog(){
  if(paymentDialog.open)paymentDialog.close();
  selectedPaymentEntitlementId='';
  paymentForm.reset();
}
document.getElementById('paymentClose').addEventListener('click',closePaymentDialog);
document.getElementById('paymentCancel').addEventListener('click',closePaymentDialog);
paymentDialog.addEventListener('close',()=>{selectedPaymentEntitlementId='';});
paymentForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const amountCents=Math.round(Number(paymentAmount.value)*100);
  if(!selectedPaymentEntitlementId||!paymentForm.reportValidity())return;
  if(!Number.isSafeInteger(amountCents)||amountCents<1){
    setStatus('Enter a valid payment amount greater than zero.','error');
    paymentAmount.focus();
    return;
  }
  paymentSubmit.disabled=true;
  try{
    const result=await monthlyRequest('POST',{
      action:'record-payment',
      id:selectedPaymentEntitlementId,
      amountCents,
      paymentDate:paymentDate.value,
      paymentReference:paymentReference.value.trim(),
    });
    paymentDialog.close();
    await loadMonthlyEntitlements();
    const emailFailed=Boolean(result.entitlement?.emailError);
    const emailPending=result.entitlement?.emailStatus==='accepted';
    setStatus(emailFailed
      ?'Payment recorded and new code generated, but code email failed: '+result.entitlement.emailError
      :emailPending
        ?'Payment recorded and new code generated. The email was accepted by the provider; delivery confirmation is pending.'
        :'Payment recorded and a new access code emailed to the customer.',
    emailFailed?'error':'ok');
  }catch(error){
    setStatus(error.message,'error');
  }finally{paymentSubmit.disabled=false;}
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
    const result=await monthlyRequest('POST',{action:'record-payment',id:record.id,paymentReference:purchase.reference,amountCents:purchase.amountCents,paymentDate:localToday()});
    await loadMonthlyEntitlements();
    setStatus(result.entitlement?.emailError?'Payment applied and a new code was generated, but email failed: '+result.entitlement.emailError:'Paid purchase applied and a new code was emailed.',result.entitlement?.emailError?'error':'ok');
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
    const preview=await monthlyRequest('POST',{action:'preview-bulk',adminName:managerAdminName()});
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
    const sentCount=(result.run?.results||[]).filter(entry=>entry.status!=='failed').length;
    const bulkOk=!['completed_with_failures','needs_review'].includes(result.run?.status);
    const bulkMessage=bulkOk?'✓ Bulk email sent successfully to '+(sentCount||result.run?.recipientCount||0)+' client'+((sentCount||result.run?.recipientCount||0)===1?'':'s')+'.':result.run?.status==='needs_review'?'A send has an uncertain provider status; review its history before sending again.':'Bulk email finished with some failures. Review the run in the Activity tab to retry failed messages.';
    showNotice(bulkEmailNotice,bulkMessage,bulkOk?'ok':'error');
    setStatus(result.run?.status==='completed_with_failures'?'Bulk email completed with failures. Review the run below to retry failed messages.':result.run?.status==='needs_review'?'A send has an uncertain provider status; review its history before sending again.':'Bulk email run completed. Provider acceptance is recorded; delivery status may follow by webhook.',result.run?.status==='completed_with_failures'||result.run?.status==='needs_review'?'error':'ok');
    await loadMonthlyEntitlements();
  }catch(error){setStatus(error.message,'error');showNotice(bulkEmailNotice,error.message,'error');}
  finally{bulkConfirmButton.disabled=false;}
});
function connectManagers(){
  const key=keyInput.value.trim();
  if(!key){authStatus.textContent='Enter an admin or calendar API key to connect.';keyInput.focus();return false;}
  sessionStorage.setItem('a10tion-calendar-key',key);
  calendarFrame.src='/api/admin/calendar?embedded=1&v='+Date.now();
  return true;
}
function closeManagerMenu(){
  managerTabsNode.classList.remove('open');
  managerDrawerBackdrop.classList.remove('open');
  menuButton.setAttribute('aria-expanded','false');
}
function closeNotifications(){
  notificationDrawer.classList.remove('open');
  notificationDrawer.setAttribute('aria-hidden','true');
  notificationButton.setAttribute('aria-expanded','false');
  managerDrawerBackdrop.classList.remove('open');
}
const allowedAdmins=['sage','chad','tamaron','jared'];
async function authenticateManager(){
  const key=keyInput.value.trim();
  const typedName=adminNameInput.value.trim();
  if(!typedName){authStatus.textContent='Enter your administrator name.';adminNameInput.focus();return false;}
  const matchedAdmin=allowedAdmins.find(name=>name===typedName.toLowerCase());
  if(!matchedAdmin){authStatus.textContent='User "'+typedName+'" does not exist on the database.';adminNameInput.focus();return false;}
  if(!key){authStatus.textContent='Enter your Business Manager API key.';keyInput.focus();return false;}
  connectButton.disabled=true;
  authStatus.textContent='Securing your workspace…';
  try{
    if(!connectManagers()) return;
    const valid=await loadBatch();
    if(!valid){
      authStatus.textContent=statusNode.textContent||'That API key could not connect.';
      try{localStorage.removeItem(managerStorageKey);}catch(error){console.warn('Could not clear the rejected Business Manager key.',error);}
      return false;
    }
    try{
      localStorage.setItem(managerStorageKey,key);
      sessionStorage.setItem(managerStorageKey,key);
      sessionStorage.setItem('a10tion-calendar-key',key);
    }catch(error){
      console.warn('Business Manager key could not be saved on this device.',error);
      authStatus.textContent='Connected for this session. This browser could not save the key on this device.';
    }
    loggedInAdmin=matchedAdmin.charAt(0).toUpperCase()+matchedAdmin.slice(1);
    managerShell.classList.remove('auth-locked');
    authGate.hidden=true;
    setConn(true);
    await Promise.all([loadBookingRequests(),loadMonthlyEntitlements()]);
    const initialTab=new URLSearchParams(location.search).get('tab');
    if(['clients','archived','expired','activity','promo','calendar','requests'].includes(initialTab))activateTab(initialTab);
    else activateTab('requests');
    return true;
  }catch(error){
    authStatus.textContent=error.message||'Could not connect to the Business Manager.';
    return false;
  }finally{connectButton.disabled=false;}
}
authForm.addEventListener('submit',async event=>{
  event.preventDefault();
  await authenticateManager();
});
menuButton.addEventListener('click',()=>{
  const open=!managerTabsNode.classList.contains('open');
  if(open)closeNotifications();
  managerTabsNode.classList.toggle('open',open);
  managerDrawerBackdrop.classList.toggle('open',open);
  menuButton.setAttribute('aria-expanded',String(open));
});
managerDrawerBackdrop.addEventListener('click',()=>{
  closeManagerMenu();
  closeNotifications();
});
notificationButton.addEventListener('click',()=>{
  const open=!notificationDrawer.classList.contains('open');
  if(open)closeManagerMenu();
  notificationDrawer.classList.toggle('open',open);
  notificationDrawer.setAttribute('aria-hidden',String(!open));
  notificationButton.setAttribute('aria-expanded',String(open));
  managerDrawerBackdrop.classList.toggle('open',open);
});
notificationClose.addEventListener('click',closeNotifications);
notificationList.addEventListener('click',event=>{
  const button=event.target.closest('button[data-open-tab]');
  if(!button)return;
  closeNotifications();
  activateTab(button.dataset.openTab);
});
managerTabs.forEach(tab=>{
  tab.addEventListener('click',()=>activateTab(tab.dataset.tab));
  tab.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();
      const index=managerTabs.indexOf(tab);
      const direction=event.key==='ArrowRight'?1:-1;
      const next=managerTabs[(index+direction+managerTabs.length)%managerTabs.length];
      next.focus();
    }
  });
});
bookingRequestsReload.addEventListener('click',loadBookingRequests);
async function handleRequestDelete(event){
  const button=event.target.closest('button[data-request-action="delete"]');
  if(!button||button.disabled)return;
  if(!await askYesNo('This will permanently delete this request from the manager. This cannot be undone.'))return;
  button.disabled=true;
  try{
    await bookingRequestsApi({action:'delete',id:button.dataset.id});
    await loadBookingRequests();
    setStatus('Request deleted.','ok');
  }catch(error){setStatus(error.message,'error');button.disabled=false;}
}
expiredRequestCards.addEventListener('click',handleRequestDelete);
activityCards.addEventListener('click',handleRequestDelete);
notificationClearAll.addEventListener('click',async()=>{
  if(!await askYesNo('Clear all notifications?'))return;
  try{localStorage.setItem(dismissedStorageKey,JSON.stringify([...new Set([...readDismissedNotifications(),...currentNotificationKeys])].slice(-500)));}catch{}
  renderNotifications();
});
bookingRequestCards.addEventListener('click',event=>{
  const button=event.target.closest('button[data-request-action]');
  if(!button||button.disabled)return;
  const id=button.dataset.id;
  if(button.dataset.requestAction==='accept'){
    if(!window.confirm('Accept this booking request and email the customer a secure continuation link?'))return;
    processBookingRequest('accept',id);
  }else if(button.dataset.requestAction==='decline'){
    selectedDeclineRequestId=id;
    declineReason.value='';
    declineConfirmDialog.showModal();
  }else if(button.dataset.requestAction==='resend-email'){
    processBookingRequest('resend-email',id);
  }
});
document.getElementById('declineNo').addEventListener('click',()=>declineConfirmDialog.close());
document.getElementById('declineYes').addEventListener('click',()=>{
  declineConfirmDialog.close();
  declineReasonDialog.showModal();
  declineReason.focus();
});
document.getElementById('declineReasonCancel').addEventListener('click',()=>{
  declineReasonDialog.close();
  selectedDeclineRequestId='';
});
declineSubmit.addEventListener('click',async()=>{
  const reason=declineReason.value.trim();
  if(!reason){
    setStatus('Enter a reason before declining the booking request.','error');
    declineReason.focus();
    return;
  }
  if(!selectedDeclineRequestId)return;
  declineSubmit.disabled=true;
  declineReasonDialog.close();
  await processBookingRequest('decline',selectedDeclineRequestId,reason);
  selectedDeclineRequestId='';
  declineSubmit.disabled=false;
});
async function loadBatch(){
  loadButton.disabled=true;setStatus('Loading current batch…');summaryNode.textContent='';
  try{
    const result=await request('GET');
    rowsInput.value=(result.pairs||[]).map((pair,index)=>[String(index+1).padStart(2,'0'),pair.password,pair.promoCode].join('\\t')).join('\\n');
    const used=(result.pairs||[]).filter(pair=>pair.used).length;
    summaryNode.textContent=result.pairs?.length?\`Batch \${result.batchId} · \${result.pairs.length} passwords · \${used} promo codes redeemed\\n\`+(result.pairs||[]).map((pair,index)=>\`\${String(index+1).padStart(2,'0')}  \${pair.promoCode}  \${pair.used?'REDEEMED':'available'}\`).join('\\n'):'No active batch is saved yet.';
    setConn(true);
    setStatus('Current batch loaded.','ok');
    return true;
  }catch(error){setConn(false);setStatus(error.message,'error');return false;}
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
try{localStorage.removeItem(managerStorageKey);sessionStorage.removeItem(managerStorageKey);sessionStorage.removeItem('a10tion-calendar-key');}catch(error){console.warn('Could not clear saved Business Manager keys.',error);}
managerShell.classList.add('auth-locked');
authGate.hidden=false;
setTimeout(()=>adminNameInput.focus(),0);
resetMonthlyForm();
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
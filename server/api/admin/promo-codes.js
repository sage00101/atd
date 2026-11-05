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
:root{color-scheme:light;--bg:#f6f8f6;--surface:#fff;--surface-2:#f8faf8;--surface-3:#eef4ef;--line:rgba(38,77,49,.12);--line-2:rgba(38,77,49,.2);--ink:#1d2c22;--ink-2:#405448;--muted:#718076;--accent:#4d8b5e;--accent-2:#39764d;--accent-ink:#fff;--accent-soft:rgba(77,139,94,.1);--danger:#b44740;--danger-soft:rgba(180,71,64,.1);--warn:#896516;--warn-soft:rgba(180,137,40,.12);--info:#347b94;--info-soft:rgba(52,123,148,.1);font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box;scrollbar-color:#d5e0d7 transparent}
body{margin:0;padding:28px 18px 56px;min-height:100vh;background:radial-gradient(1000px 520px at 12% -8%,rgba(77,139,94,.08),transparent 62%),radial-gradient(760px 420px at 104% 2%,rgba(77,139,94,.04),transparent 58%),var(--bg);background-attachment:fixed}

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
</style>
</head>
<body>
<main class="shell">
<header class="head">
  <div class="head-top"><p class="eyebrow"><span class="pulse"></span>A10tion To Detail · Operations</p><span id="connState" class="conn" data-state="off" role="status">Not connected</span></div>
  <h1>Business manager</h1>
  <p class="sub">Review booking requests, manage promo code batches and monthly clients, and update booking availability.</p>
</header>
<section class="content">
<div class="auth-row"><input id="adminKey" type="password" autocomplete="current-password" placeholder="Admin or calendar API key" aria-label="Admin or calendar API key"><button id="connect" type="button">Connect managers</button></div>
<p id="status" role="status" aria-live="polite"></p>
<nav class="tabs" role="tablist" aria-label="Business manager sections">
  <button id="promoTab" class="tab" type="button" role="tab" aria-selected="true" aria-controls="promoPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>Promo codes</button>
  <button id="bookingRequestsTab" class="tab" type="button" role="tab" aria-selected="false" aria-controls="bookingRequestsPanel">Booking Requests</button>
  <button id="calendarTab" class="tab" type="button" role="tab" aria-selected="false" aria-controls="calendarPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>Calendar</button>
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
  <div id="monthlyStats" class="stat-row" hidden></div>
  <h2 id="monthlyFormTitle" class="section-title">Create monthly entitlement</h2>
  <form id="monthlyForm" class="manager-form">
    <input id="monthlyId" type="hidden">
    <label class="field-label">First name<input class="manager-input" name="firstName" maxlength="60" autocomplete="given-name" required></label>
    <label class="field-label">Surname<input class="manager-input" name="surname" maxlength="60" autocomplete="family-name" required></label>
    <label class="field-label">Customer email<input class="manager-input" name="email" type="email" autocomplete="email" required></label>
    <label class="field-label">Cell number<input class="manager-input" name="customerPhone" type="tel" autocomplete="tel" required></label>
    <label class="field-label">Business / family name <span class="optional">(optional)</span><input class="manager-input" name="businessName" maxlength="120" autocomplete="organization"></label>
    <label class="field-label">Package type<select class="manager-select" name="clientType" required><option value="private">Private Client</option><option value="business">Business / Fleet / Family</option></select></label>
    <label class="field-label">Package level<select class="manager-select" name="packageTier" required><option value="standard">Standard · 2 washes per billing period</option><option value="premium">Premium · 4 washes per billing period</option></select></label>
    <label class="field-label">Active from<input class="manager-input" name="validFrom" type="date" required></label>
    <label class="field-label">Active until <span class="optional">(optional)</span><input class="manager-input" name="validUntil" type="date"></label>
    <div class="field-full manager-form-actions">
      <button id="monthlySubmit" type="submit">Save client</button>
      <button id="monthlyCancel" class="secondary" type="button">Cancel</button>
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
  <p class="note">Review website booking requests before payment or final confirmation. Pending requests hold their selected time for 3 days; monthly wash credits are not reserved until the approved customer completes the booking.</p>
  <div class="booking-requests-toolbar">
    <label class="field-label">Administrator name<input id="bookingRequestAdmin" class="manager-input" maxlength="100" autocomplete="name" placeholder="Business Manager admin"></label>
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
const calendarPanel=document.getElementById('calendarPanel');
const bookingRequestsPanel=document.getElementById('bookingRequestsPanel');
const bookingRequestCards=document.getElementById('bookingRequestCards');
const bookingRequestsEmpty=document.getElementById('bookingRequestsEmpty');
const bookingRequestsCount=document.getElementById('bookingRequestsCount');
const bookingRequestAdmin=document.getElementById('bookingRequestAdmin');
const bookingRequestsReload=document.getElementById('bookingRequestsReload');
const declineConfirmDialog=document.getElementById('declineConfirmDialog');
const declineReasonDialog=document.getElementById('declineReasonDialog');
const declineReason=document.getElementById('declineReason');
const declineSubmit=document.getElementById('declineSubmit');
const singleWashTab=document.getElementById('singleWashTab');
const monthlyWashTab=document.getElementById('monthlyWashTab');
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
let selectedDeclineRequestId='';
const managerStorageKey='a10tion-admin-manager-key';
function setStatus(message,type=''){statusNode.textContent=message;statusNode.className=type;}
function setConn(isOn){connStateNode.dataset.state=isOn?'on':'off';connStateNode.textContent=isOn?'Connected':'Not connected';}
function renderMonthlyStats(){
  const activeCount=monthlyEntitlements.filter(record=>record.status==='Active').length;
  const credits=monthlyEntitlements.reduce((sum,record)=>sum+(Number(record.creditsAvailable)||0),0);
  const review=pendingMonthlyPurchases.length;
  const tiles=[
    [monthlyEntitlements.length,'Monthly clients',''],
    [activeCount,'Active right now',''],
    [credits,'Wash credits outstanding',''],
    [review,'Payments to review',review?' warn':'']
  ];
  monthlyStatsNode.innerHTML=tiles.map(tile=>'<div class="stat'+tile[2]+'"><strong>'+escapeHtml(tile[0])+'</strong><span>'+escapeHtml(tile[1])+'</span></div>').join('');
  monthlyStatsNode.hidden=false;
}
function activateTab(tab){
  const isCalendar=tab==='calendar';
  const isRequests=tab==='requests';
  promoTab.setAttribute('aria-selected',String(!isCalendar&&!isRequests));
  bookingRequestsTab.setAttribute('aria-selected',String(isRequests));
  calendarTab.setAttribute('aria-selected',String(isCalendar));
  promoPanel.hidden=isCalendar||isRequests;
  bookingRequestsPanel.hidden=!isRequests;
  calendarPanel.hidden=!isCalendar;
  if(isRequests) loadBookingRequests();
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
function renderBookingRequests(){
  bookingRequestsCount.textContent=bookingRequests.length+' requests';
  bookingRequestsEmpty.hidden=bookingRequests.length>0;
  bookingRequestCards.innerHTML=bookingRequests.map(record=>{
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
    const actions=record.status==='pending_approval'
      ?'<div class="booking-request-actions"><button type="button" data-request-action="accept" data-id="'+escapeHtml(record.id)+'">Accept Booking</button><button type="button" class="danger" data-request-action="decline" data-id="'+escapeHtml(record.id)+'">Decline Booking</button></div>'
      :['approved','awaiting_completion','declined'].includes(record.status)
        ?'<div class="booking-request-actions"><button type="button" data-request-action="resend-email" data-id="'+escapeHtml(record.id)+'">Resend customer decision email</button></div>'
        :'';
    return '<article class="booking-request-card" data-id="'+escapeHtml(record.id)+'"><div class="entitlement-top"><div><h3>'+escapeHtml(identity)+'</h3><p class="booking-request-meta">'+escapeHtml(customer.email||'')+' · '+escapeHtml(record.reference)+'<br>'+escapeHtml(record.publicStatus||record.status)+'</p></div><span class="status-pill">'+escapeHtml(record.publicStatus||record.status)+'</span></div><details><summary>Open full request details</summary><dl class="booking-request-details">'+details+'</dl></details>'+actions+'</article>';
  }).join('');
}
async function loadBookingRequests(){
  bookingRequestsReload.disabled=true;
  bookingRequestCards.setAttribute('aria-busy','true');
  try{
    const result=await bookingRequestsApi();
    bookingRequests=Array.isArray(result.requests)?result.requests:[];
    renderBookingRequests();
    setStatus('Booking requests refreshed.','ok');
  }catch(error){
    bookingRequestCards.innerHTML='';
    bookingRequestsEmpty.hidden=false;
    bookingRequestsEmpty.textContent=error.message;
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
      setStatus('Request updated, but email delivery was not confirmed. Check the email configuration before assuming the customer was notified.','error');
    }else{
      setStatus(action==='accept'?'Booking approved and approval email sent.':action==='decline'?'Booking declined and customer email sent.':'Customer email sent.','ok');
    }
  }catch(error){
    await loadBookingRequests();
    setStatus(error.message,'error');
  }
}
function bookingRequestAdminName(){
  return bookingRequestAdmin.value.trim()||'Business Manager admin';
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
    const additionalCodes=(record.codes||[])
      .filter(entry=>entry.code&&entry.code!==record.code)
      .map(entry=>'<li><code>'+escapeHtml(entry.code)+'</code><button type="button" data-action="copy" data-code="'+escapeHtml(entry.code)+'">Copy</button> · generated '+escapeHtml(new Date(entry.createdAt).toLocaleDateString('en-ZA'))+'</li>').join('');
    const dateRange='Active '+escapeHtml(record.validFrom||'')+(record.validUntil?' – '+escapeHtml(record.validUntil):' · no end date');
    return '<article class="entitlement-card" data-id="'+escapeHtml(record.id)+'">'+
      '<div class="entitlement-top"><div><h3 class="entitlement-name">'+escapeHtml(record.customerName)+'</h3><p class="entitlement-meta">'+escapeHtml(record.email)+' · '+escapeHtml(record.customerPhone||'No phone')+(record.businessName?'<br>'+escapeHtml(record.businessName):'')+'<br>'+escapeHtml(packageLabel(record))+' · '+escapeHtml(dateRange)+(record.vehicleType?'<br>'+escapeHtml(record.vehicleType):'')+(record.contractOption?'<br>'+escapeHtml(record.contractOption)+' contract':'')+'</p></div><span class="status-pill '+slug+'">'+escapeHtml(record.status)+'</span></div>'+
      '<div class="entitlement-code"><code>'+escapeHtml(record.code)+'</code><button type="button" data-action="copy" data-code="'+escapeHtml(record.code)+'">Copy</button></div>'+
      (additionalCodes?'<details class="entitlement-history"><summary>Other account codes ('+(record.codes.length-1)+')</summary><ul class="history-list">'+additionalCodes+'</ul></details>':'')+
      '<div class="usage-grid"><div class="usage-cell"><strong>'+record.monthlyAllowance+'</strong><span>Booking cap · '+escapeHtml(formatMonth(record.period))+'</span></div><div class="usage-cell"><strong>'+record.used+'</strong><span>Used this period'+(record.reserved?' · '+record.reserved+' pending':'')+'</span></div><div class="usage-cell"><strong>'+record.periodRemaining+'</strong><span>Booking slots left</span></div><div class="usage-cell"><strong>'+record.creditsAvailable+'</strong><span>Wash credits available</span></div></div>'+
      '<p class="hint" style="margin:8px 0 0">Reserved credits across bookings: '+escapeHtml(record.creditsReserved||0)+' · Billing period: '+escapeHtml(record.period)+' to '+escapeHtml(record.periodEnd||'')+'</p>'+
      '<div class="entitlement-actions"><button type="button" data-action="generate-code">Generate another code</button><button type="button" data-action="email">Email latest code</button><button type="button" data-action="payment">Record monthly payment</button><button type="button" data-action="edit">Edit details</button><button type="button" data-action="replace">Replace all codes</button><button type="button" data-action="toggle">'+(record.active?'Deactivate account':'Reactivate account')+'</button><button class="danger" type="button" data-action="archive">Archive</button></div>'+
      '<details class="entitlement-history"><summary>Booking, payment, access and audit history ('+((record.history||[]).length+(record.paymentHistory||[]).length+(record.codeHistory||[]).length+(record.distributionHistory||[]).length+(record.auditHistory||[]).length)+')</summary><ul class="history-list">'+(usageHistory||'<li>No confirmed monthly wash bookings yet.</li>')+paymentHistory+codeHistory+emailHistory+auditHistory+(record.deactivationReason?'<li>Current status reason: '+escapeHtml(record.deactivationReason)+'</li>':'')+'</ul></details>'+
      '</article>';
  }).join('');
  renderMonthlyStats();
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
    setConn(true);
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
  monthlyForm.elements.businessName.value=record.businessName||'';
  monthlyForm.elements.clientType.value=record.clientType;
  monthlyForm.elements.packageTier.value=record.packageTier;
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
  const id=document.getElementById('monthlyId').value;
  const payload=Object.fromEntries(new FormData(monthlyForm).entries());
  try{
    const result=await monthlyRequest(id?'PUT':'POST',id?{...payload,id}:{...payload});
    resetMonthlyForm();
    await loadMonthlyEntitlements();
    setStatus(id?'Monthly client details saved.':'Monthly client saved and random access code generated. Copy it from the customer card to share it securely.','ok');
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
    if(button.dataset.action==='generate-code'){
      button.disabled=true;
      await monthlyRequest('POST',{action:'generate-code',id:record.id});
      await loadMonthlyEntitlements();
      setStatus('Another code was generated for this client. All their codes share the same account status and wash balance.','ok');
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
      if(!window.confirm('Replace all codes? Every previously issued code will stop working; booking history, monthly credits and account status will stay attached to this customer.'))return;
      await monthlyRequest('PUT',{id:record.id,replaceCode:true});
      setStatus('Monthly code replaced; historical usage is preserved.','ok');
    }else if(button.dataset.action==='toggle'){
      const message=record.active
        ?"Are you sure? This will deactivate this user's account. Their saved information and history will be retained, and their access code will stop working."
        :'Reactivate this monthly client and allow their access code to work again?';
      if(!window.confirm(message))return;
      await monthlyRequest('PUT',{id:record.id,active:!record.active,deactivationReason:record.active?'Deactivated by administrator.':'Reactivated by administrator.',...(!record.active&&record.archived?{archived:false}:{})});
      setStatus(record.active?'Monthly client deactivated. Saved information and history were retained.':'Monthly client activated.','ok');
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
bookingRequestsTab.addEventListener('click',()=>activateTab('requests'));
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
bookingRequestsReload.addEventListener('click',loadBookingRequests);
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
  }catch(error){setConn(false);setStatus(error.message,'error');}
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
if(initialTab==='calendar') activateTab('calendar');
if(initialTab==='requests') activateTab('requests');
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
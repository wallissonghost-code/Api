import http from "node:http";
import { readFileSync } from "node:fs";
import { ENGINE_VERSION, ENGINE_VERSION_LABEL } from "./version.js";
import { inspectPublicTikTokVideo } from "./providers/tiktok-public.js";

const PORT = Number(process.env.PORT || 3000);
const APP_ICON = readFileSync(new URL("../public/app-icon.png", import.meta.url));

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendHtml(res, html) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

const TEST_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07090c">
<link rel="icon" type="image/png" href="/app-icon.png">
<link rel="apple-touch-icon" href="/app-icon.png">
<meta name="apple-mobile-web-app-title" content="TikAnalise">
<title>TikAnalise</title>
<style>
:root{--bg:#07090c;--panel:#0d1117;--panel2:#111720;--line:#202833;--text:#f7f8fa;--muted:#8e98a8;--pink:#ff2f69;--cyan:#25f4ee;--good:#42e6a4}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh}button,input,textarea{font:inherit}button{cursor:pointer}.app{display:grid;grid-template-columns:220px 1fr;min-height:100vh}.side{border-right:1px solid var(--line);padding:24px 16px;position:sticky;top:0;height:100vh;background:#080b0f}.brand{font-weight:900;font-size:20px;padding:0 10px 28px}.brand b{color:var(--pink)}.nav{display:grid;gap:8px}.nav button{background:transparent;color:var(--muted);border:0;text-align:left;padding:12px 14px;border-radius:12px}.nav button.active{background:#151b24;color:#fff}.version{position:absolute;bottom:24px;left:26px;color:#657080;font-size:12px}.main{padding:36px;max-width:1280px;width:100%;margin:auto}.hero{padding:8px 0 26px}.hero h1{font-size:38px;line-height:1.05;margin:0 0 10px}.hero p{color:var(--muted);margin:0 0 22px}.addbar{display:flex;gap:10px;max-width:780px}.input{flex:1;background:#0e131a;border:1px solid #29313c;border-radius:14px;color:#fff;padding:16px;outline:none}.input:focus{border-color:#495565}.primary{border:0;border-radius:14px;padding:0 22px;background:linear-gradient(135deg,var(--pink),#ff4c7c);color:white;font-weight:800}.secondary{border:1px solid var(--line);border-radius:12px;padding:11px 15px;background:#11161d;color:#fff}.profile{display:none;align-items:center;gap:16px;padding:18px;background:linear-gradient(145deg,#0f141b,#0b1016);border:1px solid var(--line);border-radius:18px;margin-bottom:18px}.profile.show{display:flex}.avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;background:#171d25}.profile-copy{min-width:0;flex:1}.profile-copy h2{font-size:20px;margin:0 0 2px}.handle{color:#c2cad5;font-weight:700}.bio{color:var(--muted);font-size:13px;margin-top:6px;white-space:pre-line}.count{font-weight:800;color:#fff;background:#141b24;padding:9px 12px;border-radius:999px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:26px 0 12px}.section-head h2{font-size:20px;margin:0}.section-head p{margin:4px 0 0;color:var(--muted);font-size:13px}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.metric{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}.metric span{display:block;color:var(--muted);font-size:12px;margin-bottom:8px}.metric strong{font-size:23px}.grid2{display:grid;grid-template-columns:1.3fr .7fr;gap:14px;margin-top:14px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px}.panel h3{margin:0 0 14px;font-size:16px}.chart{height:230px;display:flex;align-items:flex-end;gap:10px;border-bottom:1px solid #29313b;padding:20px 6px 0}.barwrap{height:100%;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:22px}.bar{width:100%;max-width:48px;min-height:3px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,var(--pink),#7c2248)}.barvalue{font-size:10px;font-weight:800;color:#dfe5ed;margin-bottom:5px;line-height:1}.barlabel{font-size:10px;color:#737f8f;margin-top:7px}.barwrap{cursor:pointer;border-radius:8px;transition:background .15s,transform .15s}.barwrap:hover{background:#ffffff08}.barwrap:focus-visible{outline:2px solid var(--pink);outline-offset:2px}.video.chart-target{border-color:var(--pink);box-shadow:0 0 0 2px #ff2f6938,0 8px 28px #ff2f6920}.insights{display:grid;gap:9px}.insight{background:#101720;border:1px solid #202a36;padding:13px;border-radius:12px;font-size:13px;line-height:1.4}.videos-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;background:#0d1218;border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 12px}.videos-toolbar strong{display:block;font-size:13px}.videos-toolbar span{display:block;color:var(--muted);font-size:11px;margin-top:3px;min-height:14px}.refresh-all{white-space:nowrap}.refresh-all:disabled{opacity:.55;cursor:wait}.videos{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.video{overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:16px;cursor:pointer;transition:transform .15s,border-color .15s}.video:hover{transform:translateY(-2px);border-color:#354151}.cover{width:100%;aspect-ratio:9/16;object-fit:cover;object-position:center;background:#141920;display:block}.vbody{padding:11px}.vdesc{display:none}.vmeta{display:none}.vmeta span{font-size:9px;color:#aeb8c5;background:#121923;border:1px solid #202a36;border-radius:999px;padding:4px 6px;white-space:nowrap}.tags{display:none}.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-top:2px}.stat small{display:block;color:var(--muted);font-size:8px}.stat b{font-size:11px}.vactions{display:none}.video-hint{display:none}.vactions{display:none}.empty{border:1px dashed #29313c;border-radius:16px;padding:32px;text-align:center;color:var(--muted)}.status{min-height:22px;color:var(--muted);font-size:13px;margin-top:10px}.bottom{display:none}.modal{position:fixed;inset:0;background:#000a;display:none;place-items:center;padding:18px;z-index:20}.modal.show{display:grid}.modalbox{width:min(560px,100%);background:#0d1218;border:1px solid #29313c;border-radius:20px;padding:20px}.modalbox h3{margin:0 0 6px}.modalbox p{color:var(--muted);font-size:13px}.modalbox textarea{width:100%;min-height:160px;resize:vertical;background:#080c11;border:1px solid #29313c;border-radius:13px;color:#fff;padding:13px}.modalactions{display:flex;gap:9px;justify-content:flex-end;margin-top:12px}
@media(max-width:1000px){.metrics{grid-template-columns:repeat(3,1fr)}.videos{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:720px){html{scroll-padding-top:12px}body{padding-bottom:calc(76px + env(safe-area-inset-bottom));overflow-x:hidden}.app{display:block;min-width:0}.side{display:none}.main{padding:18px 14px 24px;max-width:100%;overflow:hidden}.hero{padding:10px 0 22px;scroll-margin-top:12px}.hero h1{font-size:clamp(28px,8.4vw,36px);max-width:100%;line-height:1.04}.hero p{font-size:16px;line-height:1.45}.addbar{flex-direction:column;width:100%}.input{width:100%;min-width:0;font-size:16px}.primary{padding:15px;min-height:52px}.profile{align-items:flex-start;display:none;grid-template-columns:58px minmax(0,1fr);gap:12px;padding:14px;scroll-margin-top:12px}.profile.show{display:grid}.avatar{width:58px;height:58px}.profile-copy{min-width:0}.profile-copy h2,.handle,.bio{overflow-wrap:anywhere}.count{grid-column:1/-1;justify-self:start;font-size:11px;padding:7px 10px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.metric{padding:13px}.metric span{font-size:11px}.metric strong{font-size:20px}.section-head{align-items:flex-start;scroll-margin-top:12px;margin-top:22px}.section-head h2{font-size:20px}.grid2{grid-template-columns:minmax(0,1fr);gap:10px}.panel{padding:14px;min-width:0;scroll-margin-top:12px}.chart{height:180px;gap:5px;padding-left:2px;padding-right:2px;overflow:hidden}.barwrap{min-width:0}.barlabel{font-size:9px}.videos-toolbar{padding:10px 11px;gap:8px}.videos-toolbar strong{font-size:12px}.videos-toolbar span{font-size:9px}.refresh-all{padding:9px 11px;font-size:10px}.videos{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.video{border-radius:10px;min-width:0}.vbody{padding:6px}.stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;margin-top:0}.stat{min-width:0}.stat small{font-size:7px}.stat b{font-size:10px;white-space:nowrap}.bottom{position:fixed;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));bottom:0;left:0;right:0;width:100%;background:#090d12f2;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border-top:1px solid var(--line);padding:7px 4px calc(7px + env(safe-area-inset-bottom));z-index:50}.bottom button{min-width:0;border:0;background:transparent;color:#7f8998;font-size:10px;padding:9px 1px;touch-action:manipulation}.bottom button.active{color:#fff}.bottom .add{width:46px;height:46px;border-radius:50%;background:var(--pink);color:#fff;font-size:24px;margin:-22px auto 0;box-shadow:0 8px 25px #ff2f6955}.modal{padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom))}.modalbox{max-height:calc(100dvh - 24px - env(safe-area-inset-bottom));overflow:auto}.detail-grid{grid-template-columns:repeat(2,1fr)}.hero{display:none}
.profile{grid-template-columns:52px minmax(0,1fr);gap:10px 12px;padding:14px 14px 12px}
.avatar{width:52px;height:52px}
.profile-copy{display:grid;grid-template-columns:1fr}
.profile-copy>div:first-child{font-size:9px!important}
.profile-copy h2{font-size:19px;margin:1px 0 3px}
.profile-copy .handle{font-size:15px}
.profile-copy .bio{font-size:12px;line-height:1.4;margin-top:3px}
.count{grid-column:1/-1;margin-top:0;font-size:10px;padding:6px 9px}
.chart-panel{overflow:hidden}
.chart-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:none}
.chart-scroll::-webkit-scrollbar{display:none}
.chart-panel>h3{position:relative;z-index:1;margin-bottom:8px}
.bottom button:not(.add){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:9px;font-weight:650;letter-spacing:.01em}
.bottom button:not(.add) svg{width:21px;height:21px}
.bottom button.active:not(.add){color:#fff}
.bottom .add{display:grid;place-items:center}
.bottom .add svg{width:25px;height:25px;stroke-width:2.2}
.modal-locked{overflow:hidden!important;overscroll-behavior:none}.detail-modal{z-index:80;align-items:end;padding:0;background:#000b;overscroll-behavior:none;touch-action:none}
.detail-sheet{width:100%;max-width:none;max-height:calc(92dvh - env(safe-area-inset-bottom));border-radius:22px 22px 0 0;border-left:0;border-right:0;border-bottom:0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
.detail-head{position:sticky;top:-16px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#0d1218;padding:14px 0 10px;margin-top:-14px}
.detail-head h3{font-size:20px;margin:0}
.detail-x{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;background:#151b23;color:#fff;font-size:24px;line-height:1;padding:0}
.detail-cover{width:86px;height:auto;aspect-ratio:9/16;border-radius:10px;margin:0 12px 8px 0}
.detail-desc{font-size:12px;line-height:1.45;max-height:112px;overflow:auto}
.detail-tags{font-size:10px;line-height:1.4;margin:9px 0 11px;overflow-wrap:anywhere}
.detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.detail-grid>div{padding:9px;min-height:64px}
.detail-grid small{font-size:9px}
.detail-grid b{font-size:12px;overflow-wrap:anywhere}
.detail-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.detail-actions .secondary{min-width:0;padding:11px 8px;font-size:11px}
#detailRemove{grid-column:1/-1}
#detailClose{display:none}

.profile #multiBtn{display:none}.profile{margin-top:8px}.chart{width:max-content;min-width:100%;height:150px;overflow:visible;justify-content:flex-start;gap:10px}.barwrap{flex:0 0 64px;scroll-snap-align:start}.bar{max-width:34px}.bottom{touch-action:manipulation}}
.detail-cover{width:110px;aspect-ratio:9/16;object-fit:cover;border-radius:12px;float:left;margin:0 14px 10px 0}.detail-desc{font-size:13px;line-height:1.5;color:#dce1e8;white-space:pre-wrap}.detail-tags{clear:both;color:var(--cyan);font-size:12px;line-height:1.5;margin:12px 0}.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;clear:both}.detail-grid div{background:#101720;border:1px solid #202a36;border-radius:10px;padding:9px}.detail-grid small{display:block;color:var(--muted);font-size:9px}.detail-grid b{font-size:13px}.detail-actions{display:flex;gap:8px;margin-top:14px}.detail-actions button{flex:1}</style>
</head>
<body>
<div class="app">
<aside class="side"><div class="brand">Tik<b>Analise</b></div><div class="nav"><button class="active" data-nav="home">Início</button><button data-nav="overview">Visão geral</button><button data-nav="insights">Insights</button><button data-nav="videos">Meus vídeos</button></div><div class="version">${ENGINE_VERSION_LABEL}</div></aside>
<main class="main">
<section class="hero" id="homeSection"><div style="color:#7f8998;font-size:12px;font-weight:800;letter-spacing:.04em;margin-bottom:10px">${ENGINE_VERSION_LABEL}</div><h1>Analise seus vídeos do TikTok</h1><p>Adicione seus vídeos e descubra o que está funcionando no seu conteúdo.</p><div class="addbar"><input class="input" id="videoUrl" inputmode="url" autocomplete="off" placeholder="Cole a URL do vídeo do TikTok"><button class="primary" id="analyzeBtn">Analisar vídeo</button></div><div class="status" id="status"></div></section>
<section class="profile" id="profileCard"><img class="avatar" id="avatar"><div class="profile-copy"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em">Nome de exibição</div><h2 id="nickname"></h2><div style="color:var(--muted);font-size:11px;margin-top:7px">Nome de usuário</div><div class="handle" id="handle"></div><div style="color:var(--muted);font-size:11px;margin-top:7px">Bio</div><div class="bio" id="bio"></div></div><button class="secondary" id="multiBtn">+ Adicionar vídeos</button></section>
<section id="dashboard" data-section="overview">
<div class="section-head" id="overviewSection"><div><h2>Visão dos vídeos analisados</h2><p id="sampleText">Adicione um vídeo para começar.</p></div></div>
<div class="metrics">
<div class="metric"><span>Vídeos analisados</span><strong id="mVideos">0</strong></div>
<div class="metric"><span>Visualizações</span><strong id="mViews">0</strong></div>
<div class="metric"><span>Curtidas</span><strong id="mLikes">0</strong></div>
<div class="metric"><span>Comentários</span><strong id="mComments">0</strong></div>
<div class="metric"><span>Compartilhamentos</span><strong id="mShares">0</strong></div>
<div class="metric"><span>Engajamento médio</span><strong id="mEng">—</strong></div>
</div>
<div class="grid2"><div class="panel chart-panel"><h3>Desempenho dos vídeos · Visualizações</h3><div class="chart-scroll"><div class="chart" id="chart"></div></div></div><div class="panel" id="insightsSection"><h3>O que seus vídeos estão mostrando</h3><div class="insights" id="insights"></div></div></div>
<div class="section-head" id="videosSection"><div><h2>Meus vídeos</h2><p>Somente vídeos que você adicionou ao sistema.</p></div></div><div class="videos-toolbar"><div><strong id="videosAnalyzedCount">0 vídeos analisados</strong><span id="refreshAllStatus"></span></div><button class="secondary refresh-all" id="refreshAllBtn">Atualizar todos</button></div>
<div class="videos" id="videos"></div>
</section>
</main></div>
<nav class="bottom" aria-label="Navegação móvel"><button data-mobile-nav="profile"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg><span>Perfil</span></button><button data-mobile-nav="overview"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg><span>Visão geral</span></button><button class="add" id="mobileAdd" aria-label="Adicionar vídeos"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button><button data-mobile-nav="insights"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V10M10 19V5M16 19v-7M22 19V8"/></svg><span>Insights</span></button><button data-mobile-nav="videos"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/></svg><span>Vídeos</span></button></nav>
<div class="modal detail-modal" id="detailModal"><div class="modalbox detail-sheet"><div class="detail-head"><h3>Detalhes do vídeo</h3><button class="detail-x" id="detailX" aria-label="Fechar detalhes">×</button></div><div id="detailContent"></div><div class="detail-actions"><button class="secondary" id="detailOpen">Abrir TikTok</button><button class="secondary" id="detailUpdate">Atualizar</button><button class="secondary" id="detailRemove">Remover</button><button class="secondary" id="detailClose">Fechar</button></div></div></div><div class="modal" id="modal"><div class="modalbox"><h3>Adicionar vídeos</h3><p>Cole uma ou várias URLs do TikTok, uma por linha. Cada vídeo será analisado individualmente.</p><textarea id="multiUrls" placeholder="URL vídeo 1&#10;URL vídeo 2&#10;URL vídeo 3"></textarea><div class="status" id="linkCount">0 links encontrados</div><div class="modalactions"><button class="secondary" id="closeModal">Cancelar</button><button class="primary" id="analyzeMany" style="padding:12px 18px">Analisar vídeos</button></div></div></div>
<script>
const STORE="tikanalise:v1";let state={profiles:{},active:null};try{const saved=localStorage.getItem(STORE);if(saved){const parsed=JSON.parse(saved);if(parsed&&parsed.profiles)state=parsed}}catch(e){console.warn("Storage indisponível",e)}
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat("pt-BR",{notation:n>=10000?"compact":"standard",maximumFractionDigits:1}).format(n||0);
const engagement=v=>{const m=v.metrics||{},views=m.views||0;return views?((m.likes||0)+(m.comments||0)+(m.shares||0)+(m.saves||0))/views:0};
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){console.warn("Não foi possível salvar localmente",e)}}
function active(){return state.active?state.profiles[state.active]:null}
function render(){
 const p=active(), list=p?Object.values(p.videos):[];
 $("profileCard").classList.toggle("show",!!p);
 if(p){$("avatar").src=p.profile.avatarUrl||"";$("nickname").textContent=p.profile.nickname||p.profile.username;$("handle").textContent="@"+p.profile.username;$("bio").textContent=p.profile.bio||""}
 const sums=list.reduce((a,v)=>{const m=v.metrics||{};a.views+=m.views||0;a.likes+=m.likes||0;a.comments+=m.comments||0;a.shares+=m.shares||0;return a},{views:0,likes:0,comments:0,shares:0});
 $("mVideos").textContent=list.length;$("mViews").textContent=fmt(sums.views);$("mLikes").textContent=fmt(sums.likes);$("mComments").textContent=fmt(sums.comments);$("mShares").textContent=fmt(sums.shares);
 $("mEng").textContent=list.length?(list.reduce((s,v)=>s+engagement(v),0)/list.length*100).toFixed(2)+"%":"—";
 $("sampleText").textContent=list.length?"Baseado em "+list.length+" vídeo"+(list.length===1?"":"s")+" adicionado"+(list.length===1?"":"s")+" ao sistema.":"Adicione um vídeo para começar.";
 $("videosAnalyzedCount").textContent=list.length+" vídeo"+(list.length===1?"":"s")+" analisado"+(list.length===1?"":"s");renderChart(list);renderInsights(list);renderVideos(list)
}
function renderChart(list){const el=$("chart");el.innerHTML="";if(!list.length){el.innerHTML='<div class="empty" style="width:100%">Sem dados ainda.</div>';return}const ordered=[...list].sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));const max=Math.max(...ordered.map(v=>v.metrics?.views||0),1);ordered.forEach((v,i)=>{const w=document.createElement("div");w.className="barwrap";w.tabIndex=0;w.setAttribute("role","button");w.setAttribute("aria-label",(v.description||"Vídeo")+" · "+fmt(v.metrics?.views||0)+" visualizações");const value=document.createElement("div");value.className="barvalue";value.textContent=fmt(v.metrics?.views||0);const b=document.createElement("div");b.className="bar";b.style.height=Math.max(3,(v.metrics?.views||0)/max*100)+"%";b.title=fmt(v.metrics?.views||0)+" views";const l=document.createElement("div");l.className="barlabel";l.textContent=v.createdAt?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit"}).format(new Date(v.createdAt)):"V"+(i+1);l.title=v.createdAt?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v.createdAt))+" · "+(v.description||"Vídeo"):v.description||("Vídeo "+(i+1));const go=()=>focusVideoFromChart(v.id);w.onclick=go;w.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}};w.append(value,b,l);el.append(w)})}
function renderInsights(list){const el=$("insights");el.innerHTML="";if(!list.length){el.innerHTML='<div class="insight">Os insights aparecerão conforme você adicionar vídeos.</div>';return}const avg=list.reduce((s,v)=>s+(v.metrics?.views||0),0)/list.length;const best=[...list].sort((a,b)=>(b.metrics?.views||0)-(a.metrics?.views||0))[0];const bestEng=[...list].sort((a,b)=>engagement(b)-engagement(a))[0];const items=[];if(list.length>1&&avg)items.push("O vídeo mais visualizado teve "+((best.metrics.views/avg)).toFixed(1).replace(".",",")+"× a média de visualizações da sua amostra.");if(bestEng)items.push("Maior engajamento da amostra: "+(engagement(bestEng)*100).toFixed(2).replace(".",",")+"%.");if(list.length<5)items.push("Amostra pequena: adicione mais vídeos para comparações mais representativas.");else items.push("Insights calculados exclusivamente sobre os "+list.length+" vídeos adicionados.");items.forEach(t=>{const d=document.createElement("div");d.className="insight";d.textContent=t;el.append(d)})}
let lockedScrollY=0;
function lockPageScroll(){
 if(document.body.classList.contains("modal-locked"))return;
 lockedScrollY=window.scrollY||window.pageYOffset||0;
 document.body.style.position="fixed";
 document.body.style.top="-"+lockedScrollY+"px";
 document.body.style.left="0";
 document.body.style.right="0";
 document.body.style.width="100%";
 document.body.classList.add("modal-locked");
}
function unlockPageScroll(){
 if(!document.body.classList.contains("modal-locked"))return;
 document.body.classList.remove("modal-locked");
 document.body.style.position="";
 document.body.style.top="";
 document.body.style.left="";
 document.body.style.right="";
 document.body.style.width="";
 window.scrollTo(0,lockedScrollY);
}
function closeDetailModal(){$("detailModal").classList.remove("show");unlockPageScroll()}
function closeAddModal(){modal.classList.remove("show");unlockPageScroll()}
let detailVideo=null;
function openVideoDetail(v){detailVideo=v;const posted=v.createdAt?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v.createdAt)):"Data indisponível";const duration=Number(v.durationSeconds)||0;const dur=duration?(Math.floor(duration/60)+":"+String(duration%60).padStart(2,"0")):"—";const m=v.metrics||{};$("detailContent").innerHTML='<img class="detail-cover" src="'+(v.coverUrl||"")+'" alt=""><div class="detail-desc"></div><div class="detail-tags"></div><div class="detail-grid"><div><small>Publicado</small><b>'+posted+'</b></div><div><small>Duração</small><b>'+dur+'</b></div><div><small>Views</small><b>'+fmt(m.views)+'</b></div><div><small>Likes</small><b>'+fmt(m.likes)+'</b></div><div><small>Comentários</small><b>'+fmt(m.comments)+'</b></div><div><small>Compart.</small><b>'+fmt(m.shares)+'</b></div><div><small>Salvos</small><b>'+fmt(m.saves)+'</b></div><div><small>Engajamento</small><b>'+(engagement(v)*100).toFixed(2)+'%</b></div></div>';$("detailContent").querySelector(".detail-desc").textContent=v.description||"Sem legenda";$("detailContent").querySelector(".detail-tags").textContent=(v.hashtags||[]).map(t=>"#"+t).join(" ")||"Sem hashtags identificadas";lockPageScroll();$("detailModal").classList.add("show")}
function focusVideoFromChart(id){const target=document.querySelector('.video[data-video-id="'+CSS.escape(String(id))+'"]');if(!target)return;document.querySelectorAll(".video.chart-target").forEach(x=>x.classList.remove("chart-target"));target.classList.add("chart-target");target.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>target.classList.remove("chart-target"),2200)}\nfunction renderVideos(list){const el=$("videos");el.innerHTML="";if(!list.length){el.innerHTML='<div class="empty">Nenhum vídeo salvo ainda.<br>Use o botão + para adicionar.</div>';return}[...list].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).forEach(v=>{const card=document.createElement("article");card.className="video";card.dataset.videoId=String(v.id);const posted=v.createdAt?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit"}).format(new Date(v.createdAt)):"—";const duration=Number(v.durationSeconds)||0;const dur=duration?(Math.floor(duration/60)+":"+String(duration%60).padStart(2,"0")):"—";card.innerHTML='<img class="cover" src="'+(v.coverUrl||"")+'" alt=""><div class="vbody"><div class="vdesc"></div><div class="vmeta"><span>'+posted+'</span><span>'+dur+'</span></div><div class="stats"><div class="stat"><small>Views</small><b>'+fmt(v.metrics?.views)+'</b></div><div class="stat"><small>Eng.</small><b>'+(engagement(v)*100).toFixed(2)+'%</b></div></div><div class="video-hint">Toque para ver detalhes</div></div>';card.querySelector(".vdesc").textContent=v.description||"Sem legenda";card.onclick=()=>openVideoDetail(v);el.append(card)})}
async function analyze(url,quiet=false){url=String(url||"").trim();const status=$("status");if(!url){status.textContent="Cole uma URL de vídeo do TikTok.";return false}const btn=$("analyzeBtn");if(!quiet){status.textContent="Analisando vídeo…";btn.disabled=true;btn.textContent="Analisando…"}try{const r=await fetch("/api/video?url="+encodeURIComponent(url),{cache:"no-store"});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error("Resposta inválida do servidor")}if(!r.ok||!data.video)throw new Error(data.message||"Não foi possível analisar o vídeo");const profile=data.profile||{id:data.input.username,username:data.input.username};const key=profile.id||profile.username;if(!state.profiles[key])state.profiles[key]={profile:profile,videos:{}};state.profiles[key].profile=profile;state.profiles[key].videos[data.video.id]=data.video;state.active=key;save();render();if(!quiet){$("videoUrl").value="";status.textContent="Vídeo analisado e salvo no perfil.";setTimeout(()=>$("profileCard").scrollIntoView({behavior:"smooth",block:"start"}),100)}return true}catch(e){status.textContent="Erro: "+(e&&e.message?e.message:"Falha ao analisar o vídeo");return false}finally{if(!quiet){btn.disabled=false;btn.textContent="Analisar vídeo"}}}
async function refreshAllVideos(){
 const p=active(),videos=p?Object.values(p.videos):[],btn=$("refreshAllBtn"),out=$("refreshAllStatus");
 if(!videos.length){out.textContent="Nenhum vídeo para atualizar.";return}
 btn.disabled=true;btn.textContent="Atualizando…";let ok=0,failed=0;
 for(let i=0;i<videos.length;i++){
  out.textContent="Atualizando "+(i+1)+" de "+videos.length+"…";
  try{const r=await fetch("/api/video?url="+encodeURIComponent(videos[i].url),{cache:"no-store"});const data=await r.json();if(!r.ok||!data.video)throw new Error(data.message||"Falha");const current=active();if(current&&current.videos[videos[i].id]){current.videos[data.video.id]=data.video;if(String(data.video.id)!==String(videos[i].id))delete current.videos[videos[i].id]}ok++}catch(e){failed++}
 }
 save();render();out.textContent=ok+" atualizado"+(ok===1?"":"s")+(failed?" · "+failed+" falhou"+(failed===1?"":"ram"):"");
 btn.disabled=false;btn.textContent="Atualizar todos";
}
$("refreshAllBtn").onclick=refreshAllVideos;
$("analyzeBtn").onclick=()=>analyze($("videoUrl").value);$("videoUrl").addEventListener("keydown",e=>{if(e.key==="Enter")analyze(e.target.value)});
document.querySelectorAll("[data-nav]").forEach(btn=>btn.onclick=()=>{document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x===btn));const target=btn.dataset.nav==="home"?$("homeSection"):btn.dataset.nav==="overview"?$("overviewSection"):btn.dataset.nav==="insights"?$("insightsSection"):$("videosSection");target.scrollIntoView({behavior:"smooth",block:"start"})});\ndocument.querySelectorAll("[data-mobile-nav]").forEach(btn=>btn.onclick=()=>{document.querySelectorAll("[data-mobile-nav]").forEach(x=>x.classList.toggle("active",x===btn));const key=btn.dataset.mobileNav;const target=key==="profile"?($("profileCard").classList.contains("show")?$("profileCard"):$("overviewSection")):key==="overview"?$("overviewSection"):key==="insights"?$("insightsSection"):$("videosSection");if(target)target.scrollIntoView({behavior:"smooth",block:"start"})});\n$("detailClose").onclick=closeDetailModal;$("detailX").onclick=closeDetailModal;$("detailOpen").onclick=()=>{if(detailVideo)window.open(detailVideo.url,"_blank","noopener,noreferrer")};$("detailUpdate").onclick=async()=>{if(detailVideo){await analyze(detailVideo.url,true);closeDetailModal()}};$("detailRemove").onclick=()=>{if(!detailVideo)return;const p=active();delete p.videos[detailVideo.id];save();render();closeDetailModal()};\nconst modal=$("modal");function openModal(){lockPageScroll();modal.classList.add("show");setTimeout(()=>$("multiUrls").focus(),50)}$("multiBtn").onclick=openModal;$("mobileAdd").onclick=openModal;$("closeModal").onclick=closeAddModal;$("multiUrls").oninput=e=>{const n=e.target.value.split(/\\n+/).map(x=>x.trim()).filter(Boolean).length;$("linkCount").textContent=n+" link"+(n===1?"":"s")+" encontrado"+(n===1?"":"s")};$("analyzeMany").onclick=async()=>{const urls=$("multiUrls").value.split(/\\n+/).map(x=>x.trim()).filter(Boolean);$("analyzeMany").disabled=true;for(let i=0;i<urls.length;i++){ $("linkCount").textContent="Analisando "+(i+1)+" de "+urls.length+"…";await analyze(urls[i],true)}$("analyzeMany").disabled=false;$("multiUrls").value="";$("linkCount").textContent="Concluído: "+urls.length+" vídeo"+(urls.length===1?"":"s");setTimeout(closeAddModal,500)};
const navSections=[["profile",$("profileCard")],["overview",$("overviewSection")],["insights",$("insightsSection")],["videos",$("videosSection")]].filter(x=>x[1]);let scrollSpyTick=0;function syncNavToScroll(){if(scrollSpyTick)return;scrollSpyTick=requestAnimationFrame(()=>{scrollSpyTick=0;const probe=Math.min(window.innerHeight*.38,260);let current="overview";for(const [key,el] of navSections){const r=el.getBoundingClientRect();if(r.top<=probe)current=key}document.querySelectorAll("[data-mobile-nav]").forEach(x=>x.classList.toggle("active",x.dataset.mobileNav===current));const desktopKey=current==="profile"?"home":current;document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x.dataset.nav===desktopKey))})}window.addEventListener("scroll",syncNavToScroll,{passive:true});window.addEventListener("resize",syncNavToScroll,{passive:true});setTimeout(syncNavToScroll,0);\n$("detailModal").addEventListener("click",e=>{if(e.target===$("detailModal"))closeDetailModal()});
modal.addEventListener("click",e=>{if(e.target===modal)closeAddModal()});
let lastTouchEnd=0;document.addEventListener("gesturestart",e=>e.preventDefault(),{passive:false});document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now},{passive:false});render();
</script>
</body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/") return sendHtml(res, TEST_PAGE);
  if (req.method === "GET" && url.pathname === "/app-icon.png") {
    res.writeHead(200, { "content-type": "image/png", "content-length": APP_ICON.length, "cache-control": "public, max-age=3600" });
    return res.end(APP_ICON);
  }
  if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, service: "tiktok-plus-engine", engineVersion: ENGINE_VERSION });

  if (req.method === "GET" && url.pathname === "/api/video") {
    const videoUrl = url.searchParams.get("url");
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15_000);
      const result = await inspectPublicTikTokVideo(videoUrl, { signal: controller.signal });
      return sendJson(res, 200, { schemaVersion: 1, engineVersion: ENGINE_VERSION, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = /invalid|must contain|required/i.test(message) ? 400 : 502;
      return sendJson(res, status, { ok: false, error: status === 400 ? "INVALID_VIDEO_URL" : "COLLECTION_FAILED", message });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return sendJson(res, 404, { ok: false, error: "NOT_FOUND" });
});

server.listen(PORT, () => console.log(`TikTok Plus Engine listening on :${PORT}`));

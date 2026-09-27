const STORE="tikanalise:v1";let state={profiles:{},active:null};try{const saved=localStorage.getItem(STORE);if(saved){const parsed=JSON.parse(saved);if(parsed&&parsed.profiles)state=parsed}}catch(e){console.warn("Storage indisponível",e)}
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat("pt-BR",{notation:n>=10000?"compact":"standard",maximumFractionDigits:1}).format(n||0);
const engagement=v=>{if(Number.isFinite(v?.derived?.engagementRate))return v.derived.engagementRate;const m=v?.metrics||{},views=m.views||0;return views?((m.likes||0)+(m.comments||0)+(m.shares||0)+(m.saves||0))/views:0};
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){console.warn("Não foi possível salvar localmente",e)}}
function active(){return state.active?state.profiles[state.active]:null}
let profileCompatibilitySync=false;
async function syncLegacyProfileStats(){
 if(profileCompatibilitySync)return;
 const p=active(),profile=p&&p.profile||{},stats=profile.stats,videos=p?Object.values(p.videos||{}):[];
 if(!p||stats||!videos.length)return;
 profileCompatibilitySync=true;
 try{
  const r=await fetch("/api/video?url="+encodeURIComponent(videos[0].url),{cache:"no-store"});
  const data=await r.json();
  if(r.ok&&data.profile){
   p.profile=data.profile;
   if(data.video)p.videos[data.video.id]=data.video;
   save();render();
  }
 }catch(e){console.warn("Não foi possível sincronizar os dados públicos do perfil",e)}
}
function render(){
 const p=active(), list=p?Object.values(p.videos):[];
 $("profileCard").classList.toggle("show",!!p);
 if(p){const profile=p.profile||{},stats=profile.stats;$("avatar").src=profile.avatarUrl||"";$("nickname").textContent=profile.nickname||profile.username;$("handle").textContent="@"+profile.username;$("bio").textContent=profile.bio||"";$("pFollowing").textContent=stats?fmt(stats.following):"—";$("pFollowers").textContent=stats?fmt(stats.followers):"—";$("pLikes").textContent=stats?fmt(stats.likes):"—"}
 const sums=list.reduce((a,v)=>{const m=v.metrics||{};a.views+=m.views||0;a.likes+=m.likes||0;a.comments+=m.comments||0;a.shares+=m.shares||0;return a},{views:0,likes:0,comments:0,shares:0});
 $("mVideos").textContent=list.length;$("mViews").textContent=fmt(sums.views);$("mLikes").textContent=fmt(sums.likes);$("mComments").textContent=fmt(sums.comments);$("mShares").textContent=fmt(sums.shares);
 $("mEng").textContent=list.length?(list.reduce((s,v)=>s+engagement(v),0)/list.length*100).toFixed(2)+"%":"—";const pmEng=list.length?(list.reduce((s,v)=>s+engagement(v),0)/list.length*100).toFixed(2)+"%":"—";[["pmVideos",list.length],["pmViews",fmt(sums.views)],["pmLikes",fmt(sums.likes)],["pmComments",fmt(sums.comments)],["pmShares",fmt(sums.shares)],["pmEng",pmEng]].forEach(([id,val])=>{const el=$(id);if(el)el.textContent=val});
 $("sampleText").textContent=list.length?"Baseado em "+list.length+" vídeo"+(list.length===1?"":"s")+" adicionado"+(list.length===1?"":"s")+" ao sistema.":"Adicione um vídeo para começar.";
 $("videosAnalyzedCount").textContent=list.length+" vídeo"+(list.length===1?"":"s")+" analisado"+(list.length===1?"":"s");renderChart(list);renderInsights(list);renderVideos(list);setTimeout(syncNavToScroll,0);syncLegacyProfileStats()
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
function focusVideoFromChart(id){const target=document.querySelector('.video[data-video-id="'+CSS.escape(String(id))+'"]');if(!target)return;document.querySelectorAll(".video.chart-target").forEach(x=>x.classList.remove("chart-target"));target.classList.add("chart-target");target.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>target.classList.remove("chart-target"),2200)}
function renderVideos(list){const el=$("videos");el.innerHTML="";if(!list.length){el.innerHTML='<div class="empty">Nenhum vídeo salvo ainda.<br>Use o botão + para adicionar.</div>';return}[...list].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).forEach(v=>{const card=document.createElement("article");card.className="video";card.dataset.videoId=String(v.id);const posted=v.createdAt?new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit"}).format(new Date(v.createdAt)):"—";const duration=Number(v.durationSeconds)||0;const dur=duration?(Math.floor(duration/60)+":"+String(duration%60).padStart(2,"0")):"—";card.innerHTML='<img class="cover" src="'+(v.coverUrl||"")+'" alt=""><div class="vbody"><div class="vdesc"></div><div class="vmeta"><span>'+posted+'</span><span>'+dur+'</span></div><div class="stats"><div class="stat"><small>Views</small><b>'+fmt(v.metrics?.views)+'</b></div><div class="stat"><small>Eng.</small><b>'+(engagement(v)*100).toFixed(2)+'%</b></div></div><div class="video-hint">Toque para ver detalhes</div></div>';card.querySelector(".vdesc").textContent=v.description||"Sem legenda";card.onclick=()=>openVideoDetail(v);el.append(card)})}
async function analyze(url,quiet=false){url=String(url||"").trim();const status=$("status");if(!url){status.textContent="Cole uma URL de vídeo do TikTok.";return false}const btn=$("analyzeBtn");if(!quiet){status.textContent="Analisando vídeo…";btn.disabled=true;btn.textContent="Analisando…"}try{const r=await fetch("/api/video?url="+encodeURIComponent(url),{cache:"no-store"});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error("Resposta inválida do servidor")}if(!r.ok||!data.video)throw new Error(data.message||"Não foi possível analisar o vídeo");const profile=data.profile||{id:data.input.username,username:data.input.username};const key=profile.id||profile.username;if(!state.profiles[key])state.profiles[key]={profile:profile,videos:{}};state.profiles[key].profile=profile;state.profiles[key].videos[data.video.id]=data.video;state.active=key;save();render();if(!quiet){$("videoUrl").value="";status.textContent="Vídeo analisado e salvo no perfil.";setTimeout(()=>showView("profile"),100)}return true}catch(e){status.textContent="Erro: "+(e&&e.message?e.message:"Falha ao analisar o vídeo");return false}finally{if(!quiet){btn.disabled=false;btn.textContent="Analisar vídeo"}}}
async function refreshAllVideos(){
 const p=active(),videos=p?Object.values(p.videos):[],btn=$("refreshAllBtn"),out=$("refreshAllStatus");
 if(!videos.length){out.textContent="Nenhum vídeo para atualizar.";return}
 btn.disabled=true;btn.textContent="Atualizando…";let ok=0,failed=0;
 for(let i=0;i<videos.length;i++){
  out.textContent="Atualizando "+(i+1)+" de "+videos.length+"…";
  try{const r=await fetch("/api/video?url="+encodeURIComponent(videos[i].url),{cache:"no-store"});const data=await r.json();if(!r.ok||!data.video)throw new Error(data.message||"Falha");const current=active();if(current&&current.videos[videos[i].id]){if(data.profile)current.profile=data.profile;current.videos[data.video.id]=data.video;if(String(data.video.id)!==String(videos[i].id))delete current.videos[videos[i].id]}ok++}catch(e){failed++}
 }
 save();render();out.textContent=ok+" atualizado"+(ok===1?"":"s")+(failed?" · "+(failed===1?"1 falhou":failed+" falharam"):"");
 btn.disabled=false;btn.textContent="Atualizar todos";
}
$("refreshAllBtn").onclick=refreshAllVideos;
$("analyzeBtn").onclick=()=>analyze($("videoUrl").value);$("videoUrl").addEventListener("keydown",e=>{if(e.key==="Enter")analyze(e.target.value)});
let currentView="overview";
function showView(key){
 if(!document.querySelector('[data-view="'+key+'"]'))key="overview";
 currentView=key;
 document.querySelectorAll("[data-view]").forEach(v=>v.classList.toggle("active",v.dataset.view===key));
 setNavActive("[data-nav]",key,"data-nav");setNavActive("[data-mobile-nav]",key,"data-mobile-nav");
 window.scrollTo({top:0,behavior:"auto"});
}
function setNavActive(selector,key,attribute){document.querySelectorAll(selector).forEach(btn=>btn.classList.toggle("active",btn.getAttribute(attribute)===key))}
document.querySelectorAll("[data-nav]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.nav));
document.querySelectorAll("[data-mobile-nav]").forEach(btn=>btn.onclick=()=>showView(btn.dataset.mobileNav));
document.querySelectorAll("[data-profile-tab]").forEach(btn=>btn.onclick=()=>{const key=btn.dataset.profileTab;document.querySelectorAll("[data-profile-tab]").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll("[data-profile-pane]").forEach(x=>x.classList.toggle("active",x.dataset.profilePane===key))});
$("detailClose").onclick=closeDetailModal;$("detailX").onclick=closeDetailModal;$("detailOpen").onclick=()=>{if(detailVideo)window.open(detailVideo.url,"_blank","noopener,noreferrer")};$("detailUpdate").onclick=async()=>{if(detailVideo){await analyze(detailVideo.url,true);closeDetailModal()}};$("detailRemove").onclick=()=>{if(!detailVideo)return;const p=active();delete p.videos[detailVideo.id];save();render();closeDetailModal()};
const modal=$("modal");function openModal(){lockPageScroll();modal.classList.add("show");setTimeout(()=>$("multiUrls").focus(),50)}$("desktopMultiBtn").onclick=openModal;$("mobileAdd").onclick=openModal;$("closeModal").onclick=closeAddModal;$("multiUrls").oninput=e=>{const n=e.target.value.split(/\\n+/).map(x=>x.trim()).filter(Boolean).length;$("linkCount").textContent=n+" link"+(n===1?"":"s")+" encontrado"+(n===1?"":"s")};$("analyzeMany").onclick=async()=>{const urls=$("multiUrls").value.split(/\\n+/).map(x=>x.trim()).filter(Boolean);$("analyzeMany").disabled=true;for(let i=0;i<urls.length;i++){ $("linkCount").textContent="Analisando "+(i+1)+" de "+urls.length+"…";await analyze(urls[i],true)}$("analyzeMany").disabled=false;$("multiUrls").value="";$("linkCount").textContent="Concluído: "+urls.length+" vídeo"+(urls.length===1?"":"s");setTimeout(closeAddModal,500)};
showView("overview");
$("detailModal").addEventListener("click",e=>{if(e.target===$("detailModal"))closeDetailModal()});
modal.addEventListener("click",e=>{if(e.target===modal)closeAddModal()});
let lastTouchEnd=0;document.addEventListener("gesturestart",e=>e.preventDefault(),{passive:false});document.addEventListener("touchend",e=>{if(e.target.closest("button,input,textarea,a"))return;const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now},{passive:false});render();

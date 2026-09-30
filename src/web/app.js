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
 $("mEng").textContent=list.length?(list.reduce((s,v)=>s+engagement(v),0)/list.length*100).toFixed(2)+"%":"—";
 $("sampleText").textContent=list.length?"Baseado em "+list.length+" vídeo"+(list.length===1?"":"s")+" adicionado"+(list.length===1?"":"s")+" ao sistema.":"Adicione um vídeo para começar.";
 $("videosAnalyzedCount").textContent=list.length+" vídeo"+(list.length===1?"":"s")+" analisado"+(list.length===1?"":"s");renderChart(list);renderInsights(list);renderVideos(list);syncLegacyProfileStats()
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
function focusVideoFromChart(id){showView("profile");requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=document.querySelector('.video[data-video-id="'+CSS.escape(String(id))+'"]');if(!target)return;document.querySelectorAll(".video.chart-target").forEach(x=>x.classList.remove("chart-target"));target.classList.add("chart-target");target.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>target.classList.remove("chart-target"),2200)}))}
function videoUpdateMeta(v){const u=v.update||{};const time=x=>new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(x));if(u.status==="fresh"&&u.lastSuccessAt)return{cls:"fresh",text:"✓ Atualizado · "+time(u.lastSuccessAt)};if(u.lastSuccessAt)return{cls:"stale",text:"• Última atualização · "+time(u.lastSuccessAt)};if(u.importedAt)return{cls:"imported",text:"• Dados importados do PC"};return{cls:"indexed",text:"• Indexado"}}
function renderVideos(list){const el=$("videos");el.innerHTML="";if(!list.length){el.innerHTML='<div class="empty">Nenhum vídeo salvo ainda.<br>Use o botão + para adicionar.</div>';return}[...list].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).forEach(v=>{const card=document.createElement("article");card.className="video";card.dataset.videoId=String(v.id);const um=videoUpdateMeta(v);card.innerHTML='<img class="cover" src="'+(v.coverUrl||"")+'" alt=""><div class="vbody"><div class="stats"><div class="stat"><small>Views</small><b>'+fmt(v.metrics?.views)+'</b></div><div class="stat"><small>Eng.</small><b>'+(engagement(v)*100).toFixed(2)+'%</b></div></div><div class="video-update '+um.cls+'">'+um.text+'</div></div>';card.onclick=()=>openVideoDetail(v);el.append(card)})}
async function analyze(url,quiet=false){
 url=String(url||"").trim();
 if(!url)return false;
 try{
  const r=await fetch("/api/video?url="+encodeURIComponent(url),{cache:"no-store"});
  const text=await r.text();let data;
  try{data=JSON.parse(text)}catch{throw new Error("Resposta inválida do servidor")}
  if(!r.ok||!data.video)throw new Error(data.message||"Não foi possível analisar o vídeo");
  const profile=data.profile||{id:data.input.username,username:data.input.username};
  const key=profile.id||profile.username;
  if(!state.profiles[key])state.profiles[key]={profile,videos:{}};
  state.profiles[key].profile=profile;
  state.profiles[key].videos[data.video.id]={...data.video,update:{status:"fresh",source:"LIVE",lastAttemptAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),lastError:null}};
  state.active=key;save();render();
  if(!quiet)setTimeout(()=>showView("profile"),100);
  return true;
 }catch(e){
  if(!quiet){const out=$("linkCount");if(out)out.textContent="Erro: "+(e&&e.message?e.message:"Falha ao analisar o vídeo")}
  return false;
 }
}
async function refreshAllVideos(){const p=active(),videos=p?Object.values(p.videos):[],btn=$("refreshAllBtn"),out=$("refreshAllStatus");if(!videos.length){out.textContent="Nenhum vídeo para atualizar.";return}btn.disabled=true;btn.textContent="Atualizando…";let ok=0,failed=0;for(let i=0;i<videos.length;i++){const original=videos[i],attemptAt=new Date().toISOString();out.textContent="Atualizando "+(i+1)+" de "+videos.length+"…";try{const r=await fetch("/api/video?url="+encodeURIComponent(original.url),{cache:"no-store"});const data=await r.json();if(!r.ok||!data.video)throw new Error(data.message||"Falha");const current=active();if(current&&current.videos[original.id]){if(data.profile)current.profile=data.profile;const previous=current.videos[original.id];current.videos[data.video.id]={...previous,...data.video,update:{...(previous.update||{}),status:"fresh",source:"LIVE",lastAttemptAt:attemptAt,lastSuccessAt:attemptAt,lastError:null}};if(String(data.video.id)!==String(original.id))delete current.videos[original.id]}ok++}catch(err){const current=active();if(current&&current.videos[original.id])current.videos[original.id]={...current.videos[original.id],update:{...(current.videos[original.id].update||{}),status:"stale",lastAttemptAt:attemptAt,lastError:err?.message||"Falha"}};failed++}save();render()}out.textContent=ok+" atualizado"+(ok===1?"":"s")+(failed?" · "+failed+" não atualizado"+(failed===1?"":"s"):"");btn.disabled=false;btn.textContent="Atualizar todos";}
$("refreshAllBtn").onclick=refreshAllVideos;
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
$("detailClose").onclick=closeDetailModal;$("detailX").onclick=closeDetailModal;$("detailOpen").onclick=()=>{if(detailVideo)window.open(detailVideo.url,"_blank","noopener,noreferrer")};$("detailUpdate").onclick=async()=>{if(detailVideo){await analyze(detailVideo.url,true);closeDetailModal()}};$("detailRemove").onclick=()=>{if(!detailVideo)return;const p=active();delete p.videos[detailVideo.id];save();render();closeDetailModal()};
function collectImportVideos(root){const found=new Map(),seen=new Set();function walk(v){if(!v||typeof v!=="object"||seen.has(v))return;seen.add(v);if(!Array.isArray(v)){const id=String(v.id??v.itemId??v.aweme_id??"");const st=v.statsV2??v.stats??v.statistics;if(/^\d{10,}$/.test(id)&&st){const author=v.author??{},username=author.uniqueId??author.unique_id??root?.profile?.username??root?.input?.username??"",n=x=>Number(x)||0,video=v.video??{};found.set(id,{id,url:username?"https://www.tiktok.com/@"+username+"/video/"+id:(v.url||""),description:v.desc??v.description??"",createdAt:v.createTime?new Date(n(v.createTime)*1000).toISOString():(v.createdAt||null),durationSeconds:n(video.duration??v.durationSeconds),coverUrl:video.cover??video.dynamicCover??video.originCover??v.coverUrl??null,metrics:{views:n(st.playCount??st.play_count??st.views),likes:n(st.diggCount??st.digg_count??st.likes),comments:n(st.commentCount??st.comment_count??st.comments),shares:n(st.shareCount??st.share_count??st.shares),saves:n(st.collectCount??st.collect_count??st.saves)}})}}Object.values(v).forEach(walk)}walk(root);return [...found.values()]}
function importJsonData(data){const videos=collectImportVideos(data);if(!videos.length)throw new Error("Nenhum vídeo com ID e métricas encontrado.");const m=videos[0].url.match(/@([^/]+)\/video/),username=data?.profile?.username??data?.profile?.uniqueId??m?.[1]??"perfil-importado",profile=data.profile?.username?data.profile:{id:String(data?.profile?.id??username),username,nickname:data?.profile?.nickname??username,avatarUrl:data?.profile?.avatarUrl??null,bio:data?.profile?.bio??null,stats:data?.profile?.stats??null},key=profile.id||profile.username,now=new Date().toISOString();if(!state.profiles[key])state.profiles[key]={profile,videos:{}};let added=0,updated=0;for(const v of videos){const old=state.profiles[key].videos[v.id];old?updated++:added++;state.profiles[key].videos[v.id]={...(old||{}),...v,update:{...(old?.update||{}),status:old?.update?.lastSuccessAt?"stale":"imported",source:"PC_JSON",importedAt:now}}}state.active=key;save();render();return{total:videos.length,added,updated}}
const jsonImportBtn=$("jsonImportBtn");if(jsonImportBtn)jsonImportBtn.onclick=()=>jsonImport?.click();
const jsonImport=$("jsonImport");if(jsonImport)jsonImport.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const out=$("jsonImportStatus");try{const x=importJsonData(JSON.parse(await f.text()));out.textContent=x.total+" indexados · "+x.added+" novos · "+x.updated+" mesclados";showView("profile")}catch(err){out.textContent="Falha no JSON: "+(err?.message||"arquivo inválido")}finally{e.target.value=""}};
const modal=$("modal");
function openModal(){
 lockPageScroll();modal.classList.add("show");
 const field=$("multiUrls");if(field)setTimeout(()=>field.focus(),50);
}
const mobileAdd=$("mobileAdd");if(mobileAdd)mobileAdd.onclick=openModal;
const desktopAdd=$("desktopAdd");if(desktopAdd)desktopAdd.onclick=openModal;
$("closeModal").onclick=closeAddModal;
$("multiUrls").oninput=e=>{const n=e.target.value.split(/\n+/).map(x=>x.trim()).filter(Boolean).length;$("linkCount").textContent=n+" link"+(n===1?"":"s")+" encontrado"+(n===1?"":"s")};
$("analyzeMany").onclick=async()=>{
 const urls=$("multiUrls").value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 if(!urls.length){$("linkCount").textContent="Cole pelo menos uma URL do TikTok.";return}
 $("analyzeMany").disabled=true;let ok=0,failed=0;
 for(let i=0;i<urls.length;i++){
  $("linkCount").textContent="Analisando "+(i+1)+" de "+urls.length+"…";
  (await analyze(urls[i],true))?ok++:failed++;
 }
 $("analyzeMany").disabled=false;
 $("multiUrls").value="";
 $("linkCount").textContent=ok+" analisado"+(ok===1?"":"s")+(failed?" · "+failed+" falhou"+(failed===1?"":"ram"):"");
 if(ok&&failed===0)setTimeout(()=>{closeAddModal();showView("profile")},500);
};
showView("overview");
$("detailModal").addEventListener("click",e=>{if(e.target===$("detailModal"))closeDetailModal()});
modal.addEventListener("click",e=>{if(e.target===modal)closeAddModal()});
let lastTouchEnd=0;document.addEventListener("gesturestart",e=>e.preventDefault(),{passive:false});document.addEventListener("touchend",e=>{if(e.target.closest("button,input,textarea,a"))return;const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now},{passive:false});render();

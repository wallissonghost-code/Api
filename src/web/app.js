const STORE="tikanalise:v1";let state={profiles:{},active:null};try{const saved=localStorage.getItem(STORE);if(saved){const parsed=JSON.parse(saved);if(parsed&&parsed.profiles)state=parsed}}catch(e){console.warn("Storage indisponível",e)}
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat("pt-BR",{notation:n>=10000?"compact":"standard",maximumFractionDigits:1}).format(n||0);
const engagement=v=>{if(Number.isFinite(v?.derived?.engagementRate))return v.derived.engagementRate;const m=v?.metrics||{},views=m.views||0;return views?((m.likes||0)+(m.comments||0)+(m.shares||0)+(m.saves||0))/views:0};
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){console.warn("Não foi possível salvar localmente",e)}}
function active(){return state.active?state.profiles[state.active]:null}
function normUser(v){return String(v||"").trim().replace(/^@/,"").toLowerCase()}
function resolveProfileKey(profile={}){
 const id=String(profile.id||"").trim(),username=normUser(profile.username);
 const matches=Object.entries(state.profiles).filter(([key,p])=>{
  const pp=p?.profile||{};
  return (id&&String(key)===id)||(id&&String(pp.id||"")===id)||(username&&normUser(key)===username)||(username&&normUser(pp.username)===username);
 });
 const canonical=id||username||matches[0]?.[0];
 if(!canonical)return null;
 if(!state.profiles[canonical])state.profiles[canonical]={profile:{...profile},videos:{}};
 for(const [oldKey,old] of matches){
  if(oldKey===canonical)continue;
  state.profiles[canonical].profile={...(old.profile||{}),...(state.profiles[canonical].profile||{}),...profile};
  state.profiles[canonical].videos={...(old.videos||{}),...(state.profiles[canonical].videos||{})};
  delete state.profiles[oldKey];
 }
 state.profiles[canonical].profile={...(state.profiles[canonical].profile||{}),...profile};
 state.profiles[canonical].videos=state.profiles[canonical].videos||{};
 if(state.active&&matches.some(([k])=>k===state.active))state.active=canonical;
 return canonical;
}

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
function renderInsights(list){
 const sample=$("insightsSample"),kpis=$("insightsKpis"),bars=$("insightsBars"),duration=$("insightsDuration"),hashtags=$("insightsHashtags"),top=$("insightsTop");
 if(!sample||!kpis||!bars||!duration||!hashtags||!top)return;
 sample.textContent=list.length+" vídeo"+(list.length===1?"":"s")+" na amostra";
 const sums=list.reduce((a,v)=>{const m=v.metrics||{};a.views+=m.views||0;a.likes+=m.likes||0;a.comments+=m.comments||0;a.shares+=m.shares||0;return a},{views:0,likes:0,comments:0,shares:0});
 const avgEng=list.length?list.reduce((n,v)=>n+engagement(v),0)/list.length:0;
 const cards=[["Visualizações",fmt(sums.views)],["Curtidas",fmt(sums.likes)],["Comentários",fmt(sums.comments)],["Compartilhamentos",fmt(sums.shares)],["Engajamento médio",list.length?(avgEng*100).toFixed(2).replace(".",",")+"%":"—"],["Vídeos",String(list.length)]];
 kpis.innerHTML=cards.map(([label,value])=>'<div class="insights-kpi"><span>'+label+'</span><strong>'+value+'</strong></div>').join("");
 if(!list.length){bars.innerHTML=duration.innerHTML=hashtags.innerHTML=top.innerHTML='<div class="insights-empty">Adicione vídeos para montar o dashboard.</div>';return}
 const ranked=[...list].sort((a,b)=>(b.metrics?.views||0)-(a.metrics?.views||0)),maxViews=Math.max(ranked[0]?.metrics?.views||0,1);
 bars.innerHTML=ranked.slice(0,10).map((v,i)=>'<button class="insights-bar-row" data-insight-video="'+String(v.id)+'"><span class="insights-rank">'+(i+1)+'</span><span class="insights-bar-name">'+escapeInsight(v.description||("Vídeo "+(i+1)))+'</span><span class="insights-bar-track"><i style="width:'+Math.max(2,(v.metrics?.views||0)/maxViews*100)+'%"></i></span><b>'+fmt(v.metrics?.views||0)+'</b></button>').join("");
 bars.querySelectorAll("[data-insight-video]").forEach(btn=>btn.onclick=()=>{const v=list.find(x=>String(x.id)===btn.dataset.insightVideo);if(v)openVideoDetail(v)});
 const groups=[{label:"0–15s",min:0,max:15},{label:"16–30s",min:16,max:30},{label:"31–60s",min:31,max:60},{label:"+60s",min:61,max:Infinity}].map(g=>{const vs=list.filter(v=>{const d=Number(v.durationSeconds)||0;return d>=g.min&&d<=g.max});return{...g,count:vs.length,views:vs.reduce((n,v)=>n+(v.metrics?.views||0),0),avg:vs.length?vs.reduce((n,v)=>n+(v.metrics?.views||0),0)/vs.length:0}});
 const maxAvg=Math.max(...groups.map(g=>g.avg),1);
 duration.innerHTML=groups.map(g=>'<div class="insights-progress"><div><b>'+g.label+'</b><span>'+g.count+' vídeo'+(g.count===1?"":"s")+' · média '+fmt(g.avg)+' views</span></div><div class="insights-progress-track"><i style="width:'+(g.count?Math.max(3,g.avg/maxAvg*100):0)+'%"></i></div></div>').join("");
 const tagMap=new Map();for(const v of list){for(const raw of v.hashtags||[]){const tag=String(raw).toLowerCase();const x=tagMap.get(tag)||{count:0,views:0};x.count++;x.views+=v.metrics?.views||0;tagMap.set(tag,x)}}
 const tags=[...tagMap.entries()].sort((a,b)=>b[1].views-a[1].views).slice(0,8),maxTag=Math.max(tags[0]?.[1].views||0,1);
 hashtags.innerHTML=tags.length?tags.map(([tag,x])=>'<div class="insights-progress"><div><b>#'+escapeInsight(tag)+'</b><span>'+x.count+' vídeo'+(x.count===1?"":"s")+' · '+fmt(x.views)+' views</span></div><div class="insights-progress-track"><i style="width:'+Math.max(3,x.views/maxTag*100)+'%"></i></div></div>').join(""):'<div class="insights-empty">Sem hashtags identificadas na amostra.</div>';
 top.innerHTML=ranked.slice(0,5).map((v,i)=>{const m=v.metrics||{},d=Number(v.durationSeconds)||0,dur=d?Math.floor(d/60)+":"+String(d%60).padStart(2,"0"):"—";return '<button class="insights-top-row" data-top-video="'+String(v.id)+'"><span class="insights-rank">'+(i+1)+'</span>'+(v.coverUrl?'<img src="'+v.coverUrl+'" alt="">':'<span class="insights-thumb"></span>')+'<span class="insights-top-copy"><b>'+escapeInsight(v.description||"Sem legenda")+'</b><small>'+dur+' · '+(v.hashtags||[]).slice(0,3).map(t=>"#"+t).join(" ")+'</small></span><span class="insights-top-metrics"><b>'+fmt(m.views)+' views</b><small>'+fmt(m.likes)+' curtidas · '+fmt(m.comments)+' comentários</small></span></button>'}).join("");
 top.querySelectorAll("[data-top-video]").forEach(btn=>btn.onclick=()=>{const v=list.find(x=>String(x.id)===btn.dataset.topVideo);if(v)openVideoDetail(v)});
}
function escapeInsight(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
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
  const key=resolveProfileKey(profile);
  if(!key)throw new Error("Não foi possível identificar o perfil");
  state.profiles[key].videos[data.video.id]={...data.video,update:{status:"fresh",source:"LIVE",lastAttemptAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),lastError:null}};
  state.active=key;save();render();
  if(!quiet)setTimeout(()=>showView("profile"),100);
  return true;
 }catch(e){
  if(!quiet){const out=$("linkCount");if(out)out.textContent="Erro: "+(e&&e.message?e.message:"Falha ao analisar o vídeo")}
  return false;
 }
}
async function refreshAllVideos(){const p=active(),btn=$("refreshAllBtn"),out=$("refreshAllStatus");if(!p){out.textContent="Nenhum perfil carregado.";return}const username=normUser(p.profile?.username);let videos=Object.values(p.videos||{}),discovered=0,discoveryFailed=false;btn.disabled=true;btn.textContent="Atualizando…";if(username){out.textContent="Procurando vídeos recentes…";try{const r=await fetch("/api/profile/recent?username="+encodeURIComponent(username),{cache:"no-store"}),data=await r.json();if(!r.ok)throw new Error(data.message||"Falha na descoberta");const known=new Set(videos.map(v=>String(v.id)));for(const candidate of data.videos||[]){if(!known.has(String(candidate.id))){videos.push({...candidate,discovered:true});known.add(String(candidate.id));discovered++}}}catch(e){discoveryFailed=true;console.warn("Descoberta de vídeos recentes indisponível",e)}}if(!videos.length){out.textContent=discoveryFailed?"Não foi possível descobrir vídeos recentes.":"Nenhum vídeo encontrado.";btn.disabled=false;btn.textContent="Atualizar todos";return}let ok=0,failed=0,added=0;for(let i=0;i<videos.length;i++){const original=videos[i],attemptAt=new Date().toISOString();out.textContent=(discovered?"Encontrados "+discovered+" novo"+(discovered===1?"":"s")+" · ":"")+"Atualizando "+(i+1)+" de "+videos.length+"…";try{const r=await fetch("/api/video?url="+encodeURIComponent(original.url),{cache:"no-store"}),data=await r.json();if(!r.ok||!data.video)throw new Error(data.message||"Falha");const profile=data.profile||p.profile,key=resolveProfileKey(profile),current=state.profiles[key];if(!current)throw new Error("Perfil não encontrado");const previous=current.videos[data.video.id]||(!original.discovered?current.videos[original.id]:null)||{};current.videos[data.video.id]={...previous,...data.video,update:{...(previous.update||{}),status:"fresh",source:original.discovered?"EMBED+LIVE":"LIVE",discoveredAt:original.discovered?attemptAt:(previous.update?.discoveredAt||null),lastAttemptAt:attemptAt,lastSuccessAt:attemptAt,lastError:null}};if(!original.discovered&&String(data.video.id)!==String(original.id))delete current.videos[original.id];state.active=key;if(original.discovered)added++;ok++}catch(err){if(!original.discovered){const current=active();if(current&&current.videos[original.id])current.videos[original.id]={...current.videos[original.id],update:{...(current.videos[original.id].update||{}),status:"stale",lastAttemptAt:attemptAt,lastError:err?.message||"Falha"}}}failed++}save();render()}let parts=[];if(added)parts.push(added+" novo"+(added===1?"":"s")+" adicionado"+(added===1?"":"s"));parts.push(ok+" atualizado"+(ok===1?"":"s"));if(failed)parts.push(failed+" não atualizado"+(failed===1?"":"s"));if(discoveryFailed)parts.push("descoberta recente indisponível");out.textContent=parts.join(" · ");btn.disabled=false;btn.textContent="Atualizar todos";}
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
function importJsonData(data){const videos=collectImportVideos(data);if(!videos.length)throw new Error("Nenhum vídeo com ID e métricas encontrado.");const m=videos[0].url.match(/@([^/]+)\/video/),username=data?.profile?.username??data?.profile?.uniqueId??m?.[1]??"perfil-importado",profile=data.profile?.username?data.profile:{id:String(data?.profile?.id??username),username,nickname:data?.profile?.nickname??username,avatarUrl:data?.profile?.avatarUrl??null,bio:data?.profile?.bio??null,stats:data?.profile?.stats??null},key=resolveProfileKey(profile),now=new Date().toISOString();if(!key)throw new Error("Não foi possível identificar o perfil do JSON.");let added=0,updated=0;for(const v of videos){const old=state.profiles[key].videos[v.id];old?updated++:added++;state.profiles[key].videos[v.id]={...(old||{}),...v,update:{...(old?.update||{}),status:old?.update?.lastSuccessAt?"stale":"imported",source:"PC_JSON",importedAt:now}}}state.active=key;save();render();return{total:videos.length,added,updated}}
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

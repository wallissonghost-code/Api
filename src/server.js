import http from "node:http";
import { readFileSync } from "node:fs";
import { ENGINE_VERSION, ENGINE_VERSION_LABEL } from "./version.js";
import { inspectPublicTikTokVideo } from "./providers/tiktok-public.js";

const PORT = Number(process.env.PORT || 3000);
const ROOT = new URL("./web/", import.meta.url);
const APP_ICON = readFileSync(new URL("../public/app-icon.png", import.meta.url));
const CSS = readFileSync(new URL("styles.css", ROOT), "utf8");
const APP_JS = readFileSync(new URL("app.js", ROOT), "utf8");
const VIEWS = {
  overview: readFileSync(new URL("views/overview.html", ROOT), "utf8"),
  insights: readFileSync(new URL("views/insights.html", ROOT), "utf8"),
  profile: readFileSync(new URL("views/profile.html", ROOT), "utf8"),
  maintenance: readFileSync(new URL("views/maintenance.html", ROOT), "utf8"),
  videos: readFileSync(new URL("views/videos.html", ROOT), "utf8")
};
const PAGE = readFileSync(new URL("index.html", ROOT), "utf8")
  .replace("__ENGINE_VERSION_LABEL__", ENGINE_VERSION_LABEL)
  .replace("__OVERVIEW_VIEW__", VIEWS.overview)
  .replace("__INSIGHTS_VIEW__", VIEWS.insights)
  .replace("__MAINTENANCE_VIEW__", VIEWS.maintenance)
  .replace("__PROFILE_VIEW__", VIEWS.profile.replace("__VIDEOS_VIEW__", VIEWS.videos));

function send(res,status,type,body,extra={}){res.writeHead(status,{"content-type":type,...extra});res.end(body)}
function sendJson(res,status,body){send(res,status,"application/json; charset=utf-8",JSON.stringify(body,null,2),{"access-control-allow-origin":"*"})}

const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
 if(req.method==="GET"&&url.pathname==="/")return send(res,200,"text/html; charset=utf-8",PAGE);
 if(req.method==="GET"&&url.pathname==="/assets/styles.css")return send(res,200,"text/css; charset=utf-8",CSS,{"cache-control":"no-cache"});
 if(req.method==="GET"&&url.pathname==="/assets/app.js")return send(res,200,"text/javascript; charset=utf-8",APP_JS,{"cache-control":"no-cache"});
 if(req.method==="GET"&&url.pathname==="/app-icon.png")return send(res,200,"image/png",APP_ICON,{"content-length":APP_ICON.length,"cache-control":"public, max-age=3600"});
 if(req.method==="GET"&&url.pathname==="/health")return sendJson(res,200,{ok:true,service:"tiktok-plus-engine",engineVersion:ENGINE_VERSION});
 if(req.method==="GET"&&url.pathname==="/api/tiktok-vercel-probe"){
  const username=(url.searchParams.get("username")||"oopedrogames").replace(/^@/,"").trim();
  const videoId=url.searchParams.get("video")||"7690154508063690036";
  const headers={"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36","accept-language":"pt-BR,pt;q=0.9,en;q=0.8","accept":"text/html,application/xhtml+xml"};
  const inspectHtml=async(target,kind)=>{
   const response=await fetch(target,{headers});const body=await response.text();
   const marker='id="__UNIVERSAL_DATA_FOR_REHYDRATION__"',markerIndex=body.indexOf(marker);
   let universalBytes=0,defaultScopeKeys=[],itemStruct=null,userDetail=false;
   if(markerIndex>=0){const start=body.indexOf(">",markerIndex)+1,end=body.indexOf("</script>",start);if(start>0&&end>start){const raw=body.slice(start,end);universalBytes=raw.length;try{const parsed=JSON.parse(raw),scope=parsed?.__DEFAULT_SCOPE__||{};defaultScopeKeys=Object.keys(scope);itemStruct=scope["webapp.video-detail"]?.itemInfo?.itemStruct||null;userDetail=!!scope["webapp.user-detail"]}catch{}}}
   return {kind,status:response.status,bytes:Buffer.byteLength(body),universalBytes,defaultScopeKeys,userDetail,itemStructPresent:!!itemStruct,itemId:itemStruct?.id||null,stats:itemStruct?.stats||null};
  };
  try{
   const profile=await inspectHtml("https://www.tiktok.com/@"+encodeURIComponent(username)+"?lang=pt-BR","PROFILE_HTML");
   const video=await inspectHtml("https://www.tiktok.com/@"+encodeURIComponent(username)+"/video/"+encodeURIComponent(videoId)+"?lang=pt-BR","VIDEO_HTML");
   let list={kind:"POST_LIST",attempted:false};
   const candidates=[
    "https://www.tiktok.com/api/post/item_list/?WebIdLastTime=0&aid=1988&app_language=pt-BR&app_name=tiktok_web&browser_language=pt-BR&browser_name=Mozilla&browser_online=true&browser_platform=Win32&channel=tiktok_web&count=35&cursor=0&device_id=0&device_platform=web_pc&focus_state=true&from_page=user&history_len=2&is_fullscreen=false&is_page_visible=true&language=pt-BR&os=windows&priority_region=BR&referer=&region=BR&screen_height=1080&screen_width=1920&tz_name=America%2FSao_Paulo&user_is_login=false&webcast_language=pt-BR&secUid=MS4wLjABAAAAn4mZUWTPklg9gthwZnprEsQwjRuuO-PfCZzata_iSbs63R3302oh22fo6fwjm71k"
   ];
   for(const target of candidates){try{const r=await fetch(target,{headers:{...headers,accept:"application/json, text/plain, */*","referer":"https://www.tiktok.com/@"+username}});const textBody=await r.text();let parsed=null;try{parsed=JSON.parse(textBody)}catch{};list={kind:"POST_LIST",attempted:true,status:r.status,bytes:Buffer.byteLength(textBody),jsonParsed:!!parsed,itemCount:Array.isArray(parsed?.itemList)?parsed.itemList.length:null,hasMore:parsed?.hasMore??null,cursor:parsed?.cursor??null,errorCode:parsed?.statusCode??null};break}catch(error){list={kind:"POST_LIST",attempted:true,error:error instanceof Error?error.message:String(error)}}}
   return sendJson(res,200,{ok:true,probe:"VERCEL_TIKTOK_BATTERY",username,videoId,serverRegion:process.env.VERCEL_REGION||null,profile,video,list});
  }catch(error){return sendJson(res,502,{ok:false,probe:"VERCEL_TIKTOK_BATTERY",message:error instanceof Error?error.message:String(error),serverRegion:process.env.VERCEL_REGION||null})}
 }
 if(req.method==="GET"&&url.pathname==="/api/video"){
  const videoUrl=url.searchParams.get("url");let timeout;
  try{const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),15000);const result=await inspectPublicTikTokVideo(videoUrl,{signal:controller.signal});return sendJson(res,200,{schemaVersion:1,engineVersion:ENGINE_VERSION,...result})}
  catch(error){const message=error instanceof Error?error.message:"Unknown error";const status=/invalid|must contain|required/i.test(message)?400:502;return sendJson(res,status,{ok:false,error:status===400?"INVALID_VIDEO_URL":"COLLECTION_FAILED",message})}
  finally{if(timeout)clearTimeout(timeout)}
 }
 return sendJson(res,404,{ok:false,error:"NOT_FOUND"});
});
server.listen(PORT,()=>console.log(`TikTok Plus Engine listening on :${PORT}`));

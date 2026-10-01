import http from "node:http";
import { readFileSync } from "node:fs";
import { ENGINE_VERSION, ENGINE_VERSION_LABEL } from "./version.js";
import { inspectPublicTikTokVideo, discoverPublicTikTokVideos } from "./providers/tiktok-public.js";

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
 if(req.method==="GET"&&url.pathname==="/api/profile/recent"){
  const username=url.searchParams.get("username");let timeout;
  try{const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),12000);const result=await discoverPublicTikTokVideos(username,{signal:controller.signal});return sendJson(res,200,{schemaVersion:1,engineVersion:ENGINE_VERSION,...result})}
  catch(error){const message=error instanceof Error?error.message:"Unknown error";const status=/username|required/i.test(message)?400:502;return sendJson(res,status,{ok:false,error:status===400?"INVALID_USERNAME":"DISCOVERY_FAILED",message})}
  finally{if(timeout)clearTimeout(timeout)}
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

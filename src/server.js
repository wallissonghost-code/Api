import http from "node:http";
import { analyzeProfile } from "./services/profile-analysis.js";

const PORT = Number(process.env.PORT || 3000);

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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Teste TikTok Engine</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b0b0c;color:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;padding:24px}
main{max-width:760px;margin:8vh auto}h1{font-size:28px;margin:0 0 8px}p{color:#999;margin:0 0 24px}.title{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.version{font-size:12px;font-weight:700;color:#999;background:#171719;border:1px solid #2d2d30;border-radius:999px;padding:4px 8px;letter-spacing:.03em}
form{display:flex;gap:10px}input{flex:1;min-width:0;background:#151517;border:1px solid #333;border-radius:12px;padding:15px;color:#fff;font-size:16px;outline:none}
button{border:0;border-radius:12px;padding:0 20px;font-weight:700;cursor:pointer}pre{margin-top:22px;background:#111113;border:1px solid #242426;border-radius:12px;padding:16px;overflow:auto;white-space:pre-wrap;word-break:break-word;min-height:100px;color:#ddd}
@media(max-width:520px){form{flex-direction:column}button{padding:15px}}
</style>
</head>
<body><main>
<div class="title"><h1>TikTok Engine</h1><span class="version">v0.0.2 beta</span></div>
<p>Página mínima para testar o motor. Digite um @ público.</p>
<form id="form"><input id="username" autocomplete="off" placeholder="@usuario" required><button>Analisar</button></form>
<pre id="out">Aguardando teste…</pre>
<script>
const form=document.getElementById("form"),input=document.getElementById("username"),out=document.getElementById("out");
form.addEventListener("submit",async e=>{
 e.preventDefault(); out.textContent="Coletando…";
 try{
  const r=await fetch("/api/profile?username="+encodeURIComponent(input.value.trim()));
  const data=await r.json(); out.textContent=JSON.stringify(data,null,2);
 }catch(err){out.textContent="Erro: "+err.message}
});
</script>
</main></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendHtml(res, TEST_PAGE);
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "tiktok-plus-engine" });
  }

  if (req.method === "GET" && url.pathname === "/api/profile") {
    const username = url.searchParams.get("username");
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 15_000);
      const result = await analyzeProfile(username, { signal: controller.signal });
      return sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = /username|required|invalid/i.test(message) ? 400 : 502;
      return sendJson(res, status, {
        ok: false,
        error: status === 400 ? "INVALID_USERNAME" : "COLLECTION_FAILED",
        message
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return sendJson(res, 404, { ok: false, error: "NOT_FOUND" });
});

server.listen(PORT, () => {
  console.log(`TikTok Plus Engine listening on :${PORT}`);
});

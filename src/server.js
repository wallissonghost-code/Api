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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "tiktok-plus-engine" });
  }

  if (req.method === "GET" && url.pathname === "/api/profile") {
    const username = url.searchParams.get("username");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const result = await analyzeProfile(username, { signal: controller.signal });
      clearTimeout(timeout);
      return sendJson(res, 200, result);
    } catch (error) {
      const status = /username|required|invalid/i.test(error.message) ? 400 : 502;
      return sendJson(res, status, {
        ok: false,
        error: status === 400 ? "INVALID_USERNAME" : "COLLECTION_FAILED",
        message: error.message
      });
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: "NOT_FOUND",
    endpoints: ["/health", "/api/profile?username=@usuario"]
  });
});

server.listen(PORT, () => {
  console.log(`TikTok Plus Engine listening on :${PORT}`);
});

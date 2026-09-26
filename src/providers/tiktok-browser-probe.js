import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

const TIKTOK_HOST = /(^|\.)tiktok\.com$/i;
const INTERESTING = /(item_list|post|video|feed|playlist|collection)/i;
const HARD_TIMEOUT_MS = 10_000;

function timeoutError(stage) {
  const error = new Error(`Browser probe timed out during ${stage}`);
  error.code = "BROWSER_PROBE_TIMEOUT";
  return error;
}

async function withTimeout(promise, ms, stage) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(stage)), ms); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeTikTokProfileBrowser(username) {
  const startedAt = Date.now();
  let browser;
  let context;
  let stage = "chromium-path";

  try {
    const executablePath = await withTimeout(chromium.executablePath(), 3000, stage);
    stage = "browser-launch";
    browser = await withTimeout(playwright.launch({
      args: chromium.args,
      executablePath,
      headless: true
    }), 4000, stage);

    stage = "browser-context";
    context = await browser.newContext({
      locale: "pt-BR",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    const requests = [];
    const responses = [];
    const postItems = new Map();

    page.on("request", (request) => {
      try {
        const url = new URL(request.url());
        if (!TIKTOK_HOST.test(url.hostname) || !INTERESTING.test(url.pathname)) return;
        requests.push({ method: request.method(), resourceType: request.resourceType(), path: url.pathname, queryKeys: [...url.searchParams.keys()].sort() });
      } catch {}
    });
    page.on("response", async (response) => {
      try {
        const url = new URL(response.url());
        if (!TIKTOK_HOST.test(url.hostname) || !INTERESTING.test(url.pathname)) return;
        const headers = await response.allHeaders();
        const meta = { status: response.status(), path: url.pathname, queryKeys: [...url.searchParams.keys()].sort(), contentType: headers["content-type"] || null, contentLength: Number(headers["content-length"] || 0) || null };
        if (url.pathname === "/api/post/item_list/" && response.ok()) {
          try {
            const body = await withTimeout(response.body(), 2500, "post-list-body");
            meta.bodyBytes = body.length;
            const text = body.toString("utf8");
            meta.bodyEmpty = !text.trim();
            meta.bodySample = text.slice(0, 240).replace(/[\r\n\t]+/g, " ");
            if (!text.trim()) {
              meta.bodyParsed = false;
              meta.bodyReadError = "empty-body";
            } else {
              try {
                const data = JSON.parse(text);
                const items = data?.itemList ?? data?.item_list ?? [];
                meta.bodyParsed = true;
                meta.topLevelKeys = data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [];
                meta.itemCount = Array.isArray(items) ? items.length : 0;
                meta.hasMore = data?.hasMore ?? data?.has_more ?? null;
                meta.cursor = data?.cursor ?? data?.maxCursor ?? data?.max_cursor ?? null;
                if (Array.isArray(items)) {
                  for (const item of items) {
                    const id = String(item?.id ?? item?.itemId ?? "");
                    if (/^\\d{10,}$/.test(id)) postItems.set(id, item);
                  }
                }
              } catch (parseError) {
                meta.bodyParsed = false;
                meta.bodyReadError = "invalid-json";
                meta.parseMessage = parseError instanceof Error ? parseError.message : "JSON parse failed";
              }
            }
          } catch (bodyError) {
            meta.bodyParsed = false;
            meta.bodyReadError = bodyError?.code === "BROWSER_PROBE_TIMEOUT" ? "body-timeout" : "body-unavailable";
            meta.bodyReadMessage = bodyError instanceof Error ? bodyError.message : "Response body unavailable";
          }
        }
        responses.push(meta);
      } catch {}
    });

    stage = "profile-navigation";
    await withTimeout(page.goto(`https://www.tiktok.com/@${encodeURIComponent(username)}`, { waitUntil: "domcontentloaded", timeout: 5000 }), 6000, stage);
    stage = "post-load-observation";
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight * 0.6, 1000)));
    await page.waitForTimeout(800);

    const videoLinks = await page.locator('a[href*="/video/"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.href).filter(Boolean))].slice(0, 50));
    const videoIds = [...new Set(videoLinks.map((url) => url.match(/\/video\/(\d{10,})/)?.[1]).filter(Boolean))];
    return {
      source: "tiktok-browser-probe", username, collectedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt, stage: "complete",
      page: { finalUrl: page.url(), title: await page.title(), videoLinkCount: videoLinks.length },
      videoIds: [...new Set([...videoIds, ...postItems.keys()])],
      videoLinks,
      items: [...postItems.values()],
      network: { requestCount: requests.length, responseCount: responses.length, requests, responses }
    };
  } catch (error) {
    error.probeStage = stage;
    error.probeDurationMs = Date.now() - startedAt;
    throw error;
  } finally {
    if (context) await withTimeout(context.close().catch(() => {}), 1000, "context-close").catch(() => {});
    if (browser) await withTimeout(browser.close().catch(() => {}), 1000, "browser-close").catch(() => {});
  }
}

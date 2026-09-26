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
        responses.push({ status: response.status(), path: url.pathname, queryKeys: [...url.searchParams.keys()].sort(), contentType: headers["content-type"] || null, contentLength: Number(headers["content-length"] || 0) || null });
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
      videoIds, videoLinks,
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

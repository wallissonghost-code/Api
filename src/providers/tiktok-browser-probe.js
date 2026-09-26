import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

const TIKTOK_HOST = /(^|\.)tiktok\.com$/i;
const INTERESTING = /(item_list|post|video|feed|playlist|collection)/i;

export async function probeTikTokProfileBrowser(username) {
  const browser = await playwright.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true
  });
  const context = await browser.newContext({
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const startedAt = Date.now();

  page.on("request", (request) => {
    try {
      const url = new URL(request.url());
      if (!TIKTOK_HOST.test(url.hostname) || !INTERESTING.test(url.pathname)) return;
      requests.push({
        method: request.method(),
        resourceType: request.resourceType(),
        path: url.pathname,
        queryKeys: [...url.searchParams.keys()].sort()
      });
    } catch {}
  });

  page.on("response", async (response) => {
    try {
      const url = new URL(response.url());
      if (!TIKTOK_HOST.test(url.hostname) || !INTERESTING.test(url.pathname)) return;
      const headers = await response.allHeaders();
      const length = Number(headers["content-length"] || 0);
      responses.push({
        status: response.status(),
        path: url.pathname,
        queryKeys: [...url.searchParams.keys()].sort(),
        contentType: headers["content-type"] || null,
        contentLength: Number.isFinite(length) ? length : null
      });
    } catch {}
  });

  try {
    await page.goto(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000
    });
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight * 0.6, 1000)));
    await page.waitForTimeout(2500);

    const videoLinks = await page.locator('a[href*="/video/"]').evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => node.href).filter(Boolean))].slice(0, 50)
    );
    const videoIds = [...new Set(videoLinks.map((url) => url.match(/\/video\/(\d{10,})/)?.[1]).filter(Boolean))];

    return {
      source: "tiktok-browser-probe",
      username,
      collectedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      page: { finalUrl: page.url(), title: await page.title(), videoLinkCount: videoLinks.length },
      videoIds,
      videoLinks,
      network: { requestCount: requests.length, responseCount: responses.length, requests, responses }
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

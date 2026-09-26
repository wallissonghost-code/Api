const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function collectVideoIds(value) {
  const ids = new Set();
  const scan = (text) => {
    if (!text) return;
    for (const match of String(text).matchAll(/(?:\\/video\\/|data-video-id=[\"'])(\\d{10,})/gi)) ids.add(match[1]);
  };
  const visit = (node, seen = new Set()) => {
    if (node == null) return;
    if (typeof node === "string") return scan(node);
    if (typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    for (const child of Object.values(node)) visit(child, seen);
  };
  visit(value);
  return [...ids];
}

export async function discoverTikTokCreatorEmbed(username, { signal } = {}) {
  const startedAt = Date.now();
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`;
  const response = await fetch(oembedUrl, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept": "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text.trim() ? JSON.parse(text) : null; } catch {}

  const ids = collectVideoIds(data ?? text);
  return {
    source: "tiktok-creator-oembed",
    ids,
    urls: ids.map((id) => `https://www.tiktok.com/@${username}/video/${id}`),
    diagnostic: {
      step: "creator-oembed",
      httpStatus: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      responseBytes: Buffer.byteLength(text),
      parsedJson: Boolean(data),
      type: data?.type ?? null,
      authorUrl: data?.author_url ?? null,
      htmlBytes: typeof data?.html === "string" ? Buffer.byteLength(data.html) : 0,
      videoIdCount: ids.length,
      videoIds: ids
    }
  };
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function findObject(root, predicate, seen = new Set()) {
  if (!root || typeof root !== "object" || seen.has(root)) return null;
  seen.add(root);
  if (predicate(root)) return root;
  for (const value of Object.values(root)) {
    const found = findObject(value, predicate, seen);
    if (found) return found;
  }
  return null;
}

function parseEmbeddedJson(html) {
  const patterns = [
    /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]+id=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try { return JSON.parse(match[1]); } catch {}
  }
  throw new Error("TikTok page did not expose a supported public data payload");
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractProfile(payload, username) {
  const user = findObject(payload, (obj) =>
    (obj.uniqueId || obj.unique_id) &&
    String(obj.uniqueId ?? obj.unique_id).toLowerCase() === username.toLowerCase()
  );
  return user ? {
    id: String(user.id ?? user.uid ?? ""),
    secUid: user.secUid ?? user.sec_uid ?? null,
    username: user.uniqueId ?? user.unique_id ?? username,
    nickname: user.nickname ?? null,
    avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? null,
    bio: user.signature ?? null,
    verified: Boolean(user.verified)
  } : { id: null, secUid: null, username, nickname: null, avatarUrl: null, bio: null, verified: false };
}

function extractItems(payload) {
  const found = new Map();
  const visit = (value, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (!Array.isArray(value) && (value.id || value.itemId) && (value.video || value.stats || value.statsV2)) {
      found.set(String(value.id ?? value.itemId), value);
    }
    for (const child of Object.values(value)) visit(child, seen);
  };
  visit(payload);
  return [...found.values()];
}

function mapItem(item, username) {
  const stats = item.statsV2 ?? item.stats ?? {};
  const video = item.video ?? {};
  const id = String(item.id ?? item.itemId);
  const text = item.desc ?? item.description ?? "";
  return {
    id,
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    description: text,
    hashtags: [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]),
    createdAt: item.createTime ? new Date(number(item.createTime) * 1000).toISOString() : null,
    durationSeconds: number(video.duration),
    coverUrl: video.cover ?? video.dynamicCover ?? video.originCover ?? null,
    metrics: {
      views: number(stats.playCount ?? stats.play_count),
      likes: number(stats.diggCount ?? stats.digg_count),
      comments: number(stats.commentCount ?? stats.comment_count),
      shares: number(stats.shareCount ?? stats.share_count),
      saves: number(stats.collectCount ?? stats.collect_count)
    }
  };
}

async function fetchProfileHtml(username, signal) {
  const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`TikTok profile responded with HTTP ${response.status}`);
  return response.text();
}

async function fetchPublicPostList(secUid, signal) {
  if (!secUid) return [];
  const params = new URLSearchParams({
    aid: "1988",
    app_name: "tiktok_web",
    device_platform: "web_pc",
    from_page: "user",
    count: "35",
    cursor: "0",
    secUid
  });
  const response = await fetch(`https://www.tiktok.com/api/post/item_list/?${params}`, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept": "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      "referer": "https://www.tiktok.com/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin"
    }
  });
  if (!response.ok) throw new Error(`TikTok post list responded with HTTP ${response.status}`);
  const text = await response.text();
  if (!text.trim()) throw new Error("TikTok post list returned an empty response");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("TikTok post list did not return JSON"); }
  return data.itemList ?? data.item_list ?? [];
}

export async function fetchPublicTikTokProfile(username, { signal } = {}) {
  const html = await fetchProfileHtml(username, signal);
  const payload = parseEmbeddedJson(html);
  const profile = extractProfile(payload, username);

  let items = extractItems(payload);
  let collectionMethod = "embedded-profile";
  let collectionDiagnostic = null;

  if (items.length === 0 && profile.secUid) {
    try {
      items = await fetchPublicPostList(profile.secUid, signal);
      collectionMethod = items.length ? "public-post-list" : "public-post-list-empty";
      if (!items.length) collectionDiagnostic = "TikTok returned no public posts to the server request";
    } catch (error) {
      collectionMethod = "profile-only";
      collectionDiagnostic = error instanceof Error ? error.message : "Public post-list request failed";
    }
  } else if (items.length === 0) {
    collectionDiagnostic = "Profile payload did not expose secUid or embedded posts";
  }

  const { secUid, ...publicProfile } = profile;
  return {
    source: "tiktok-public-web",
    collectionMethod,
    collectionDiagnostic,
    collectedAt: new Date().toISOString(),
    profile: publicProfile,
    videos: items.map((item) => mapItem(item, username))
  };
}

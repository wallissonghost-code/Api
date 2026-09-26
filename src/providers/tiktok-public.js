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
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try the next known payload.
    }
  }

  throw new Error("TikTok page did not expose a supported public data payload");
}

function extractItems(payload) {
  const arrays = [];
  const visit = (value, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      if (value.some((item) => item && typeof item === "object" && (item.id || item.itemId))) {
        arrays.push(value);
      }
      for (const item of value) visit(item, seen);
      return;
    }

    for (const child of Object.values(value)) visit(child, seen);
  };

  visit(payload);

  const candidates = arrays
    .flat()
    .filter((item) => item && typeof item === "object")
    .filter((item) => item.video || item.stats || item.statsV2)
    .filter((item) => item.id || item.itemId);

  return [...new Map(candidates.map((item) => [String(item.id ?? item.itemId), item])).values()];
}

function extractProfile(payload, username) {
  const user = findObject(payload, (obj) =>
    (obj.uniqueId || obj.unique_id) &&
    String(obj.uniqueId ?? obj.unique_id).toLowerCase() === username.toLowerCase()
  );

  return user
    ? {
        id: String(user.id ?? user.uid ?? ""),
        username: user.uniqueId ?? user.unique_id ?? username,
        nickname: user.nickname ?? null,
        avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? null,
        bio: user.signature ?? null,
        verified: Boolean(user.verified)
      }
    : { id: null, username, nickname: null, avatarUrl: null, bio: null, verified: false };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapItem(item, username) {
  const stats = item.statsV2 ?? item.stats ?? {};
  const video = item.video ?? {};
  const id = String(item.id ?? item.itemId);
  const text = item.desc ?? item.description ?? "";
  const hashtags = [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);

  return {
    id,
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    description: text,
    hashtags,
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

export async function fetchPublicTikTokProfile(username, { signal } = {}) {
  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const response = await fetch(url, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`TikTok responded with HTTP ${response.status}`);
  }

  const html = await response.text();
  const payload = parseEmbeddedJson(html);
  const videos = extractItems(payload).map((item) => mapItem(item, username));

  return {
    source: "tiktok-public-web",
    collectedAt: new Date().toISOString(),
    profile: extractProfile(payload, username),
    videos
  };
}

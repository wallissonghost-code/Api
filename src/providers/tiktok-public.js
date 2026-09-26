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
  const startedAt = Date.now();
  const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`TikTok profile responded with HTTP ${response.status}`);
  const html = await response.text();
  return {
    html,
    cookie: response.headers.get("set-cookie") ?? "",
    diagnostic: {
      step: "profile-page",
      httpStatus: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      responseBytes: Buffer.byteLength(html),
      cookieReceived: Boolean(response.headers.get("set-cookie"))
    }
  };
}

async function fetchPublicPostList(secUid, signal, cookie = "") {
  if (!secUid) return { items: [], diagnostic: { step: "post-list", skipped: true, reason: "missing-secUid" } };
  const startedAt = Date.now();
  const params = new URLSearchParams({
    aid: "1988",
    app_name: "tiktok_web",
    device_platform: "web_pc",
    from_page: "user",
    count: "30",
    cookie_enabled: "true",
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
      "sec-fetch-site": "same-origin",
      ...(cookie ? { "cookie": cookie } : {})
    }
  });
  const text = await response.text();
  const baseDiagnostic = {
    step: "post-list",
    httpStatus: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    responseBytes: Buffer.byteLength(text),
    responseEmpty: !text.trim()
  };
  if (!response.ok) {
    const error = new Error(`TikTok post list responded with HTTP ${response.status}`);
    error.diagnostic = baseDiagnostic;
    throw error;
  }
  if (!text.trim()) return { items: [], diagnostic: { ...baseDiagnostic, parsedJson: false, itemCount: 0 } };
  let data;
  try { data = JSON.parse(text); } catch {
    const error = new Error("TikTok post list did not return JSON");
    error.diagnostic = { ...baseDiagnostic, parsedJson: false };
    throw error;
  }
  const items = data.itemList ?? data.item_list ?? [];
  return {
    items,
    diagnostic: {
      ...baseDiagnostic,
      parsedJson: true,
      apiStatusCode: data.statusCode ?? data.status_code ?? null,
      apiStatusMessage: data.statusMsg ?? data.status_msg ?? null,
      hasMore: data.hasMore ?? data.has_more ?? null,
      itemCount: Array.isArray(items) ? items.length : 0
    }
  };
}

function discoverVideoIdsFromProfileHtml(html, payload) {
  const htmlPatterns = [
    /\/video\/(\d{10,})/g,
    /["'](?:id|itemId)["']\s*:\s*["'](\d{10,})["']/g
  ];
  const htmlIds = new Set();
  for (const pattern of htmlPatterns) {
    for (const match of html.matchAll(pattern)) htmlIds.add(match[1]);
  }

  const payloadIds = new Set();
  const visit = (value, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const id = value.id ?? value.itemId;
    if (id && /^\d{10,}$/.test(String(id)) && (value.video || value.stats || value.statsV2 || value.createTime)) {
      payloadIds.add(String(id));
    }
    for (const child of Object.values(value)) visit(child, seen);
  };
  visit(payload);

  return {
    ids: [...new Set([...htmlIds, ...payloadIds])],
    diagnostic: {
      step: "profile-html-scan",
      htmlVideoIdCount: htmlIds.size,
      payloadVideoIdCount: payloadIds.size,
      uniqueCandidateCount: new Set([...htmlIds, ...payloadIds]).size,
      candidateIds: [...new Set([...htmlIds, ...payloadIds])]
    }
  };
}

async function fetchVideoPageItem(username, id, signal, cookie = "") {
  const startedAt = Date.now();
  const requestedUrl = `https://www.tiktok.com/@${username}/video/${id}`;
  const response = await fetch(requestedUrl, {
    signal,
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      ...(cookie ? { cookie } : {})
    }
  });
  const html = await response.text();
  const diagnostic = {
    id: String(id),
    requestedUrl,
    finalUrl: response.url,
    redirected: response.redirected,
    httpStatus: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    responseBytes: Buffer.byteLength(html),
    hasVideoDetailMarker: html.includes("webapp.video-detail"),
    hasItemStructMarker: html.includes("itemStruct"),
    embeddedPayloadParsed: false,
    extractedItemCount: 0,
    matchedRequestedId: false
  };
  if (!response.ok) return { item: null, diagnostic };
  try {
    const payload = parseEmbeddedJson(html);
    diagnostic.embeddedPayloadParsed = true;
    const items = extractItems(payload);
    diagnostic.extractedItemCount = items.length;
    const matched = items.find((item) => String(item.id ?? item.itemId) === String(id)) ?? null;
    diagnostic.matchedRequestedId = Boolean(matched);
    return { item: matched, diagnostic };
  } catch {
    return { item: null, diagnostic };
  }
}

export async function fetchPublicTikTokProfile(username, { signal } = {}) {
  const page = await fetchProfileHtml(username, signal);
  const payload = parseEmbeddedJson(page.html);
  const profile = extractProfile(payload, username);

  let items = extractItems(payload);
  let collectionMethod = "embedded-profile";
  let collectionDiagnostic = null;
  const diagnostics = {
    status: "PARTIAL",
    totalDurationMs: null,
    profile: page.diagnostic,
    payload: {
      embeddedPayloadParsed: true,
      profileFound: Boolean(profile.id),
      secUidFound: Boolean(profile.secUid),
      embeddedItemCount: items.length
    },
    postList: null,
    creatorEmbed: null,
    profileHtmlScan: null,
    videoPages: null
  };
  const collectionStartedAt = Date.now();

  if (items.length === 0 && profile.secUid) {
    try {
      const postResult = await fetchPublicPostList(profile.secUid, signal, page.cookie);
      items = postResult.items;
      diagnostics.postList = postResult.diagnostic;
      collectionMethod = items.length ? "public-post-list" : "public-post-list-empty";
      if (!items.length) collectionDiagnostic = "TikTok returned an empty public post list; this commonly indicates the web request was challenged or limited";
    } catch (error) {
      collectionMethod = "profile-only";
      diagnostics.postList = error?.diagnostic ?? { step: "post-list", error: error instanceof Error ? error.message : "Unknown error" };
      collectionDiagnostic = error instanceof Error ? error.message : "Public post-list request failed";
    }
  } else if (items.length === 0) {
    collectionDiagnostic = "Profile payload did not expose secUid or embedded posts";
  }

  if (items.length === 0) {
    const scanned = discoverVideoIdsFromProfileHtml(page.html, payload);
    diagnostics.profileHtmlScan = scanned.diagnostic;
    if (scanned.ids.length) {
      const pageStartedAt = Date.now();
      const pageItems = [];
      const attempts = [];
      for (const id of scanned.ids.slice(0, 10)) {
        const result = await fetchVideoPageItem(username, id, signal, page.cookie);
        attempts.push(result.diagnostic);
        if (result.item) pageItems.push(result.item);
      }
      diagnostics.videoPages = {
        step: "individual-video-pages",
        source: "profile-html-scan",
        attempted: Math.min(scanned.ids.length, 10),
        collected: pageItems.length,
        durationMs: Date.now() - pageStartedAt,
        attempts
      };
      if (pageItems.length) {
        items = pageItems;
        collectionMethod = "profile-html-video-pages";
        collectionDiagnostic = null;
      } else {
        collectionDiagnostic = "Profile HTML exposed candidate video IDs, but individual video pages did not expose metrics";
      }
    }
  }

  if (items.length === 0) {
    const discovered = await discoverFromCreatorEmbed(username, signal);
    diagnostics.creatorEmbed = discovered.diagnostic;
    if (discovered.ids.length) {
      const pageStartedAt = Date.now();
      const pageItems = [];
      for (const id of discovered.ids.slice(0, 10)) {
        const item = await fetchVideoPageItem(username, id, signal, page.cookie);
        if (item) pageItems.push(item);
      }
      diagnostics.videoPages = {
        step: "individual-video-pages",
        attempted: Math.min(discovered.ids.length, 10),
        collected: pageItems.length,
        durationMs: Date.now() - pageStartedAt
      };
      if (pageItems.length) {
        items = pageItems;
        collectionMethod = "creator-embed-video-pages";
        collectionDiagnostic = null;
      } else {
        collectionDiagnostic = "Creator embed exposed video IDs, but individual video pages did not expose metrics";
      }
    }
  }

  diagnostics.totalDurationMs = page.diagnostic.durationMs + (diagnostics.postList?.durationMs ?? 0) + (diagnostics.videoPages?.durationMs ?? 0);
  diagnostics.status = items.length > 0 ? "SUCCESS" : "FAILED";
  diagnostics.result = {
    videosCollected: items.length,
    metricsAvailable: items.length > 0,
    reason: items.length > 0 ? null : collectionDiagnostic
  };

  const { secUid, ...publicProfile } = profile;
  return {
    source: "tiktok-public-web",
    collectionMethod,
    collectionDiagnostic,
    diagnostics,
    collectedAt: new Date().toISOString(),
    profile: publicProfile,
    videos: items.map((item) => mapItem(item, username))
  };
}

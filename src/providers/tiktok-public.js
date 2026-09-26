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

  const variants = [
    {
      name: "minimal-web-pc",
      path: "/api/post/item_list/",
      params: { aid: "1988", app_name: "tiktok_web", device_platform: "web_pc", from_page: "user", count: "30", cookie_enabled: "true", cursor: "0", secUid }
    },
    {
      name: "browser-context-web-pc",
      path: "/api/post/item_list/",
      params: {
        aid: "1988", app_name: "tiktok_web", device_platform: "web_pc", from_page: "user",
        count: "30", cursor: "0", secUid, cookie_enabled: "true",
        browser_language: "pt-BR", browser_name: "Mozilla", browser_online: "true",
        browser_platform: "Win32", browser_version: USER_AGENT, channel: "tiktok_web",
        focus_state: "true", history_len: "2", is_fullscreen: "false", is_page_visible: "true",
        language: "pt-BR", os: "windows", region: "BR", priority_region: "BR",
        screen_height: "900", screen_width: "1440", tz_name: "America/Sao_Paulo", webcast_language: "pt-BR"
      }
    },
    {
      name: "legacy-item-list",
      path: "/api/item_list/",
      params: {
        aid: "1988", app_name: "tiktok_web", appId: "1233", device_platform: "web",
        count: "30", id: "0", type: "1", secUid, maxCursor: "0", minCursor: "0",
        sourceType: "8", cookie_enabled: "true", region: "BR", language: "pt-BR"
      }
    }
  ];

  const attempts = [];
  for (const variant of variants) {
    const startedAt = Date.now();
    const params = new URLSearchParams(variant.params);
    const response = await fetch(`https://www.tiktok.com${variant.path}?${params}`, {
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
    const attempt = {
      name: variant.name,
      path: variant.path,
      httpStatus: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      responseBytes: Buffer.byteLength(text),
      responseEmpty: !text.trim(),
      parsedJson: false,
      itemCount: 0
    };
    if (response.ok && text.trim()) {
      try {
        const data = JSON.parse(text);
        const items = data.itemList ?? data.item_list ?? data.items ?? [];
        Object.assign(attempt, {
          parsedJson: true,
          apiStatusCode: data.statusCode ?? data.status_code ?? null,
          apiStatusMessage: data.statusMsg ?? data.status_msg ?? null,
          hasMore: data.hasMore ?? data.has_more ?? null,
          itemCount: Array.isArray(items) ? items.length : 0
        });
        attempts.push(attempt);
        if (Array.isArray(items) && items.length) {
          return { items, diagnostic: { step: "post-list", selectedVariant: variant.name, attempts } };
        }
      } catch {
        attempt.parseError = true;
      }
    }
    attempts.push(attempt);
  }

  return {
    items: [],
    diagnostic: {
      step: "post-list",
      selectedVariant: null,
      attempts,
      httpStatus: attempts[0]?.httpStatus ?? null,
      ok: attempts.some((item) => item.ok),
      durationMs: attempts.reduce((sum, item) => sum + item.durationMs, 0),
      responseBytes: attempts.reduce((sum, item) => sum + item.responseBytes, 0),
      responseEmpty: attempts.every((item) => item.responseEmpty),
      parsedJson: attempts.some((item) => item.parsedJson),
      itemCount: 0
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

  const canonicalVideoLinks = [...html.matchAll(/https?:\\?\/\\?\/(?:www\\?\.)?tiktok\\?\.com\\?\/@([^\/"'\\?]+)\\?\/video\\?\/(\d{10,})/gi)]
    .slice(0, 50)
    .map((match) => ({ username: match[1], id: match[2] }));

  const endpointHints = [...new Set(
    [...html.matchAll(/(?:https?:\\?\/\\?\/[^"'<>\\s]+)?\/api\/[A-Za-z0-9_?=&.%/\\-]+/g)]
      .map((match) => match[0].replaceAll("\\\/", "/"))
      .filter((value) => /(?:item|post|video|feed)/i.test(value))
  )].slice(0, 50);

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

  const ids = [...new Set([...htmlIds, ...payloadIds, ...canonicalVideoLinks.map((item) => item.id)])];
  return {
    ids,
    diagnostic: {
      step: "profile-html-scan",
      htmlVideoIdCount: htmlIds.size,
      payloadVideoIdCount: payloadIds.size,
      canonicalVideoLinkCount: canonicalVideoLinks.length,
      canonicalVideoLinks,
      endpointHintCount: endpointHints.length,
      endpointHints,
      uniqueCandidateCount: ids.length,
      candidateIds: ids
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
    const rawCandidateIds = [...scanned.ids];
    const rejectedProfileIds = profile.id
      ? rawCandidateIds.filter((id) => String(id) === String(profile.id))
      : [];
    scanned.ids = rawCandidateIds.filter((id) => !rejectedProfileIds.includes(id));
    scanned.diagnostic = {
      ...scanned.diagnostic,
      rawCandidateIds,
      rejectedProfileIds,
      candidateIds: [...scanned.ids],
      validCandidateCount: scanned.ids.length
    };
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
    } else {
      diagnostics.videoPages = {
        step: "individual-video-pages",
        source: "profile-html-scan",
        attempted: 0,
        collected: 0,
        skipped: true,
        reason: rejectedProfileIds.length
          ? "only-profile-id-found"
          : "no-video-candidates"
      };
      if (rejectedProfileIds.length) {
        collectionDiagnostic = "Profile HTML exposed only the profile ID; no valid video IDs were discovered";
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

export async function inspectPublicTikTokVideo(videoUrl, { signal } = {}) {
  let parsed;
  try { parsed = new URL(String(videoUrl ?? "").trim()); } catch { throw new Error("Invalid TikTok video URL"); }
  if (parsed.protocol !== "https:" || !/(^|\.)tiktok\.com$/i.test(parsed.hostname)) {
    throw new Error("Invalid TikTok video URL");
  }

  const originalUrl = parsed.toString();
  let resolvedUrl = originalUrl;
  let shortLinkResolved = false;
  const isShortLink = /^(?:v|vm|vt)\.tiktok\.com$/i.test(parsed.hostname);

  if (isShortLink) {
    const startedAt = Date.now();
    const response = await fetch(originalUrl, {
      signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8"
      }
    });
    resolvedUrl = response.url;
    shortLinkResolved = resolvedUrl !== originalUrl;
    let finalParsed;
    try { finalParsed = new URL(resolvedUrl); } catch { throw new Error("TikTok short URL did not resolve to a valid URL"); }
    if (!/(^|\.)tiktok\.com$/i.test(finalParsed.hostname)) {
      throw new Error("TikTok short URL redirected outside TikTok");
    }
    parsed = finalParsed;
    var redirectDiagnostic = {
      step: "short-link-resolve",
      httpStatus: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      originalUrl,
      finalUrl: resolvedUrl,
      redirected: response.redirected,
      resolved: shortLinkResolved
    };
  }

  const match = parsed.pathname.match(/^\/@([^/]+)\/video\/(\d{10,})/i);
  if (!match) throw new Error("TikTok URL did not resolve to @username/video/videoId");
  const username = decodeURIComponent(match[1]);
  const id = match[2];
  const result = await fetchVideoPageItem(username, id, signal);
  return {
    source: "tiktok-public-video-page",
    input: { url: originalUrl, resolvedUrl, shortLinkResolved, username, videoId: id },
    collectedAt: new Date().toISOString(),
    redirectDiagnostic: redirectDiagnostic ?? null,
    diagnostic: result.diagnostic,
    video: result.item ? mapItem(result.item, username) : null
  };
}

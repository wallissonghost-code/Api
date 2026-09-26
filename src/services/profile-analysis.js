import { normalizeUsername } from "../core/username.js";
import { analyzeVideos } from "../core/analyze.js";
import { fetchPublicTikTokProfile } from "../providers/tiktok-public.js";
import { probeTikTokProfileBrowser } from "../providers/tiktok-browser-probe.js";
import { discoverTikTokCreatorEmbed } from "../providers/tiktok-creator-embed.js";
import { inspectPublicTikTokVideo } from "../providers/tiktok-public.js";
import { ENGINE_VERSION } from "../version.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBrowserItem(item, username) {
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

export async function analyzeProfile(input, options = {}) {
  const username = normalizeUsername(input);
  const collected = await fetchPublicTikTokProfile(username, options);
  let videos = collected.videos;
  let browserDiagnostic = null;
  let collectionMethod = collected.collectionMethod ?? "unknown";
  let collectionDiagnostic = collected.collectionDiagnostic ?? null;
  let embedDiagnostic = null;

  if (!videos.length) {
    try {
      const embed = await discoverTikTokCreatorEmbed(username, options);
      embedDiagnostic = embed.diagnostic;
      if (embed.urls.length) {
        const settled = await Promise.allSettled(embed.urls.slice(0, 10).map((url) => inspectPublicTikTokVideo(url, options)));
        const discoveredVideos = settled
          .filter((result) => result.status === "fulfilled" && result.value.video)
          .map((result) => result.value.video);
        embedDiagnostic.videoPagesCollected = discoveredVideos.length;
        if (discoveredVideos.length) {
          videos = discoveredVideos;
          collectionMethod = "creator-oembed-video-pages";
          collectionDiagnostic = null;
        }
      }
    } catch (error) {
      embedDiagnostic = { failed: true, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  if (!videos.length) {
    try {
      const browser = await probeTikTokProfileBrowser(username);
      browserDiagnostic = {
        durationMs: browser.durationMs,
        stage: browser.stage,
        page: browser.page,
        videoIds: browser.videoIds,
        network: browser.network
      };
      if (Array.isArray(browser.items) && browser.items.length) {
        videos = browser.items.map((item) => mapBrowserItem(item, username));
        collectionMethod = "browser-post-list";
        collectionDiagnostic = null;
      }
    } catch (error) {
      browserDiagnostic = {
        failed: true,
        stage: error?.probeStage ?? "unknown",
        durationMs: error?.probeDurationMs ?? null,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  const collectionSucceeded = videos.length > 0;
  const analysis = analyzeVideos(videos, { collectionSucceeded });

  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    source: collectionSucceeded && collectionMethod === "browser-post-list" ? "tiktok-browser-post-list" : collectionSucceeded && collectionMethod === "creator-oembed-video-pages" ? "tiktok-creator-oembed" : collected.source,
    collectionMethod,
    collectionDiagnostic,
    diagnostics: {
      ...(collected.diagnostics ?? {}),
      status: collectionSucceeded ? "SUCCESS" : (collected.diagnostics?.status ?? "FAILED"),
      creatorEmbed: embedDiagnostic,
      browserFallback: browserDiagnostic
    },
    collectedAt: new Date().toISOString(),
    profile: collected.profile,
    ...analysis
  };
}

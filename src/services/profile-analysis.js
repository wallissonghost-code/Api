import { normalizeUsername } from "../core/username.js";
import { analyzeVideos } from "../core/analyze.js";
import { fetchPublicTikTokProfile } from "../providers/tiktok-public.js";

export async function analyzeProfile(input, options = {}) {
  const username = normalizeUsername(input);
  const collected = await fetchPublicTikTokProfile(username, options);
  const analysis = analyzeVideos(collected.videos);

  return {
    schemaVersion: 1,
    source: collected.source,
    collectedAt: collected.collectedAt,
    profile: collected.profile,
    ...analysis
  };
}

import { normalizeUsername } from "../core/username.js";
import { analyzeVideos } from "../core/analyze.js";
import { fetchPublicTikTokProfile } from "../providers/tiktok-public.js";
import { ENGINE_VERSION } from "../version.js";

export async function analyzeProfile(input, options = {}) {
  const username = normalizeUsername(input);
  const collected = await fetchPublicTikTokProfile(username, options);
  const collectionSucceeded = collected.diagnostics?.status === "SUCCESS";
  const analysis = analyzeVideos(collected.videos, { collectionSucceeded });

  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    source: collected.source,
    collectionMethod: collected.collectionMethod ?? "unknown",
    collectionDiagnostic: collected.collectionDiagnostic ?? null,
    diagnostics: collected.diagnostics ?? null,
    collectedAt: collected.collectedAt,
    profile: collected.profile,
    ...analysis
  };
}

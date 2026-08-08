import type Redis from "ioredis";

// Neon Dusk — Leaderboard cache invalidation
// ============================================================================
// The leaderboard endpoint (GET /api/street-cred/leaderboard) caches the top-50
// snapshot in Redis for 5 min. Every code path that changes a character street
// cred MUST call `invalidateLeaderboardCache` so the ranking never shows stale
// data (fixes #74).

/** Redis key backing the public leaderboard snapshot. */
export const LEADERBOARD_CACHE_KEY = "leaderboard:top50";

/**
 * Drop the cached leaderboard so the next read builds a fresh snapshot.
 * Best-effort — a Redis hiccup must never fail the parent action.
 */
export async function invalidateLeaderboardCache(redis: Redis): Promise<void> {
  try {
    await redis.del(LEADERBOARD_CACHE_KEY);
  } catch {
    // intentionally silent — cache miss is harmless (next read hits DB)
  }
}

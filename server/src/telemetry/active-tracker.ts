import type Redis from "ioredis";

// Neon Dusk — Active user tracking (ND-007)
// ============================================================================
// `auth:active:{userId}` keys mark a user as active for 24h. The key is
// re-set on every authenticated request, so it stays alive while the player
// keeps playing, and expires naturally after 24h of inactivity. The count of
// these keys backs the `neondusk_active_characters` Prometheus gauge and the
// admin metrics dashboard's DAC panel.

export const ACTIVE_USER_TTL_S = 24 * 60 * 60;

/**
 * Mark a user as active for the next 24h. Best-effort — callers should
 * swallow failures (Redis being down must never break auth).
 */
export async function trackActiveUser(redis: Redis, userId: string): Promise<void> {
  await redis.set(`auth:active:${userId}`, "1", "EX", ACTIVE_USER_TTL_S);
}

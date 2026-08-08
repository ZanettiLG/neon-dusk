import type Redis from "ioredis";
import { AppError } from "../middleware/error-handler";

// Neon Dusk — Custom Redis-backed rate limiting
// ============================================================================
// The global @fastify/rate-limit guards every route by IP; these counters add
// per-resource limits (e.g. 5 logins/min, 3 registrations/min per email).

/**
 * Enforce a per-key rate limit using a Redis INCR + EXPIRE counter.
 * Throws AppError(429) when the limit is exceeded within the window.
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const counterKey = `auth:rl:${key}`;

  // Atomic INCR + EXPIRE in one multi: two concurrent calls can't both see
  // count === 1 and race the TTL (one of them would leave the key without an
  // expiry, pinning the counter forever).
  const results = await redis.multi().incr(counterKey).expire(counterKey, Math.ceil(windowMs / 1000)).exec();
  if (results === null) {
    throw new AppError(500, "RATE_LIMIT_ERROR", "Rate limiter unavailable");
  }
  const count = results[0][1] as number;

  if (count > max) {
    const retryAfter = Math.ceil(windowMs / 1000);
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.", { retryAfter });
  }
}

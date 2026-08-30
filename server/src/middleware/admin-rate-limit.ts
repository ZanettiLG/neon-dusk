import type { FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { AppError } from "./error-handler";

// Neon Dusk — Admin rate limit (ND-052)
// ============================================================================
// Per-admin request cap: 6000 requests per 60s window (100 req/s). Tighter
// than the global rate-limit because admin endpoints expose sensitive player
// data — and the window is a sliding fixed-window counter (INCR + EXPIRE).

const ADMIN_RATE_LIMIT = { max: 6000, windowSec: 60 };

/**
 * PreHandler: enforces a per-admin-user rate limit (6000 req/60s — 100 req/s).
 * Must run AFTER `authenticate` (needs `request.user.sub`).
 */
export function checkAdminRateLimit(redis: Redis) {
  return async (request: FastifyRequest): Promise<void> => {
    const key = `ratelimit:admin:${request.user.sub}`;
    const results = await redis.multi().incr(key).expire(key, ADMIN_RATE_LIMIT.windowSec).exec();

    if (results === null) {
      // ponytail: Redis unavailable — fail open
      return;
    }
    const count = results[0][1] as number;
    if (count > ADMIN_RATE_LIMIT.max) {
      throw new AppError(
        429,
        "ADMIN_RATE_LIMITED",
        "Muitas requisições admin. Tente novamente mais tarde.",
      );
    }
  };
}

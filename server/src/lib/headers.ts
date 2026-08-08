import type { FastifyReply } from "fastify";

// Neon Dusk — Rate-limit response header helpers (ND-053)
// ============================================================================
// Sets IETF-compliant X-RateLimit-* headers on a Fastify reply so the client
// can throttle itself before hitting the actual 429 wall.

/**
 * Set standard rate-limit headers on a reply.
 * @param remaining  Number of requests left in the current window.
 * @param resetMs    Milliseconds until the window resets (from now).
 */
export function setRateLimitHeaders(
  reply: FastifyReply,
  remaining: number,
  resetMs: number,
): void {
  reply.header("X-RateLimit-Remaining", remaining);
  reply.header("X-RateLimit-Reset", Math.ceil((Date.now() + resetMs) / 1000));
}

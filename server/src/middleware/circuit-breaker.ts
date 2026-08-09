import type { FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { env } from "../env";
import { AppError } from "./error-handler";

// Neon Dusk — N-strikes circuit-breaker preHandler (ND-053)
// ============================================================================
// If a character exceeds ANY rate limit CB_STRIKE_THRESHOLD times within 1 hour,
// ALL mutating actions are banned for 24 hours (ADR-4: global, not per-action).
// The circuit-break key is SET by checkActionRateLimit when the cb_count hits
// CB_STRIKE_THRESHOLD.

const CIRCUIT_BREAK_PREFIX = "circuit_break";

/**
 * Returns a preHandler that checks whether the user (by JWT `sub` = userId) is
 * under a circuit-break ban. Throws AppError(429, "CIRCUIT_BREAK") if so.
 *
 * Must run AFTER authenticate (needs request.user.sub).
 * Must run BEFORE checkCooldown and checkActionRateLimit.
 */
export function checkCircuitBreaker(
  redis: Redis,
): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    // Skip circuit-break enforcement when strict mode is off (test envs).
    if (env.ANTI_CHEAT_STRICT_MODE === "false") return;

    const userId = request.user.sub;
    const key = `${CIRCUIT_BREAK_PREFIX}:${userId}`;

    try {
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        // Tag the audit context before throwing so the response hook logs it.
        if (request.audit_context) {
          request.audit_context.result = "circuit_break";
        }

        const hours = Math.ceil(ttl / 3600);
        throw new AppError(
          429,
          "CIRCUIT_BREAK",
          `Sistema neural sobrecarregado. Retorne em ${hours} horas.`,
          { retryAfter: ttl },
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // ponytail: Redis unavailable — fail open
      console.warn("[circuit-breaker] Redis unavailable, allowing request");
    }
  };
}

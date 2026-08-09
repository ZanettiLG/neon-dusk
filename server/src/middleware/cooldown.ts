import type { FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { requireCharacterId } from "../services/economy-service";
import { AppError } from "./error-handler";

// Neon Dusk — Redis-backed action cooldown preHandler (ND-053)
// ============================================================================
// Cooldowns prevent spamming the same action. The cooldown is CHECKED in the
// preHandler but SET in the route handler AFTER success (ADR-2). This means a
// failed action (e.g., insufficient eddies) does NOT trigger a cooldown.

export type CooldownActionType =
  | "pvp_attack"       // 1h
  | "stim_use"         // 5min
  | "chat_message"     // 5s
  | "crew_invite"      // 60s
  | "chrome_install";  // 60s

export interface CooldownEntry {
  durationMs: number;
}

export const cooldownConfig: Record<CooldownActionType, CooldownEntry> = {
  pvp_attack:     { durationMs: 15_000 },
  stim_use:       { durationMs: 300_000 },
  chat_message:   { durationMs: 5_000 },
  crew_invite:    { durationMs: 60_000 },
  chrome_install: { durationMs: 10_000 },
} as const;

/**
 * Returns a preHandler that checks whether `characterId` already has an active
 * cooldown for `actionType`. Throws AppError(429, "COOLDOWN_ACTIVE") if so.
 *
 * The cooldown flag itself is SET by the route handler after a successful
 * operation, NOT by this middleware.
 */
export function checkCooldown(
  redis: Redis,
  actionType: CooldownActionType,
): (request: FastifyRequest) => Promise<void> {
  const entry = cooldownConfig[actionType];

  return async (request) => {
    const characterId = await requireCharacterId(request.user.sub);
    const key = `cooldown:${characterId}:${actionType}`;

    try {
      const exists = await redis.exists(key);
      if (exists) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(entry.durationMs / 1000);

        // Tag audit context before throwing so the audit log records the
        // correct result instead of falling back to "blocked".
        if (request.audit_context) {
          request.audit_context.result = "cooldown_active";
        }

        throw new AppError(
          429,
          "COOLDOWN_ACTIVE",
          "Ação em cooldown. Aguarde.",
          { retryAfter },
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // ponytail: Redis unavailable — fail open, don't block the user
      console.warn("[cooldown] Redis unavailable, allowing request");
    }
  };
}

import type { FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { resolveCharacter } from "../lib/request-character";
import { AppError } from "./error-handler";

// Neon Dusk — Redis-backed action cooldown preHandler (ND-053, #187)
// ============================================================================
// Anti-spam split into two families: 500ms for chat/crew-invite/PvP
// (imperceptible, anti-DDoS only) and per-action anti-spam for fast/sensitive
// actions — gig_accept 30s, chrome_install 60s (both still in cooldownConfig).
// The cooldown is CHECKED in the preHandler but SET in the route handler AFTER
// success (ADR-2). A failed action (e.g., insufficient Grana) does NOT trigger
// a cooldown. Real gameplay waits (trampo tiers, abilities) live elsewhere —
// the DB — not in these keys.

export type CooldownActionType =
  | "chat_message" // 500ms anti-spam
  | "crew_invite" // 500ms anti-spam
  | "pvp_attack" // 500ms anti-spam
  | "gig_accept" // 30s
  | "chrome_install"; // 60s

export interface CooldownEntry {
  durationMs: number;
}

export const cooldownConfig: Record<CooldownActionType, CooldownEntry> = {
  chat_message: { durationMs: 500 },
  crew_invite: { durationMs: 500 },
  pvp_attack: { durationMs: 500 },
  gig_accept: { durationMs: 30_000 },
  chrome_install: { durationMs: 60_000 },
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
    // Memoized on `request` (M6) — shares one character query with the rest of
    // the preHandler chain and the handler.
    const characterId = (await resolveCharacter(request, { require: true }))!.id;
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

        throw new AppError(429, "COOLDOWN_ACTIVE", "Ação em cooldown. Aguarde.", { retryAfter });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // ponytail: Redis unavailable — fail open, don't block the user
      console.warn("[cooldown] Redis unavailable, allowing request");
    }
  };
}

/**
 * Set the post-success cooldown flag for `characterId` (ADR-2 — called by the
 * route handler only after the operation succeeded). Uses PX because the
 * 500ms anti-spam windows do not fit `setex`'s whole-second granularity.
 */
export async function setCooldown(
  redis: Redis,
  characterId: string,
  actionType: CooldownActionType,
): Promise<void> {
  await redis.set(
    `cooldown:${characterId}:${actionType}`,
    "1",
    "PX",
    cooldownConfig[actionType].durationMs,
  );
}

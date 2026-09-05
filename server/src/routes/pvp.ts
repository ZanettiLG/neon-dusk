import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type { PvpAttackableResponse, PvpCombatResult, PvpHistoryResponse } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { checkCooldown, setCooldown } from "../middleware/cooldown";
import { validate } from "../middleware/validate";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { resolveCharacter } from "../lib/request-character";
import { executeAttack, getAttackableTargets, getCombatHistory } from "../services/pvp-service";

// Neon Dusk — PvP routes (ND-014, ND-053)
// ============================================================================
// Three endpoints: attackable target list, the attack itself (per-action rate
// limit + 500ms anti-spam cooldown), and the combat history. All resolve the
// caller's character from their JWT sub claim.

export interface PvpRoutesOptions {
  redis: Redis;
}

/** GET /api/pvp/attackable + GET /api/pvp/history — shared pagination query. */
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // cursor is a page's last createdAt, ISO 8601 (see getCombatHistory)
  cursor: z.string().datetime().optional(),
});

/** POST /api/pvp/attack — request body. */
const attackSchema = z.object({
  targetId: z.string().uuid("targetId must be a UUID"),
});

export async function pvpRoutes(app: FastifyInstance, opts: PvpRoutesOptions) {
  const { redis } = opts;

  // GET /api/pvp/attackable — valid targets within ±10 power, not immune.
  app.get(
    "/pvp/attackable",
    { preHandler: [authenticate] },
    async (request): Promise<PvpAttackableResponse> => {
      const query = listQuery.parse(request.query);
      return getAttackableTargets(request.user.sub, query.limit, query.cursor);
    },
  );

  // POST /api/pvp/attack — the combat itself (3/hour per character via rate
  // limit, 500ms anti-spam cooldown).
  app.post(
    "/pvp/attack",
    {
      preHandler: [
        authenticate,
        setAuditContext("pvp_attack"),
        checkCircuitBreaker(redis),
        checkCooldown(redis, "pvp_attack"),
        validate(attackSchema),
        checkActionRateLimit(redis, "pvp_attack"),
      ],
    },
    async (request): Promise<PvpCombatResult> => {
      const { targetId } = request.body as z.infer<typeof attackSchema>;

      request.audit_context!.payload = { targetId };

      const characterId = (await resolveCharacter(request, { require: true }))!.id;
      const result = await executeAttack(redis, request.user.sub, targetId);
      // 500ms anti-spam cooldown, set AFTER success (ADR-2) — a failed
      // attack (e.g. FLATLINED) never burns it.
      await setCooldown(redis, characterId, "pvp_attack");
      return result;
    },
  );

  // GET /api/pvp/history — cursor-paginated combat log.
  app.get(
    "/pvp/history",
    { preHandler: [authenticate] },
    async (request): Promise<PvpHistoryResponse> => {
      const query = listQuery.parse(request.query);
      return getCombatHistory(request.user.sub, query.limit, query.cursor);
    },
  );
}

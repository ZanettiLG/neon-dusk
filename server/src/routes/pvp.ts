import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type { PvpAttackableResponse, PvpCombatResult, PvpHistoryResponse } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkRateLimit } from "../lib/rate-limit";
import {
  executeAttack,
  getAttackableTargets,
  getCombatHistory,
} from "../services/pvp-service";

// Neon Dusk — PvP routes (ND-014)
// ============================================================================
// Three endpoints: attackable target list, the attack itself (rate-limited:
// 3 attacks/hour per user) and the combat history. All resolve the caller's
// character from their JWT sub claim.

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

/** Per-user attack rate limit: 3 attacks per hour. */
const ATTACK_LIMIT = 3;
const ATTACK_WINDOW_MS = 60 * 60 * 1000;

export async function pvpRoutes(app: FastifyInstance, opts: PvpRoutesOptions) {
  const { redis } = opts;

  // GET /api/pvp/attackable — valid targets within ±10 power, not immune.
  app.get(
    "/pvp/attackable",
    { preHandler: [authenticate] },
    async (request): Promise<PvpAttackableResponse> => {
      const query = listQuery.parse(request.query);
      return getAttackableTargets(redis, request.user.sub, query.limit, query.cursor);
    },
  );

  // POST /api/pvp/attack — the combat itself (3/hour per user).
  app.post(
    "/pvp/attack",
    {
      preHandler: [
        authenticate,
        // PreHandler hooks run in order — this runs after authenticate, so
        // `req.user.sub` is guaranteed to exist here.
        async (req) => checkRateLimit(redis, `pvp:attack:user:${req.user.sub}`, ATTACK_LIMIT, ATTACK_WINDOW_MS),
      ],
    },
    async (request): Promise<PvpCombatResult> => {
      const { targetId } = attackSchema.parse(request.body);
      return executeAttack(redis, request.user.sub, targetId);
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

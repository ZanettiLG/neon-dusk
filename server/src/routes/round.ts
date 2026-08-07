import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type {
  RoundHistoryResponse,
  RoundInfoResponse,
  TriggerResetResponse,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin-auth";
import { getCurrentRound, getRoundHistory, performRoundReset } from "../services/round-service";

// Neon Dusk — Round routes (ND-017)
// ============================================================================
// GET /api/round — current round info with live countdown (active or
// intermission). GET /api/round/history — cursor-paginated ended rounds.
// POST /api/round/trigger-reset — manual admin reset (x-api-key), the same
// transaction the cron runs.

export interface RoundRoutesOptions {
  redis: Redis;
}

/** GET /api/round/history — cursor is a round_number to page BEFORE. */
const historyQuery = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function roundRoutes(app: FastifyInstance, _opts: RoundRoutesOptions) {
  // GET /api/round — current round status + countdown.
  app.get("/round", { preHandler: [authenticate] }, async (): Promise<RoundInfoResponse> => {
    return getCurrentRound();
  });

  // GET /api/round/history — ended rounds, cursor-paginated (round_number DESC).
  app.get(
    "/round/history",
    { preHandler: [authenticate] },
    async (request): Promise<RoundHistoryResponse> => {
      const query = historyQuery.parse(request.query);
      return getRoundHistory(query.cursor, query.limit);
    },
  );

  // POST /api/round/trigger-reset — admin-only manual reset (x-api-key).
  app.post(
    "/round/trigger-reset",
    { preHandler: [requireAdmin] },
    async (request): Promise<TriggerResetResponse> => {
      const result = await performRoundReset();
      request.log.info(
        {
          endedRound: result.endedRound,
          newRound: result.newRound,
          legendsInducted: result.legendsInducted,
          stats: result.stats,
        },
        "round: manual reset completed",
      );
      return {
        success: true,
        endedRound: result.endedRound,
        newRound: result.newRound,
        legendsInducted: result.legendsInducted,
      };
    },
  );
}

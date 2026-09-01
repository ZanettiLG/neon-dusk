import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ConsumablesResponse, ConsumableUseResponse } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { setAuditContext } from "../middleware/audit-middleware";
import { validate } from "../middleware/validate";
import { checkActionRateLimit } from "../lib/rate-limit";
import { characterRepository as characters } from "../repositories/character-repository";
import { listConsumables, useConsumable } from "../services/consumable-service";

// Neon Dusk — Consumables routes (issue #28 — itens anti-insanidade)
// ============================================================================
// GET  /api/consumables     — catalog + owned quantities + next availability
// POST /api/consumables/use — consume one owned item (restores humanity)

const useSchema = z.object({
  itemId: z.string().uuid(),
});

export async function consumableRoutes(app: FastifyInstance) {
  const redis = app.redis;

  app.get("/consumables", { preHandler: [authenticate] }, async (request) => {
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    return listConsumables(characterId) as Promise<ConsumablesResponse>;
  });

  app.post(
    "/consumables/use",
    {
      preHandler: [
        authenticate,
        setAuditContext("consumable_use"),
        checkCircuitBreaker(redis),
        validate(useSchema),
        checkActionRateLimit(redis, "consumable_use"),
      ],
    },
    async (request) => {
      const body = request.body as z.infer<typeof useSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      return useConsumable(characterId, body.itemId) as Promise<ConsumableUseResponse>;
    },
  );
}
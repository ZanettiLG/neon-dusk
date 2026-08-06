import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { LuckyChipResponse } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { playLuckyChip } from "../services/lucky-chip-service";

// Neon Dusk — Lucky Chip route (ND-008)
// ============================================================================
// POST /api/game/lucky-chip — authenticated; body { bet: integer 1..1e6 }.

const luckyChipBodySchema = z.object({
  bet: z
    .number()
    .int("Bet must be an integer")
    .min(1, "Minimum bet is 1 eddie")
    .max(1_000_000, "Bet too large"),
});

export async function luckyChipRoutes(app: FastifyInstance) {
  app.post(
    "/game/lucky-chip",
    { preHandler: [authenticate] },
    async (request): Promise<LuckyChipResponse> => {
      const { bet } = luckyChipBodySchema.parse(request.body);
      return playLuckyChip(request.user.sub, bet);
    },
  );
}

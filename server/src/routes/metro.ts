import type { FastifyInstance } from "fastify";
import type { MetroMapResponse } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { characterRepository as characters } from "../repositories/character-repository";
import { getMetroMap } from "../services/metro-service";

// Neon Dusk — Metro routes (issue #18: district map visualization)
// ============================================================================
// GET /api/metro — aggregated district readout (trampos, calor, território)
// for the district map view. Read-only: heat decay is applied lazily and
// never written back.

export async function metroRoutes(app: FastifyInstance) {
  // GET /api/metro — the district map payload.
  app.get("/metro", { preHandler: [authenticate] }, async (request): Promise<MetroMapResponse> => {
    const character = await characters.requireByUserId(request.user.sub);
    return getMetroMap(character);
  });
}

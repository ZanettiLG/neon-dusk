import type { FastifyInstance } from "fastify";
import type { HumanityInfo } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { characterRepository as characters } from "../repositories/character-repository";
import { getHumanityInfo } from "../services/humanity-service";

// Neon Dusk — Humanity routes (issue #28)
// ============================================================================
// GET /api/humanity — live humanity readout: band, flatline state, scrubber
// regen status and therapy availability (read-only; lazy regen on read).

export async function humanityRoutes(app: FastifyInstance) {
  app.get("/humanity", { preHandler: [authenticate] }, async (request) => {
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    return getHumanityInfo(characterId) as Promise<HumanityInfo>;
  });
}
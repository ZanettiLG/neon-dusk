import type { FastifyInstance } from "fastify";
import type { OsActivateResponse, OsStatus } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { characterRepository as characters } from "../repositories/character-repository";
import { activateOs, getOsStatus } from "../services/os-service";

// Neon Dusk — OS routes (issue #28)
// ============================================================================
// GET  /api/os/status   — installed OS + activation readout
// POST /api/os/activate — start the installed OS's effect window (daily charge)

export async function osRoutes(app: FastifyInstance) {
  const redis = app.redis;

  app.get("/os/status", { preHandler: [authenticate] }, async (request) => {
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    return getOsStatus(characterId) as Promise<OsStatus>;
  });

  app.post(
    "/os/activate",
    {
      preHandler: [
        authenticate,
        setAuditContext("os_activate"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "os_activate"),
      ],
    },
    async (request) => {
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      return activateOs(characterId) as Promise<OsActivateResponse>;
    },
  );
}
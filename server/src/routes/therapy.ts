import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TherapyResponse } from "@neon-dusk/shared";
import { THERAPY_TYPES } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { setAuditContext } from "../middleware/audit-middleware";
import { validate } from "../middleware/validate";
import { checkActionRateLimit } from "../lib/rate-limit";
import { characterRepository as characters } from "../repositories/character-repository";
import { undergoTherapy } from "../services/therapy-service";

// Neon Dusk — Therapy routes (issue #28)
// ============================================================================
// POST /api/therapy — undergo a session (clínica or sintonia). Shared 24h
// cooldown; wallet debit + humanity restore in one transaction.

const therapySchema = z.object({
  therapyType: z.enum(THERAPY_TYPES),
});

export async function therapyRoutes(app: FastifyInstance) {
  const redis = app.redis;

  app.post(
    "/therapy",
    {
      preHandler: [
        authenticate,
        setAuditContext("therapy"),
        checkCircuitBreaker(redis),
        validate(therapySchema),
        checkActionRateLimit(redis, "therapy"),
      ],
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof therapySchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      const result = await undergoTherapy(characterId, body);

      return reply.status(200).send(result as TherapyResponse);
    },
  );
}
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  ActiveGig,
  GigAcceptResponse,
  GigBoardResponse,
  GigDetailResponse,
  GigEscapeResponse,
  GigExecuteResponse,
  GigHistoryResponse,
  GigWrapupResponse,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { checkCooldown } from "../middleware/cooldown";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { requireCharacterId } from "../services/economy-service";
import {
  acceptGig,
  doLegwork,
  escapeGig,
  executeGig,
  getActiveGig,
  getGigDetail,
  getGigHistory,
  listAvailableGigs,
  wrapUpGig,
} from "../services/gig-service";
import { invalidateLeaderboardCache } from "../lib/leaderboard-cache";

// Neon Dusk — Gig routes (Fixer Cupim board, 5-phase loop)
// ============================================================================
// Every endpoint resolves the caller's character from their JWT sub claim.
// Phase transitions (legwork/execute/escape/wrapup) take the gig id in the
// path and verify it against the character's active gig.
//
// ND-053: All POST endpoints are guarded by circuit-break, per-action rate
// limits, and audit logging. The `accept` action also has a 30s cooldown.

const uuidParam = z.object({
  id: z.string().uuid("Gig id must be a UUID"),
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // cursor is a page's last completedAt, ISO 8601 (see getGigHistory)
  cursor: z.string().datetime().optional(),
});

export async function gigRoutes(app: FastifyInstance) {
  const redis = app.redis;

  // GET /api/gigs — board: all gigs + active gig + daily count
  app.get("/gigs", { preHandler: [authenticate] }, async (request): Promise<GigBoardResponse> => {
    const characterId = await requireCharacterId(request.user.sub);
    return listAvailableGigs(characterId);
  });

  // GET /api/gigs/active — the character's active gig (null when none)
  app.get("/gigs/active", { preHandler: [authenticate] }, async (request): Promise<ActiveGig | null> => {
    const characterId = await requireCharacterId(request.user.sub);
    return getActiveGig(characterId);
  });

  // GET /api/gigs/history — cursor-paginated completed gigs
  app.get("/gigs/history", { preHandler: [authenticate] }, async (request): Promise<GigHistoryResponse> => {
    const query = historyQuery.parse(request.query);
    const characterId = await requireCharacterId(request.user.sub);
    return getGigHistory(characterId, query.limit, query.cursor);
  });

  // GET /api/gigs/:id — single template with requirement flags
  app.get("/gigs/:id", { preHandler: [authenticate] }, async (request): Promise<GigDetailResponse> => {
    const { id } = uuidParam.parse(request.params);
    const characterId = await requireCharacterId(request.user.sub);
    return getGigDetail(characterId, id);
  });

  // POST /api/gigs/:id/accept — phase 1 (meet): spend NIL, open the gig
  app.post(
    "/gigs/:id/accept",
    {
      preHandler: [
        authenticate,
        setAuditContext("gig_accept"),
        checkCircuitBreaker(redis),
        checkCooldown(redis, "gig_accept"),
        checkActionRateLimit(redis, "gig_accept"),
      ],
    },
    async (request): Promise<GigAcceptResponse> => {
      const { id } = uuidParam.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { gigId: id };

      const result = await acceptGig(characterId, id);

      // Set cooldown AFTER success (ADR-2).
      await redis.setex(`cooldown:${characterId}:gig_accept`, 30, "1");

      return result;
    },
  );

  // POST /api/gigs/:id/legwork — phase 2: start the legwork timer
  app.post(
    "/gigs/:id/legwork",
    {
      preHandler: [
        authenticate,
        setAuditContext("gig_legwork"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "gig_execute"),
      ],
    },
    async (request): Promise<ActiveGig> => {
      const { id } = uuidParam.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { gigId: id };

      return doLegwork(characterId, id);
    },
  );

  // POST /api/gigs/:id/execute — phase 3: roll stats vs difficulty
  app.post(
    "/gigs/:id/execute",
    {
      preHandler: [
        authenticate,
        setAuditContext("gig_execute"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "gig_execute"),
      ],
    },
    async (request): Promise<GigExecuteResponse> => {
      const { id } = uuidParam.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { gigId: id };

      return executeGig(characterId, id);
    },
  );

  // POST /api/gigs/:id/escape — phase 4: roll vs heat-weighted escape difficulty
  app.post(
    "/gigs/:id/escape",
    {
      preHandler: [
        authenticate,
        setAuditContext("gig_escape"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "gig_execute"),
      ],
    },
    async (request): Promise<GigEscapeResponse> => {
      const { id } = uuidParam.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { gigId: id };

      return escapeGig(characterId, id);
    },
  );

  // POST /api/gigs/:id/wrapup — phase 5: collect payout, cred, heat, history
  app.post(
    "/gigs/:id/wrapup",
    {
      preHandler: [
        authenticate,
        setAuditContext("gig_wrapup"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "gig_submit"),
      ],
    },
    async (request): Promise<GigWrapupResponse> => {
      const { id } = uuidParam.parse(request.params);
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { gigId: id };
      const result = await wrapUpGig(characterId, id);

      // #74: when SC changed, drop the cached leaderboard so the public
      // ranking reflects the new score immediately.
      if (result.streetCredGained > 0) {
        await invalidateLeaderboardCache(app.redis);
      }

      return result;
    },
  );
}

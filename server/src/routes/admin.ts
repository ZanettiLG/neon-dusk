import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type {
  AdminAuditResponse,
  AdminEconomy,
  AdminPlayersResponse,
  AdminTransactionsResponse,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { requireAdminRole } from "../middleware/admin-auth";
import { checkAdminRateLimit } from "../middleware/admin-rate-limit";
import {
  banPlayer,
  getAuditLog,
  getEconomy,
  getParams,
  getPlayers,
  getTransactions,
  unbanPlayer,
  updateParams,
} from "../services/admin-service";

// Neon Dusk — Admin panel routes (ND-052)
// ============================================================================
// Role-based admin routes protected by authenticate + requireAdminRole.
// Separate from ND-007 telemetry routes (which use x-api-key).

export interface AdminRoutesOptions {
  redis: Redis;
}

// --- Schemas ----------------------------------------------------------------

const banPlayerSchema = z.object({
  reason: z.string().min(1, "Ban reason is required").max(500),
});

const updateParamsSchema = z.object({
  params: z.record(z.string(), z.string()),
});

const playersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  sort: z.enum(["sc", "name", "level", "last_activity"]).optional(),
});

const txQuery = z.object({
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const auditQuery = z.object({
  action: z.string().optional(),
  result: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// --- Routes -----------------------------------------------------------------

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const redis = app.redis as Redis;

  // GET /api/admin/players — paginated player list.
  app.get(
    "/admin/players",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request): Promise<AdminPlayersResponse> => {
      const query = playersQuery.parse(request.query);
      return getPlayers(redis, query);
    },
  );

  // POST /api/admin/players/:id/ban — ban a character.
  app.post(
    "/admin/players/:id/ban",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = banPlayerSchema.parse(request.body);
      await banPlayer(id, request.user.sub, body.reason);
      return reply.status(200).send({ success: true });
    },
  );

  // POST /api/admin/players/:id/unban — unban a character.
  app.post(
    "/admin/players/:id/unban",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await unbanPlayer(id, request.user.sub);
      return reply.status(200).send({ success: true });
    },
  );

  // GET /api/admin/economy — economy dashboard.
  app.get(
    "/admin/economy",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (): Promise<AdminEconomy> => {
      return getEconomy();
    },
  );

  // GET /api/admin/transactions — transaction log viewer.
  app.get(
    "/admin/transactions",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request): Promise<AdminTransactionsResponse> => {
      const query = txQuery.parse(request.query);
      return getTransactions(query);
    },
  );

  // GET /api/admin/params — game params.
  app.get(
    "/admin/params",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async () => {
      return getParams();
    },
  );

  // PATCH /api/admin/params — update game params.
  app.patch(
    "/admin/params",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request) => {
      const body = updateParamsSchema.parse(request.body);
      return updateParams(body.params, request.user.sub);
    },
  );

  // GET /api/admin/audit — audit log viewer.
  app.get(
    "/admin/audit",
    { preHandler: [authenticate, requireAdminRole, checkAdminRateLimit(redis)] },
    async (request): Promise<AdminAuditResponse> => {
      const query = auditQuery.parse(request.query);
      return getAuditLog(query);
    },
  );
}

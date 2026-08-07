import type { FastifyRequest } from "fastify";
import { env } from "../env";
import { AppError } from "./error-handler";

// Neon Dusk — Admin API key guard
// ============================================================================
// Admin endpoints (e.g. /api/admin/metrics) require the x-api-key header to
// match ADMIN_API_KEY. Keys rotate via env; there is no in-memory key store.

/**
 * Fastify preHandler: requires a valid admin API key in `x-api-key`.
 * Throws AppError(401) on missing or mismatched key.
 */
export async function requireAdmin(request: FastifyRequest): Promise<void> {
  const key = request.headers["x-api-key"];
  if (typeof key !== "string" || key !== env.ADMIN_API_KEY) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid admin API key");
  }
}

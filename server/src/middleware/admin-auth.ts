import type { FastifyRequest } from "fastify";
import { AppError } from "./error-handler";
import { env } from "../env";

// Neon Dusk — Admin API key middleware (ND-007)
// ============================================================================
// Guards /admin/* endpoints with a static API key. The key is validated at
// boot by env.ts (min 32 chars); comparing against the parsed env keeps the
// secret out of the source tree.

/**
 * PreHandler: requires a valid `x-api-key` header matching ADMIN_API_KEY.
 * Throws AppError(401) when missing or mismatched.
 */
export async function requireAdmin(request: FastifyRequest): Promise<void> {
  const apiKey = request.headers["x-api-key"];
  if (typeof apiKey !== "string" || apiKey !== env.ADMIN_API_KEY) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid admin API key");
  }
}

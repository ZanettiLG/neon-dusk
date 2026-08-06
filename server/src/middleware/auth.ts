import type { FastifyRequest } from "fastify";
import { AppError } from "./error-handler";

// Neon Dusk — JWT auth middleware
// ============================================================================
// Verifies the Bearer access token and attaches its payload to `request.user`
// (typed via the FastifyJWT augmentation in lib/auth.ts).

/**
 * Fastify preHandler/onRequest hook: requires a valid access token.
 * Throws AppError(401) when the token is missing, invalid or expired.
 */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Missing, invalid or expired access token");
  }
}

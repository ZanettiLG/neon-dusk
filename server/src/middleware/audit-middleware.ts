import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuditResult } from "../lib/audit-log";
import { auditLog } from "../lib/audit-log";
import { characterRepository as characters } from "../repositories/character-repository";

// Neon Dusk — onResponse audit hook (ND-053)
// ============================================================================
// Registered as a fastify-plugin AFTER telemetryPlugin. This hook reads
// `request.audit_context` (set by route handlers or preHandler middlewares)
// and writes a fire-and-forget entry to the `audit_log` table.

declare module "fastify" {
  interface FastifyRequest {
    audit_context?: {
      action: string;
      characterId: string;
      payload?: Record<string, unknown>;
      result?: AuditResult;
    };
  }
}

/**
 * Returns a preHandler that sets `request.audit_context` BEFORE anti-cheat
 * guards run. This ensures `checkCooldown`, `checkCircuitBreaker`, and
 * `checkActionRateLimit` can tag the context with the correct result
 * ("cooldown_active", "circuit_break", "rate_limited") instead of the
 * onResponse hook falling back to "blocked".
 *
 * Must run AFTER `authenticate` (needs `request.user.sub`).
 * Must run BEFORE any anti-cheat middleware.
 */
export function setAuditContext(
  action: string,
): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    request.audit_context = {
      action,
      characterId,
    };
  };
}

/** Infer an AuditResult from the HTTP status code. */
function resultFromStatusCode(statusCode: number): AuditResult {
  if (statusCode >= 200 && statusCode < 300) return "allowed";
  if (statusCode === 400) return "validation_error";
  if (statusCode >= 500) return "server_error";
  return "blocked";
}

/**
 * Fastify plugin that registers an onResponse hook for audit logging.
 * Must be registered AFTER telemetryPlugin and BEFORE route modules.
 */
async function auditOnResponse(app: FastifyInstance): Promise<void> {
  app.addHook("onResponse", async (request, reply) => {
    const ctx = request.audit_context;
    if (!ctx) return; // GET requests typically have no audit context

    const result = ctx.result ?? resultFromStatusCode(reply.statusCode);

    auditLog({
      characterId: ctx.characterId,
      action: ctx.action,
      ip: request.ip,
      userAgent: (request.headers["user-agent"] as string) ?? "unknown",
      payload: ctx.payload ?? {},
      result,
    });
  });
}

export default fp(auditOnResponse, {
  name: "audit-on-response",
});

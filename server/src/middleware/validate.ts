import type { FastifyRequest } from "fastify";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

// Neon Dusk — Zod body validation preHandler (ND-053)
// ============================================================================
// Validates request.body against a Zod schema AFTER auth, so the error handler
// can log the offending character_id in the audit context (unlike Fastify's
// built-in schema validation which runs BEFORE preHandlers).

/**
 * Returns a preHandler that parses `request.body` with the given Zod schema.
 * On success the parsed value replaces `request.body`.
 * On failure it throws a ZodError → caught by the global error handler → 400.
 */
export function validate<T>(schema: ZodSchema<T>): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    try {
      const parsed = schema.parse(request.body);
      request.body = parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        // Tag the audit context so the response hook logs a validation_error.
        if (request.audit_context) {
          request.audit_context.result = "validation_error";
        }
      }
      throw error;
    }
  };
}

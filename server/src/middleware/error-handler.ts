import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { env } from "../env";

function isRedisError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // ioredis MaxRetriesPerRequestError — thrown when maxRetriesPerRequest exhausted
  if (err.name === "MaxRetriesPerRequestError") return true;
  // ioredis ReplyError — thrown on command-level errors, has .command property
  if ("command" in err) return true;
  // ioredis with enableOfflineQueue:false rejects while disconnected with this message
  if (err.message.startsWith("Stream isn't writeable")) return true;
  return false;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    // ND-053: RATE_LIMITED, COOLDOWN_ACTIVE, CIRCUIT_BREAK — 429 with Retry-After header.
    if (error.code === "RATE_LIMITED") {
      const retryAfter = (error.details as { retryAfter?: number } | undefined)?.retryAfter;
      if (retryAfter !== undefined) {
        reply.header("Retry-After", retryAfter);
      }
      return reply.status(429).send({
        error: error.code,
        message: error.message,
        retryAfter,
      });
    }

    if (error.code === "COOLDOWN_ACTIVE" || error.code === "CIRCUIT_BREAK") {
      const retryAfter = (error.details as { retryAfter?: number } | undefined)?.retryAfter;
      if (retryAfter !== undefined) {
        reply.header("Retry-After", retryAfter);
      }
      return reply.status(429).send({
        error: error.code,
        message: error.message,
        retryAfter,
      });
    }

    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: error.errors.map((e) => ({
        path: e.path,
        message: e.message,
      })),
    });
  }

  if ("validation" in error && Array.isArray((error as FastifyError).validation)) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: error.message,
    });
  }

  if ("statusCode" in error && error.statusCode === 429) {
    // Preserve the rate-limit plugin's payload (message, retryAfter) instead of
    // replacing it with the raw error message.
    const payload = (error as FastifyError & { retryAfter?: number }).retryAfter;
    return reply.status(429).send({
      error: "RATE_LIMITED",
      message: error.message,
      ...(payload !== undefined ? { retryAfter: payload } : {}),
    });
  }

  // Redis unavailable — map ioredis connection/command errors to 503
  if (isRedisError(error)) {
    request.log.error({ err: error }, "Redis unavailable");
    return reply.status(503).send({
      error: "SERVICE_UNAVAILABLE",
      message: "Serviço temporariamente indisponível. Tente novamente.",
    });
  }

  request.log.error({ err: error }, "Unhandled error");
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: env.NODE_ENV === "production" ? "An unexpected error occurred" : error.message,
  });
}

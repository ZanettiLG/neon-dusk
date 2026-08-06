import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { env } from "../env";

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

  request.log.error({ err: error }, "Unhandled error");
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: env.NODE_ENV === "production" ? "An unexpected error occurred" : error.message,
  });
}

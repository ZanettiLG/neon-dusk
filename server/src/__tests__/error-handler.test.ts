import { describe, it, expect, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, errorHandler } from "../middleware/error-handler";

function mockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

const mockRequest = {
  log: { error: vi.fn() },
} as unknown as FastifyRequest;

describe("errorHandler", () => {
  it("should respond with AppError status, code and message", () => {
    const reply = mockReply();
    const err = new AppError(404, "NOT_FOUND", "Gig not found");

    errorHandler(err, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: "NOT_FOUND",
      message: "Gig not found",
    });
  });

  it("should include details when AppError carries them", () => {
    const reply = mockReply();
    const err = new AppError(400, "VALIDATION_ERROR", "bad", [
      { path: ["a"], message: "Required" },
    ]);

    errorHandler(err, mockRequest, reply);

    expect(reply.send).toHaveBeenCalledWith({
      error: "VALIDATION_ERROR",
      message: "bad",
      details: [{ path: ["a"], message: "Required" }],
    });
  });

  it("should map ZodError to 400 VALIDATION_ERROR with mapped details", () => {
    const reply = mockReply();
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["body", "name"],
        message: "Required",
      },
    ]);

    errorHandler(zodError, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: [{ path: ["body", "name"], message: "Required" }],
    });
  });

  it("should map rate-limit 429 errors to RATE_LIMITED", () => {
    const reply = mockReply();
    const err = Object.assign(new Error("Too many requests"), { statusCode: 429 });

    errorHandler(err, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      error: "RATE_LIMITED",
      message: "Too many requests",
    });
  });

  it("should map ioredis MaxRetriesPerRequestError to 503 SERVICE_UNAVAILABLE", () => {
    const reply = mockReply();
    const err = new Error("Connection is closed");
    err.name = "MaxRetriesPerRequestError";

    errorHandler(err, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: "SERVICE_UNAVAILABLE",
      message: "Serviço temporariamente indisponível. Tente novamente.",
    });
  });

  it("should map ioredis ReplyError (with .command) to 503 SERVICE_UNAVAILABLE", () => {
    const reply = mockReply();
    const err = Object.assign(new Error("ERR unknown command"), { command: "INCR" });

    errorHandler(err, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: "SERVICE_UNAVAILABLE",
      message: "Serviço temporariamente indisponível. Tente novamente.",
    });
  });

  it("should map 'Stream isn't writeable' error to 503", () => {
    const reply = mockReply();
    const err = new Error("Stream isn't writeable and enableOfflineQueue options is false");

    errorHandler(err, mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: "SERVICE_UNAVAILABLE",
      message: "Serviço temporariamente indisponível. Tente novamente.",
    });
  });

  it("should return 500 INTERNAL_ERROR for unknown errors in non-production", () => {
    const reply = mockReply();
    errorHandler(new Error("boom"), mockRequest, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: "INTERNAL_ERROR",
      message: "boom",
    });
  });

  it("should hide error message in production", async () => {
    // errorHandler reads the validated env at module load; stub NODE_ENV and
    // reload the module so env.ts captures "production".
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { errorHandler: prodHandler } = await import("../middleware/error-handler");

    const reply = mockReply();
    prodHandler(new Error("boom"), mockRequest, reply);
    expect(reply.send).toHaveBeenCalledWith({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });

    vi.unstubAllEnvs();
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import type { Env } from "../env";

describe("Redis unavailable", () => {
  const env: Env = {
    NODE_ENV: "test",
    PORT: 0,
    HOST: "127.0.0.1",
    LOG_LEVEL: "fatal",
    DATABASE_URL: process.env.DATABASE_URL || "postgres://localhost:5432/neondusk_test",
    REDIS_URL: "redis://localhost:56380",
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters-long",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars-long",
    ADMIN_API_KEY: process.env.ADMIN_API_KEY || "test-admin-key-that-is-at-least-32-characters-long",
    PROMETHEUS_COLLECT_DEFAULTS: "false",
    CORS_ORIGIN: "*",
  };

  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env });
    // Test route that passes through the global rate limiter (which hits
    // Redis). When Redis is down, the limiter's Redis call fails and the
    // error propagates to the global error handler.
    app.get("/api/test-redis-guard", async (_req, reply) => {
      return reply.send({ ok: true });
    });
    await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 503 SERVICE_UNAVAILABLE when Redis is down", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-guard" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error).toBe("SERVICE_UNAVAILABLE");
    expect(body.message).toBe("Serviço temporariamente indisponível. Tente novamente.");
  });

  it("should not expose internal details in error message", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-guard" });
    const body = res.json();
    expect(body.message).not.toContain("maxRetriesPerRequest");
    expect(body.message).not.toContain("ioredis");
    expect(body.message).not.toContain("ECONNREFUSED");
    expect(body.message).not.toContain("Stream");
  });

  it("should return JSON content type", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-guard" });
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

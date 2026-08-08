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
    ROUND_DURATION_DAYS: 14,
    ROUND_INTERMISSION_MINUTES: 60,
    ANTI_CHEAT_STRICT_MODE: "true",
  };

  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env });
    // Route that only touches the DB — with the in-memory rate limiter, a
    // plain request must NEVER depend on Redis (ND-053: fail open).
    app.get("/api/test-redis-guard", async (_req, reply) => {
      return reply.send({ ok: true });
    });
    // Route that genuinely requires Redis — its failure maps to 503 via the
    // global error handler.
    app.get("/api/test-redis-required", async (_req, reply) => {
      await app.redis.ping();
      return reply.send({ ok: true });
    });
    await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should keep the app available (fail open) when Redis is down", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-guard" });
    expect(res.statusCode).toBe(200);
  });

  it("should return 503 SERVICE_UNAVAILABLE when a route genuinely needs Redis", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-required" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error).toBe("SERVICE_UNAVAILABLE");
    expect(body.message).toBe("Serviço temporariamente indisponível. Tente novamente.");
  });

  it("should report redis as disconnected on /api/health", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503); // degraded — DB up, Redis down
    const body = res.json();
    expect(body.status).toBe("degraded");
    expect(body.services.database).toBe("connected");
    expect(body.services.redis).toBe("disconnected");
  });

  it("should not expose internal details in error message", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test-redis-required" });
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

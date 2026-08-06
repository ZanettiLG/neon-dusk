import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json } from "./helpers";

// Dedicated app with a tiny limit + its own redis db (isolated counters).
const RATE_LIMIT_MAX = 3;

interface RateLimitedBody {
  error: string;
  message: string;
  retryAfter: number;
}

describe("rate limiting", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let redis: Redis;

  beforeAll(async () => {
    // Point this app's rate limiter at redis db 1 so the other tests (db 0)
    // don't share counters; flush to start clean.
    const env = envSchema.parse({
      ...process.env,
      RATE_LIMIT_MAX: String(RATE_LIMIT_MAX),
      REDIS_URL: "redis://localhost:56379/1",
    });

    redis = new Redis("redis://localhost:56379/1", { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
    await redis.flushdb();
    redis.disconnect();
  });

  it("should return 429 with RATE_LIMITED error after the limit is exceeded", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const res = await server.get("/api/health");
      expect(res.status).toBe(200);
    }

    const res = await server.get("/api/health");
    expect(res.status).toBe(429);
    const body = await json<RateLimitedBody>(res);
    expect(body.error).toBe("RATE_LIMITED");
    expect(typeof body.message).toBe("string");
    expect(body.message).toMatch(/Too many requests/);
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});

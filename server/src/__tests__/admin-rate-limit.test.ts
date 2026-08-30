import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { checkAdminRateLimit } from "../middleware/admin-rate-limit";

// ND-052 — admin rate limit middleware (checkAdminRateLimit). Unit tests call
// the returned preHandler directly. The 429 path uses a fake Redis returning a
// count above the hardcoded 6000/60s cap (no need to fire 6001 real INCRs);
// the within-limit path pre-seeds the counter one below the cap on a real
// Redis (db 13, self-flushed); the fail-open path simulates Redis returning
// null from exec().

const REDIS_TEST_DB = "redis://localhost:56379/13";
/** Mirrors the middleware's hardcoded cap (admin-rate-limit.ts). */
const ADMIN_RATE_LIMIT_MAX = 6000;

function requestFor(adminId: string) {
  return { user: { sub: adminId } } as unknown as FastifyRequest;
}

/** Fake Redis whose INCR/EXPIRE chain resolves to a fixed count. */
function fakeRedisWithCount(count: number): Redis {
  const chain = {
    incr: () => chain,
    expire: () => chain,
    exec: async () => [[null, count]],
  };
  return { multi: () => chain } as unknown as Redis;
}

/** Fake Redis whose exec() resolves to null (Redis unavailable — fail open). */
function fakeRedisNull(): Redis {
  const chain = {
    incr: () => chain,
    expire: () => chain,
    exec: async () => null,
  };
  return { multi: () => chain } as unknown as Redis;
}

describe("checkAdminRateLimit (ND-052)", () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    redis.disconnect();
  });

  it("should return a preHandler function from the factory", () => {
    expect(typeof checkAdminRateLimit(redis)).toBe("function");
  });

  it("should allow requests within the limit", async () => {
    const adminId = randomUUID();
    const preHandler = checkAdminRateLimit(redis);

    // Pre-seed the counter one below the cap — the next INCR lands exactly on
    // the limit, which is still allowed (count > max is the rejection rule).
    await redis.set(`ratelimit:admin:${adminId}`, String(ADMIN_RATE_LIMIT_MAX - 1));
    await expect(preHandler(requestFor(adminId))).resolves.toBeUndefined();
  });

  it("should reject with 429 ADMIN_RATE_LIMITED when the limit is exceeded", async () => {
    const preHandler = checkAdminRateLimit(fakeRedisWithCount(ADMIN_RATE_LIMIT_MAX + 1));

    await expect(preHandler(requestFor(randomUUID()))).rejects.toMatchObject({
      statusCode: 429,
      code: "ADMIN_RATE_LIMITED",
    });
  });

  it("should fail open when Redis is unavailable (exec returns null)", async () => {
    const preHandler = checkAdminRateLimit(fakeRedisNull());

    await expect(preHandler(requestFor(randomUUID()))).resolves.toBeUndefined();
  });
});
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import Redis from "ioredis";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import {
  checkActionRateLimit,
  rateLimitConfig,
  circuitBreakerConfig,
  type ActionType,
} from "../lib/rate-limit";

// ND-053 — per-character, per-action rate limiting (checkActionRateLimit).
// Unit tests call the returned preHandler directly against redis db 11
// (shared with street-cred tests — singleFork runs files sequentially and
// each file flushes its own db). Fail-open (Redis returning null) is
// simulated with a fake client.

const REDIS_TEST_DB = "redis://localhost:56379/11"; // shared with street-cred (sequential fork, self-flushed)

describe("checkActionRateLimit (anti-cheat rate limiter)", () => {
  let redis: Redis;

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    circuitBreakerConfig.strikeThreshold = 3; // ND-053 default (was 1000)
    redis.disconnect();
  });

  beforeAll(async () => {
    circuitBreakerConfig.strikeThreshold = 3;
    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
  });

  function requestFor(characterId: string) {
    return { user: { sub: characterId }, audit_context: {} } as unknown as FastifyRequest;
  }

  function mockReply() {
    return { header: vi.fn() } as unknown as FastifyReply;
  }

  it("should return a preHandler function from the factory", () => {
    const preHandler = checkActionRateLimit(redis, "gig_accept");
    expect(typeof preHandler).toBe("function");
  });

  it("should allow requests within the limit", async () => {
    const characterId = randomUUID();
    const preHandler = checkActionRateLimit(redis, "gig_accept"); // max 10

    for (let i = 0; i < rateLimitConfig.gig_accept.max; i++) {
      await expect(preHandler(requestFor(characterId), mockReply())).resolves.toBeUndefined();
    }
  });

  it("should set X-RateLimit-Remaining and X-RateLimit-Reset headers", async () => {
    const characterId = randomUUID();
    const preHandler = checkActionRateLimit(redis, "gig_accept");
    const reply = mockReply();

    await preHandler(requestFor(characterId), reply);

    // First request: (max - 1) remaining out of the configured maximum.
    const expectedRemaining = rateLimitConfig.gig_accept.max - 1;
    expect(reply.header).toHaveBeenCalledWith("X-RateLimit-Remaining", expectedRemaining);
    // X-RateLimit-Reset is an epoch-seconds timestamp in the future.
    const reset = vi.mocked(reply.header).mock.calls.find(
      ([name]) => name === "X-RateLimit-Reset",
    )?.[1] as number;
    expect(reset).toBeGreaterThan(Date.now() / 1000);
  });

  it("should reject with 429 RATE_LIMITED when the limit is exceeded", async () => {
    const characterId = randomUUID();
    const preHandler = checkActionRateLimit(redis, "pvp_attack"); // max 3

    for (let i = 0; i < rateLimitConfig.pvp_attack.max; i++) {
      await preHandler(requestFor(characterId), mockReply());
    }

    await expect(preHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMITED",
    });
  });

  it("should set circuit_break key after circuitBreakerConfig.strikeThreshold rate-limit hits", async () => {
    const characterId = randomUUID();
    const preHandler = checkActionRateLimit(redis, "pvp_attack");
    const max = rateLimitConfig.pvp_attack.max;

    // Exhaust the per-action limit by setting the counter just below max,
    // then call once more to trip the limit (strike 1).
    await redis.set(`rate:${characterId}:pvp_attack`, max);
    await expect(preHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMITED",
    });

    // Send (threshold - 2) more rate-limited requests — the initial call was
    // already strike 1, so these are strikes 2..(threshold-1) → plain
    // RATE_LIMITED. The NEXT call trips the circuit (strike = threshold).
    for (let i = 0; i < circuitBreakerConfig.strikeThreshold - 2; i++) {
      await expect(preHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
        statusCode: 429,
        code: "RATE_LIMITED",
      });
    }

    // Next call: cb_count hits threshold → 24h ban thrown.
    await expect(preHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
      statusCode: 429,
      code: "CIRCUIT_BREAK",
      message: expect.stringMatching(/Sistema neural sobrecarregado/),
      details: { retryAfter: 86_400 },
    });

    expect(await redis.exists(`circuit_break:${characterId}`)).toBe(1);
    const ttl = await redis.ttl(`circuit_break:${characterId}`);
    expect(ttl).toBeGreaterThan(86_000); // ~24h ban, allow second-boundary drift
    expect(await redis.get(`cb_count:${characterId}`)).toBe(String(circuitBreakerConfig.strikeThreshold));
  });

  it("should reset the counter after the window expires (allows requests again)", async () => {
    const characterId = randomUUID();
    const preHandler = checkActionRateLimit(redis, "gig_accept"); // max 10, window 60s

    // Exhaust the limit by setting the counter at max → next request rejects.
    await redis.set(`rate:${characterId}:gig_accept`, rateLimitConfig.gig_accept.max);
    await expect(preHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMITED",
    });

    // Simulate window expiry (Redis EXPIRE would delete the key after 60s).
    await redis.del(`rate:${characterId}:gig_accept`);

    // A fresh window allows requests again.
    await expect(preHandler(requestFor(characterId), mockReply())).resolves.toBeUndefined();
  });

  it("should keep counters independent across different actions", async () => {
    const characterId = randomUUID();
    const pvpPreHandler = checkActionRateLimit(redis, "pvp_attack");
    const gigPreHandler = checkActionRateLimit(redis, "gig_accept");

    // Exhaust pvp_attack by setting counter at max → next call rejects.
    await redis.set(`rate:${characterId}:pvp_attack`, rateLimitConfig.pvp_attack.max);
    await expect(pvpPreHandler(requestFor(characterId), mockReply())).rejects.toMatchObject({
      statusCode: 429,
    });

    // gig_accept has its own untouched counter → still passes.
    await expect(gigPreHandler(requestFor(characterId), mockReply())).resolves.toBeUndefined();
    expect(await redis.exists(`rate:${characterId}:gig_accept`)).toBe(1);
  });

  it("should fail open when Redis is unavailable (exec returns null)", async () => {
    // Fake client whose multi().exec() resolves null (ioredis's "transaction
    // not executed" signal) — the middleware must allow the request.
    const chainable = {
      incr: function () {
        return this;
      },
      expire: function () {
        return this;
      },
      exec: async () => null,
    };
    const deadRedis = {
      multi: () => chainable,
    } as unknown as Redis;

    const preHandler = checkActionRateLimit(deadRedis, "gig_accept");
    await expect(preHandler(requestFor(randomUUID()), mockReply())).resolves.toBeUndefined();
  });
});

describe("rateLimitConfig", () => {
  it("should define limits for every anti-cheat action", () => {
    const actions: ActionType[] = [
      "gig_accept",
      "gig_execute",
      "gig_submit",
      "pvp_attack",
      "saideira_chat",
      "crew_invite",
      "chrome_install",
      "chrome_uninstall",
      "economy_transact",
      "character_create",
      "vendor_purchase",
      "stim_use",
    ];
    for (const action of actions) {
      expect(rateLimitConfig[action].max).toBeGreaterThan(0);
      expect(rateLimitConfig[action].windowMs).toBeGreaterThan(0);
    }
  });
});

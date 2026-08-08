import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json } from "./helpers";

/**
 * Stress test for auth rate limiting (closes #81).
 *
 * Simulates a brute-force attack (100 rapid login attempts with wrong
 * credentials) and verifies:
 *   1. Per-email rate limit kicks in after 5 attempts (401 → 429)
 *   2. All rate-limited responses are correct (status, body, headers)
 *   3. Rate limiting one email does not affect another
 *   4. Legitimate requests work after the counter expires
 *
 * Uses a dedicated Redis DB (3) with a high global limit (1000) so the
 * per-email rate limit is the only bottleneck under load.
 */

const REDIS_DB = "redis://localhost:56379/3";
const GLOBAL_LIMIT = 1000; // high enough for hundreds of stress requests
const PASSWORD = "StrongPass123!";
const WRONG_PASSWORD = "WrongPass999!";

interface RateLimitedBody {
  error: string;
  message: string;
  retryAfter?: number;
}

interface ErrorBody {
  error: string;
  message: string;
}

let emailSeq = 0;
function uniqueEmail(): string {
  return `stress-${Date.now()}-${emailSeq++}@neondusk.test`;
}

describe("Rate limit stress test — auth endpoints (#81)", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let redis: Redis;

  beforeAll(async () => {
    const testEnv = envSchema.parse({
      ...process.env,
      RATE_LIMIT_MAX: String(GLOBAL_LIMIT),
      REDIS_URL: REDIS_DB,
    });

    redis = new Redis(REDIS_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: testEnv });
    server = await startTestServer(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await redis.flushdb();
    redis.disconnect();
  });

  // Reset the global rate limit counters between test groups so the
  // global 1000/min budget is never exhausted by cumulative requests.
  beforeEach(async () => {
    const keys = await redis.keys("fastify-rate-limit-*");
    if (keys.length) await redis.del(keys);
  });

  /** Register a user and return the email. */
  async function registerUser(email: string): Promise<void> {
    const res = await server.post("/api/auth/register", { email, password: PASSWORD });
    expect(res.status).toBe(201);
  }

  /** Fire a single login request and return the status + body. */
  async function attemptLogin(email: string, password: string): Promise<{ status: number; body: ErrorBody | RateLimitedBody }> {
    const res = await server.post("/api/auth/login", { email, password });
    const body = await json<ErrorBody | RateLimitedBody>(res);
    return { status: res.status, body };
  }

  describe("sequential brute force (100 rapid login attempts, same email)", () => {
    const STRESS_COUNT = 100;
    const PER_EMAIL_MAX = 5; // LOGIN_RATE_LIMIT in auth-service.ts

    it("should allow up to 5 attempts then return 429 for all subsequent requests", async () => {
      const email = uniqueEmail();
      await registerUser(email);

      const results: { status: number; body: ErrorBody | RateLimitedBody }[] = [];
      for (let i = 0; i < STRESS_COUNT; i++) {
        const r = await attemptLogin(email, WRONG_PASSWORD);
        results.push(r);
      }

      // First PER_EMAIL_MAX requests: should get 401 (wrong password, within limit)
      const allowed = results.slice(0, PER_EMAIL_MAX);
      for (const r of allowed) {
        expect(r.status).toBe(401);
        expect((r.body as ErrorBody).error).toBe("INVALID_CREDENTIALS");
      }

      // Remaining requests: should get 429 (rate limited)
      const blocked = results.slice(PER_EMAIL_MAX);
      for (const r of blocked) {
        expect(r.status).toBe(429);
        expect((r.body as ErrorBody).error).toBe("RATE_LIMITED");
      }

      // Verify exact counts
      const status401 = results.filter((r) => r.status === 401);
      const status429 = results.filter((r) => r.status === 429);
      expect(status401.length).toBe(PER_EMAIL_MAX);
      expect(status429.length).toBe(STRESS_COUNT - PER_EMAIL_MAX);
    });

    it("should return consistent error body shape on all 429 responses", async () => {
      const email = uniqueEmail();
      await registerUser(email);

      // Exhaust the rate limit
      for (let i = 0; i < PER_EMAIL_MAX + 5; i++) {
        await attemptLogin(email, WRONG_PASSWORD);
      }

      // All subsequent should be consistent 429
      const blocked = await attemptLogin(email, WRONG_PASSWORD);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toBe("RATE_LIMITED");
      expect(typeof blocked.body.message).toBe("string");
      expect(blocked.body.message.length).toBeGreaterThan(0);
    });
  });

  describe("concurrent brute force (100 concurrent login attempts, same email)", () => {
    const CONCURRENT_COUNT = 100;

    it("should allow at most the per-email limit under concurrent load", async () => {
      const email = uniqueEmail();
      await registerUser(email);

      // Fire all 100 requests concurrently
      const promises = Array.from({ length: CONCURRENT_COUNT }, () =>
        fetch(`http://127.0.0.1:${server.port}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: WRONG_PASSWORD }),
        }).then(async (res) => ({
          status: res.status,
          body: (await res.json()) as ErrorBody,
        })),
      );

      const results = await Promise.all(promises);

      const status401 = results.filter((r) => r.status === 401);
      const status429 = results.filter((r) => r.status === 429);

      // Under concurrent load, Redis INCR is atomic but requests can be
      // interleaved. At most PER_EMAIL_MAX (5) should pass, but due to
      // concurrent timing, fewer than 5 might succeed. Zero failures
      // would indicate the rate limit isn't working at all.
      expect(status401.length).toBeGreaterThan(0);
      expect(status401.length).toBeLessThanOrEqual(5);
      expect(status429.length).toBeGreaterThanOrEqual(CONCURRENT_COUNT - 5);

      // All 429 responses should have the correct error code
      for (const r of status429) {
        expect(r.body.error).toBe("RATE_LIMITED");
      }
    });
  });

  describe("rate limit headers", () => {
    it("should include X-RateLimit-* headers on all auth responses", async () => {
      const email = uniqueEmail();
      await registerUser(email);

      const res = await server.post("/api/auth/login", { email, password: WRONG_PASSWORD });

      // Global rate limit headers should be present (set by @fastify/rate-limit)
      const limit = res.headers.get("x-ratelimit-limit");
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset");

      expect(limit).toBe(String(GLOBAL_LIMIT));
      expect(remaining).toBeDefined();
      expect(Number(remaining)).toBeGreaterThanOrEqual(0);
      expect(Number(remaining)).toBeLessThan(Number(limit));
      expect(reset).toBeDefined();
      expect(Number(reset)).toBeGreaterThan(0);
    });

    it("should decrement X-RateLimit-Remaining on successive auth requests", async () => {
      const email1 = uniqueEmail();
      const email2 = uniqueEmail();
      await registerUser(email1);
      await registerUser(email2);

      const res1 = await server.post("/api/auth/login", { email: email1, password: WRONG_PASSWORD });
      const remaining1 = Number(res1.headers.get("x-ratelimit-remaining"));

      const res2 = await server.post("/api/auth/login", { email: email2, password: WRONG_PASSWORD });
      const remaining2 = Number(res2.headers.get("x-ratelimit-remaining"));

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe("rate limit isolation", () => {
    it("should not affect login attempts for a different email", async () => {
      const blockedEmail = uniqueEmail();
      const freeEmail = uniqueEmail();
      await registerUser(blockedEmail);
      await registerUser(freeEmail);

      // Exhaust the rate limit on blockedEmail
      for (let i = 0; i < 6; i++) {
        await attemptLogin(blockedEmail, WRONG_PASSWORD);
      }

      // blockedEmail is now rate-limited
      const blockedAttempt = await attemptLogin(blockedEmail, PASSWORD);
      expect(blockedAttempt.status).toBe(429);

      // freeEmail should still work
      const freeAttempt = await attemptLogin(freeEmail, PASSWORD);
      expect(freeAttempt.status).toBe(200);
    });
  });

  describe("recovery after counter expiry", () => {
    it("should allow legitimate login after the counter is cleared", async () => {
      const email = uniqueEmail();
      await registerUser(email);

      // Exhaust the rate limit
      for (let i = 0; i < 6; i++) {
        await attemptLogin(email, WRONG_PASSWORD);
      }

      // Verify blocked
      const blocked = await attemptLogin(email, PASSWORD);
      expect(blocked.status).toBe(429);

      // Simulate counter expiry by deleting the key
      const deleted = await redis.del("auth:rl:login:" + email);
      expect(deleted).toBe(1);

      // Now a legitimate login should work
      const recovered = await server.post("/api/auth/login", { email, password: PASSWORD });
      expect(recovered.status).toBe(200);
    });
  });
});

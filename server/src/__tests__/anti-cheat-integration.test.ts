import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthResponse } from "@neon-dusk/shared";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { checkCooldown } from "../middleware/cooldown";
import { setAuditContext } from "../middleware/audit-middleware";
import { validate } from "../middleware/validate";
import { checkActionRateLimit, circuitBreakerConfig } from "../lib/rate-limit";
import { characterRepository as characters } from "../repositories/character-repository";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
import { db } from "../db";

// ND-053 — full anti-cheat middleware chain over real HTTP: circuit-breaker →
// cooldown → validation → per-action rate limit → handler, with the audit
// onResponse hook writing audit_log rows. The chain is mounted on dedicated
// test routes (registered after buildApp) so the tests exercise the exact
// middleware pipeline without route-specific game logic. Redis db 12 (shared
// with pvp-integration — singleFork runs files sequentially; each flushes its
// db). resetDb cascades into audit_log via the characters FK.

const REDIS_TEST_DB = "redis://localhost:56379/12"; // shared with pvp-integration (sequential fork, self-flushed)
const PASSWORD = "StrongPass123!";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

interface ErrorBody {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
}

/** Raw audit_log row shape (snake_case — as returned by Knex). */
interface AuditRow {
  id: string;
  character_id: string | null;
  action: string;
  result: string;
  ip: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let seq = 0;
function uniqueEmail(): string {
  return `anti-cheat-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `AC-${Date.now().toString().slice(-8)}-${seq++}`; // ≤24 chars (schema max)
}

describe("ND-053 — anti-cheat middleware chain (integration)", () => {
  let app: FastifyInstance;
  let server: TestServer;
  let redis: Redis;

  beforeAll(async () => {
    // Lower threshold so circuit-break still fires after 3 strikes.
    circuitBreakerConfig.strikeThreshold = 3;

    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });

    // Route A: full chain (cooldown + validate + rate limit). The handler
    // mimics real routes (ADR-2): sets the cooldown key only after success.
    app.post(
      "/api/test/anti-cheat-action",
      {
        preHandler: [
          authenticate,
          // NOTE: must be async — Fastify 5's preHandler runner deadlocks on
          // sync hooks (only advances when the hook returns a promise).
          setAuditContext("saideira_chat"),
          checkCircuitBreaker(redis),
          checkCooldown(redis, "chat_message"),
          validate(chatSchema),
          checkActionRateLimit(redis, "saideira_chat"),
        ],
      },
      async (request, reply) => {
        // ADR-2: cooldown is keyed by the DB character id — the same id
        // checkCooldown resolves via characters.requireByUserId (NOT the JWT sub).
        const characterId = (await characters.requireByUserId(request.user.sub)).id;
        await redis.setex(`cooldown:${characterId}:chat_message`, 5, "1");
        return reply.status(201).send({ ok: true });
      },
    );

    // Route B: chain without cooldown (mirrors vendors.ts) — used to hammer
    // the rate limiter without the 5s chat cooldown interfering.
    app.post(
      "/api/test/anti-cheat-action-b",
      {
        preHandler: [
          authenticate,
          setAuditContext("vendor_purchase"),
          checkCircuitBreaker(redis),
          validate(chatSchema),
          checkActionRateLimit(redis, "vendor_purchase"), // max 10 / min
        ],
      },
      async (_request) => ({ ok: true }),
    );

    server = await startTestServer(app);
  });

  afterAll(async () => {
    circuitBreakerConfig.strikeThreshold = 1000;
    await app.close();
    redis.disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    await redis.flushdb();
  });

  // ─── Test seams ───────────────────────────────────────────────────────────

  async function registerApiUser(): Promise<{
    accessToken: string;
    userId: string; // JWT sub — keys the rate/cooldown/circuit-break counters
    characterId: string; // the game character — keyed in audit_log rows
  }> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);

    const created = await server.post(
      "/api/characters",
      {
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      },
      authHeader(accessToken),
    );
    expect(created.status).toBe(201);
    const character = await json<{ id: string; userId: string }>(created);
    return { accessToken, userId: character.userId, characterId: character.id };
  }

  async function postAction(token: string, body: unknown, headers?: Record<string, string>) {
    return server.post("/api/test/anti-cheat-action", body, { ...authHeader(token), ...headers });
  }


  /** Poll audit_log until the expected rows for a character+action exist. */
  async function waitForAudit(
    characterId: string,
    action: string,
    expected: number,
    timeoutMs = 2000,
  ): Promise<AuditRow[]> {
    const deadline = Date.now() + timeoutMs;
    let rows: AuditRow[] = [];
    while (Date.now() < deadline) {
      rows = await db("audit_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("action", action)
        .orderBy("created_at", "desc");
      if (rows.length >= expected) return rows;
      await sleep(25);
    }
    return rows;
  }

  // ─── Tests ────────────────────────────────────────────────────────────────

  it("should pass a valid request through the full chain and audit it as allowed", async () => {
    const { accessToken, characterId } = await registerApiUser();

    const res = await postAction(accessToken, { message: "oi" }, { "User-Agent": "anti-cheat-test/1.0" });
    expect(res.status).toBe(201);

    const [row] = await waitForAudit(characterId, "saideira_chat", 1);
    expect(row).toBeDefined();
    expect(row.character_id).toBe(characterId);
    expect(row.result).toBe("allowed");
    expect(row.ip).toBe("127.0.0.1");
    expect(row.user_agent).toBe("anti-cheat-test/1.0");
  });

  it("should return 400 with validation details and NOT set the cooldown on failure", async () => {
    const { accessToken, characterId } = await registerApiUser();

    // Empty-after-trim message fails min(1) validation.
    const invalid = await postAction(accessToken, { message: "   " });
    expect(invalid.status).toBe(400);
    const invalidBody = await json<ErrorBody>(invalid);
    expect(invalidBody.error).toBe("VALIDATION_ERROR");
    expect(invalidBody.details).toBeDefined();
    expect(JSON.stringify(invalidBody.details)).toContain("message");

    // ADR-2: the cooldown key (keyed by character id, resolved via
    // characters.requireByUserId) is only set after a successful action.
    expect(await redis.exists(`cooldown:${characterId}:chat_message`)).toBe(0);

    // The failed validation is still audit-logged with result validation_error.
    const [failedRow] = await waitForAudit(characterId, "saideira_chat", 1);
    expect(failedRow.result).toBe("validation_error");

    // A subsequent valid request succeeds and NOW sets the cooldown.
    const ok = await postAction(accessToken, { message: "oi" });
    expect(ok.status).toBe(201);
    expect(await redis.exists(`cooldown:${characterId}:chat_message`)).toBe(1);
  });

  it("should return 400 for a type mismatch (number where string expected)", async () => {
    const { accessToken } = await registerApiUser();

    const res = await postAction(accessToken, { message: 123 });
    expect(res.status).toBe(400);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("should reject with 429 RATE_LIMITED, set headers, and keep other actions independent", async () => {
    const { accessToken, userId, characterId } = await registerApiUser();

    // Pre-set the vendor_purchase counter so the next request trips the limit.
    // The first request passes and carries rate-limit headers.
    await redis.set(`rate:${userId}:vendor_purchase`, 1); // next INCR → 2, well within max 1000
    const okRes = await server.post(
      "/api/test/anti-cheat-action-b",
      { message: "ok" },
      authHeader(accessToken),
    );
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("X-RateLimit-Remaining")).toBeTruthy();
    expect(okRes.headers.get("X-RateLimit-Reset")).toBeTruthy();

    // Now set the counter at max (1000). Next INCR → 1001, exceeding limit.
    await redis.set(`rate:${userId}:vendor_purchase`, 1000);
    const limited = await server.post(
      "/api/test/anti-cheat-action-b",
      { message: "exceed" },
      authHeader(accessToken),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    const body = await json<ErrorBody>(limited);
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBeGreaterThan(0);

    // Different action (saideira_chat) has its own counter → still passes.
    const other = await postAction(accessToken, { message: "oi" });
    expect(other.status).toBe(201);

    // The rate-limited request was audit-logged as rate_limited.
    const rows = await waitForAudit(characterId, "vendor_purchase", 2);
    expect(rows.filter((r) => r.result === "rate_limited")).toHaveLength(1);
    expect(rows.filter((r) => r.result === "allowed")).toHaveLength(1);
  });

  it("should circuit-break after circuitBreakerConfig.strikeThreshold rate-limit hits and block ALL actions", async () => {
    const { accessToken, userId, characterId } = await registerApiUser();

    // Pre-set the vendor_purchase counter at max. Every request from here on
    // exceeds the limit and becomes a rate-limit strike.
    await redis.set(`rate:${userId}:vendor_purchase`, 1000);

    // Strikes 1 through (threshold-1) → plain rate limit.
    for (let i = 0; i < circuitBreakerConfig.strikeThreshold - 1; i++) {
      const res = await server.post(
        "/api/test/anti-cheat-action-b",
        { message: `strike-${i}` },
        authHeader(accessToken),
      );
      expect(res.status).toBe(429);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("RATE_LIMITED");
    }

    // Strike = threshold → circuit-break: the ban key is set, message changes.
    const tripped = await server.post(
      "/api/test/anti-cheat-action-b",
      { message: "trip" },
      authHeader(accessToken),
    );
    expect(tripped.status).toBe(429);
    const cbBody = await json<ErrorBody>(tripped);
    expect(cbBody.error).toBe("CIRCUIT_BREAK");
    expect(cbBody.message).toMatch(/Sistema neural sobrecarregado/);
    expect(tripped.headers.get("retry-after")).toBeTruthy();

    // Every subsequent request stays banned.
    const banned = await server.post(
      "/api/test/anti-cheat-action-b",
      { message: "after-ban" },
      authHeader(accessToken),
    );
    expect(banned.status).toBe(429);
    expect(await redis.exists(`circuit_break:${userId}`)).toBe(1);

    // The ban is global: a DIFFERENT action on the same character is blocked.
    const otherAction = await postAction(accessToken, { message: "oi" });
    expect(otherAction.status).toBe(429);
    const otherBody = await json<ErrorBody>(otherAction);
    expect(otherBody.error).toBe("CIRCUIT_BREAK");

    // The blocked request never reached the rate limiter → no counter for it.
    expect(await redis.exists(`rate:${userId}:saideira_chat`)).toBe(0);

    // Audit trail: rate_limited for each of the (threshold - 1) plain strikes
    // + circuit_break for the trip request AND the after-ban request.
    const expectedTotal = circuitBreakerConfig.strikeThreshold + 1;
    const rows = await waitForAudit(characterId, "vendor_purchase", expectedTotal);
    expect(rows).toHaveLength(expectedTotal);
    expect(rows.filter((r) => r.result === "rate_limited")).toHaveLength(
      circuitBreakerConfig.strikeThreshold - 1,
    );
    expect(rows.filter((r) => r.result === "circuit_break")).toHaveLength(2);
  });
});

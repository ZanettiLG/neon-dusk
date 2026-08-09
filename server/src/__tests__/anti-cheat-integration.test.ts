import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { AuthResponse } from "@neon-dusk/shared";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { authenticate } from "../middleware/auth";
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { checkCooldown } from "../middleware/cooldown";
import { setAuditContext } from "../middleware/audit-middleware";
import { validate } from "../middleware/validate";
import { checkActionRateLimit, CB_STRIKE_THRESHOLD } from "../lib/rate-limit";
import { requireCharacterId } from "../services/economy-service";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
import { db } from "../db";
import { auditLog } from "../db/schema";

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

type AuditRow = typeof auditLog.$inferSelect;

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
        // checkCooldown resolves via requireCharacterId (NOT the JWT sub).
        const characterId = await requireCharacterId(request.user.sub);
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
      async (request) => ({ ok: true }),
    );

    server = await startTestServer(app);
  });

  afterAll(async () => {
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

  async function hammerB(token: string, count: number): Promise<Response[]> {
    const responses: Response[] = [];
    for (let i = 0; i < count; i++) {
      responses.push(
        await server.post(
          "/api/test/anti-cheat-action-b",
          { message: `msg-${i}` },
          authHeader(token),
        ),
      );
    }
    return responses;
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
      rows = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.characterId, characterId), eq(auditLog.action, action)))
        .orderBy(desc(auditLog.createdAt));
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
    expect(row.characterId).toBe(characterId);
    expect(row.result).toBe("allowed");
    expect(row.ip).toBe("127.0.0.1");
    expect(row.userAgent).toBe("anti-cheat-test/1.0");
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
    // requireCharacterId) is only set after a successful action.
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
    const { accessToken, characterId } = await registerApiUser();

    // vendor_purchase max 10 — the first response carries rate-limit headers.
    const responses = await hammerB(accessToken, 11);
    expect(responses[0].headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(responses[0].headers.get("X-RateLimit-Reset")).toBeTruthy();
    expect(responses[9].status).toBe(200); // 10th within limit

    const limited = responses[10];
    expect(limited.status).toBe(429);
    // ND-053: RATE_LIMITED 429 responses carry the Retry-After header.
    expect(limited.headers.get("retry-after")).toBeTruthy();
    const body = await json<ErrorBody>(limited);
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfter).toBeGreaterThan(0);

    // Different action (saideira_chat) has its own counter → still passes.
    const other = await postAction(accessToken, { message: "oi" });
    expect(other.status).toBe(201);

    // The 11th request was audit-logged as rate_limited.
    const rows = await waitForAudit(characterId, "vendor_purchase", 11);
    expect(rows.filter((r) => r.result === "rate_limited")).toHaveLength(1);
    expect(rows.filter((r) => r.result === "allowed")).toHaveLength(10);
  });

  it("should circuit-break after CB_STRIKE_THRESHOLD rate-limit hits and block ALL actions", async () => {
    const { accessToken, userId, characterId } = await registerApiUser();

    // vendor_purchase (max 10): counts 1-10 pass, then every further request
    // exceeds — strikes land on counts 11 through (10 + threshold). Circuit
    // break on the (10 + threshold)-th call, when cb_count hits threshold.
    const totalCalls = 10 + CB_STRIKE_THRESHOLD + 20;
    const responses = await hammerB(accessToken, totalCalls);

    // First 10 within the limit.
    for (let i = 0; i < 10; i++) expect(responses[i].status).toBe(200);

    // Strikes 1 through (threshold-1) → plain rate limit.
    for (let i = 10; i < 10 + CB_STRIKE_THRESHOLD - 1; i++) {
      expect(responses[i].status).toBe(429);
      const body = await json<ErrorBody>(responses[i]);
      expect(body.error).toBe("RATE_LIMITED");
    }

    // Strike = threshold → circuit-break: the ban key is set, message changes.
    const tripIdx = 10 + CB_STRIKE_THRESHOLD - 1;
    const tripped = responses[tripIdx];
    expect(tripped.status).toBe(429);
    const cbBody = await json<ErrorBody>(tripped);
    expect(cbBody.error).toBe("CIRCUIT_BREAK");
    expect(cbBody.message).toMatch(/Sistema neural sobrecarregado/);
    expect(tripped.headers.get("retry-after")).toBeTruthy();

    // Every subsequent request stays banned (20 more attempts).
    expect(responses[totalCalls - 1].status).toBe(429);
    expect(await redis.exists(`circuit_break:${userId}`)).toBe(1);

    // The ban is global: a DIFFERENT action on the same character is blocked.
    const otherAction = await postAction(accessToken, { message: "oi" });
    expect(otherAction.status).toBe(429);
    const otherBody = await json<ErrorBody>(otherAction);
    expect(otherBody.error).toBe("CIRCUIT_BREAK");

    // The blocked request never reached the rate limiter → no counter for it.
    expect(await redis.exists(`rate:${userId}:saideira_chat`)).toBe(0);

    // Audit trail: 10 allowed + CB_STRIKE_THRESHOLD rate_limited + 20 circuit_break.
    const rows = await waitForAudit(characterId, "vendor_purchase", totalCalls);
    expect(rows.filter((r) => r.result === "allowed")).toHaveLength(10);
    expect(rows.filter((r) => r.result === "rate_limited")).toHaveLength(CB_STRIKE_THRESHOLD);
    expect(rows.filter((r) => r.result === "circuit_break")).toHaveLength(20);
  });
});

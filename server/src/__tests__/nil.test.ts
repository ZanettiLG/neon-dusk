import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader } from "./helpers";
import type {
  AuthResponse,
  CreateCharacterRequest,
  NilConsumeResponse,
  NilStatus,
  NilStimResponse,
} from "@neon-dusk/shared";
import { NIL_REGEN_INTERVAL_MS } from "@neon-dusk/shared";
import { calculateRegen } from "../services/nil-service";

// Feature #2 — NIL (energy) API integration tests: live readout (lazy regen),
// consume (spend), and syn-café (restore with cooldown). Runs against the real
// Fastify app + Postgres + a dedicated redis db (4) that is flushed before the
// run, so neither the global per-IP rate limit nor leftover `nil:stim:*`
// cooldown keys leak between runs (same pattern as auth.test.ts / db 2).

const REDIS_TEST_DB = "redis://localhost:56379/4";

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `nil-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Runner-${Date.now()}-${seq++}`;
}

/** Valid attribute spread: 3 base × 5 + 7 free points = 22. */
function validAttributes(): CreateCharacterRequest["attributes"] {
  return { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };
}

interface ErrorBody {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

describe("Feature #2 — NIL API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Register a fresh account and create a character, returning the access token. */
  async function registerAndCreateCharacter(email: string): Promise<string> {
    const res = await server.post("/api/auth/register", { email, password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);

    const created = await fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: validAttributes(),
      }),
    });
    expect(created.status).toBe(201);
    return accessToken;
  }

  function getNil(accessToken: string): Promise<Response> {
    return fetch(`${base()}/api/characters/me/nil`, { headers: authHeader(accessToken) });
  }

  function consumeNil(
    accessToken: string,
    amount: unknown,
  ): Promise<Response> {
    return fetch(`${base()}/api/characters/me/nil/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({ amount }),
    });
  }

  function useStim(accessToken: string): Promise<Response> {
    return fetch(`${base()}/api/characters/me/nil/use-stim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: "{}",
    });
  }

  describe("GET /api/characters/me/nil", () => {
    it("should return a full NIL readout for a freshly created character", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await getNil(accessToken);

      expect(res.status).toBe(200);
      const body = await json<NilStatus>(res);
      expect(body.current).toBe(100);
      expect(body.max).toBe(100);
      expect(body.regenerating).toBe(false);
      expect(body.nextTickSeconds).toBe(0); // full: no pending tick
      expect(typeof body.updatedAt).toBe("string");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/characters/me/nil");

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("should return 404 when the user has no character", async () => {
      const res = await server.post("/api/auth/register", {
        email: uniqueEmail(),
        password: PASSWORD,
      });
      const { accessToken } = await json<AuthResponse>(res);

      const nilRes = await getNil(accessToken);

      expect(nilRes.status).toBe(404);
      const body = await json<ErrorBody>(nilRes);
      expect(body.error).toBe("CHARACTER_NOT_FOUND");
    });

    it("should reflect a consumed amount before any regen tick", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const consumed = await consumeNil(accessToken, 30);
      expect(consumed.status).toBe(200);
      const { remaining } = await json<NilConsumeResponse>(consumed);
      expect(remaining).toBe(70);

      const res = await getNil(accessToken);
      expect(res.status).toBe(200);
      const body = await json<NilStatus>(res);
      expect(body.current).toBe(70);
      expect(body.max).toBe(100);
      expect(body.regenerating).toBe(true);
      // Snapshot was just persisted — next tick is a full 5min away (1..300s).
      expect(body.nextTickSeconds).toBeGreaterThan(0);
      expect(body.nextTickSeconds).toBeLessThanOrEqual(300);
    });
  });

  describe("POST /api/characters/me/nil/consume", () => {
    it("should consume 30 NIL and return the remaining 70", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, 30);

      expect(res.status).toBe(200);
      const body = await json<NilConsumeResponse>(res);
      expect(body.consumed).toBe(30);
      expect(body.remaining).toBe(70);
      expect(body.status.current).toBe(70);
      expect(body.status.max).toBe(100);
      expect(body.status.regenerating).toBe(true);
    });

    it("should consume the entire NIL pool and return 0", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, 100);

      expect(res.status).toBe(200);
      const body = await json<NilConsumeResponse>(res);
      expect(body.consumed).toBe(100);
      expect(body.remaining).toBe(0);
      expect(body.status.current).toBe(0);
      expect(body.status.regenerating).toBe(true);
    });

    it("should return 400 INSUFFICIENT_NIL when the amount exceeds the pool", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());
      // Pool is 100/100 fresh; spend first so an amount ≤ schema max (100)
      // can still exceed what's left.
      const spent = await consumeNil(accessToken, 30);
      expect(spent.status).toBe(200);

      const res = await consumeNil(accessToken, 71);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INSUFFICIENT_NIL");
    });

    it("should return 400 VALIDATION_ERROR for an amount above the schema cap", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, 101);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for a zero amount", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, 0);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for a negative amount", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, -5);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for a non-integer amount", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await consumeNil(accessToken, 1.5);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/characters/me/nil/consume", { amount: 10 });

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/characters/me/nil/use-stim", () => {
    it("should return 400 NIL_FULL when NIL is already full", async () => {
      // Fresh character sits at 100/100; the stim guard rejects instead of
      // burning the 1h cooldown for zero gain.
      const accessToken = await registerAndCreateCharacter(uniqueEmail());

      const res = await useStim(accessToken);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NIL_FULL");
    });

    it("should restore 15 NIL and cap at 100 when starting at 85", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());
      const consumed = await consumeNil(accessToken, 15);
      expect(consumed.status).toBe(200);

      const res = await useStim(accessToken);

      expect(res.status).toBe(200);
      const body = await json<NilStimResponse>(res);
      expect(body.added).toBe(15);
      expect(body.status.current).toBe(100);
      expect(body.status.regenerating).toBe(false);
    });

    it("should restore the full 20 NIL when starting at 80", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());
      const consumed = await consumeNil(accessToken, 20);
      expect(consumed.status).toBe(200);

      const res = await useStim(accessToken);

      expect(res.status).toBe(200);
      const body = await json<NilStimResponse>(res);
      expect(body.added).toBe(20);
      expect(body.status.current).toBe(100);
    });

    it("should reject a second stim with NIL_STIM_COOLDOWN and retryAfterSeconds", async () => {
      const accessToken = await registerAndCreateCharacter(uniqueEmail());
      await consumeNil(accessToken, 20); // 80 → stim lands exactly at 100

      const first = await useStim(accessToken);
      expect(first.status).toBe(200);

      const res = await useStim(accessToken);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NIL_STIM_COOLDOWN");
      // Cooldown is 1h; TTL may already be a tick under it.
      const retryAfter = body.details?.retryAfterSeconds as number;
      expect(retryAfter).toBeGreaterThan(3500);
      expect(retryAfter).toBeLessThanOrEqual(3600);
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/characters/me/nil/use-stim", {});

      expect(res.status).toBe(401);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("should return 404 when the user has no character", async () => {
      const res = await server.post("/api/auth/register", {
        email: uniqueEmail(),
        password: PASSWORD,
      });
      const { accessToken } = await json<AuthResponse>(res);

      const stimRes = await useStim(accessToken);

      expect(stimRes.status).toBe(404);
      const body = await json<ErrorBody>(stimRes);
      expect(body.error).toBe("CHARACTER_NOT_FOUND");
    });
  });
});

// --- calculateRegen (pure unit — no server, no DB) -----------------------------
// Deterministic via fake system time; `lastUpdated` is expressed relative to
// that fixed "now" so elapsed is exact.

describe("calculateRegen", () => {
  const NOW = new Date("2026-08-06T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should keep NIL unchanged with 0ms elapsed and schedule the next tick at 300s", () => {
    const result = calculateRegen(50, 100, new Date(NOW));

    expect(result.newNil).toBe(50);
    expect(result.nextTickSeconds).toBe(300);
  });

  it("should regen +1 after exactly one interval (5 minutes)", () => {
    const result = calculateRegen(50, 100, new Date(NOW.getTime() - NIL_REGEN_INTERVAL_MS));

    expect(result.newNil).toBe(51);
    expect(result.nextTickSeconds).toBe(300);
  });

  it("should regen +2 after 12 minutes with ~180s until the next tick", () => {
    const result = calculateRegen(50, 100, new Date(NOW.getTime() - 12 * 60 * 1000));

    expect(result.newNil).toBe(52);
    expect(result.nextTickSeconds).toBe(180);
  });

  it("should regen +12 after 60 minutes", () => {
    const result = calculateRegen(50, 100, new Date(NOW.getTime() - 60 * 60 * 1000));

    expect(result.newNil).toBe(62);
  });

  it("should stay at max when NIL is already full (nextTickSeconds 0, no pending tick)", () => {
    const result = calculateRegen(100, 100, new Date(NOW));

    expect(result.newNil).toBe(100);
    expect(result.nextTickSeconds).toBe(0);
  });

  it("should cap at max when regen would overshoot (99 at 10 minutes)", () => {
    const result = calculateRegen(99, 100, new Date(NOW.getTime() - 10 * 60 * 1000));

    expect(result.newNil).toBe(100);
  });

  it("should clamp a future timestamp to zero regen (clock skew)", () => {
    const result = calculateRegen(50, 100, new Date(NOW.getTime() + 10 * 60 * 1000));

    expect(result.newNil).toBe(50);
    expect(result.nextTickSeconds).toBe(300);
  });

  it("should still regen when the max is above 100 (chrome later)", () => {
    const result = calculateRegen(150, 200, new Date(NOW.getTime() - NIL_REGEN_INTERVAL_MS));

    expect(result.newNil).toBe(151);
    expect(result.nextTickSeconds).toBe(300);
  });
});

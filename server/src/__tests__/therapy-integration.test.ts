import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import type { AuthResponse, TherapyResponse } from "@neon-dusk/shared";

// Issue #28 — Terapia API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack). Dedicated redis db
// (9) so rate-limit counters never leak across files.
//
// The seed wallet (500 grana) cannot afford a clinic session (G$ 5k-20k), so
// tests that need funds top up the wallet directly in the DB after the first
// balance fetch creates it.

const REDIS_TEST_DB = "redis://localhost:56379/9";

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `thr-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Bicho-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Issue #28 — Terapia API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

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

  /** Register a fresh user + character via HTTP; returns token + character id. */
  async function registerAndCreateCharacter(): Promise<{ accessToken: string; characterId: string }> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken, user } = await json<AuthResponse>(res);

    const created = await fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({
        name: uniqueName(),
        origin: "a_paraiso",
        role: "bicho",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      }),
    });
    expect(created.status).toBe(201);

    const [character] = await db("characters")
      .select("id")
      .where("user_id", user.id)
      .limit(1);
    return { accessToken, characterId: character!.id };
  }

  /** Create the wallet (500 seed) and top it up so a session is affordable. */
  async function topUpWallet(accessToken: string, characterId: string, amount = 100_000): Promise<void> {
    await fetch(`${base()}/api/economy/balance`, { headers: authHeader(accessToken) });
    await db("character_wallets")
      .where("character_id", characterId)
      .update({ balance: amount, lifetime_earned: amount });
  }

  describe("POST /api/therapy", () => {
    it("should run a clinic session: restore 10-20, debit eddies, record the session", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const res = await server.post(
        "/api/therapy",
        { therapyType: "clinic" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<TherapyResponse>(res);
      expect(body.therapyType).toBe("clinic");
      expect(body.cost).toBeGreaterThanOrEqual(5000);
      expect(body.cost).toBeLessThanOrEqual(20000);
      expect(body.restored).toBeGreaterThanOrEqual(10);
      expect(body.restored).toBeLessThanOrEqual(20);
      expect(body.humanityBefore).toBe(50);
      expect(body.humanityAfter).toBe(50 + body.restored);
      expect(body.completedAt).toBeTruthy();

      // Wallet debited.
      const [wallet] = await db("character_wallets")
        .select("balance")
        .where("character_id", characterId);
      expect(wallet!.balance).toBe(100_000 - body.cost);

      // Session row recorded.
      const [session] = await db("therapy_sessions")
        .select("*")
        .where("character_id", characterId);
      expect(session).toMatchObject({
        therapy_type: "clinic",
        cost: body.cost,
        restored: body.restored,
        humanity_before: 50,
        humanity_after: 50 + body.restored,
      });

      // THERAPY_PAYMENT audit entry.
      const [log] = await db("transaction_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("type", "THERAPY_PAYMENT");
      expect(log).toMatchObject({
        amount: -body.cost,
        balance_before: 100_000,
        balance_after: 100_000 - body.cost,
      });
    });

    it("should run an attunement session: restore 5-10, debit eddies", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const res = await server.post(
        "/api/therapy",
        { therapyType: "attunement" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<TherapyResponse>(res);
      expect(body.therapyType).toBe("attunement");
      expect(body.cost).toBeGreaterThanOrEqual(2500);
      expect(body.cost).toBeLessThanOrEqual(10000);
      expect(body.restored).toBeGreaterThanOrEqual(5);
      expect(body.restored).toBeLessThanOrEqual(10);
      expect(body.humanityAfter).toBe(50 + body.restored);
    });

    it("should cap the restore at 100 humanity", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await db("characters").where("id", characterId).update({ humanity: 95 });

      const res = await server.post(
        "/api/therapy",
        { therapyType: "clinic" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<TherapyResponse>(res);
      expect(body.humanityAfter).toBe(100);
      expect(body.restored).toBe(5); // 95 → 100
    });

    it("should reject a second session within the shared 24h cooldown", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const first = await server.post(
        "/api/therapy",
        { therapyType: "clinic" },
        authHeader(accessToken),
      );
      expect(first.status).toBe(200);

      const res = await server.post(
        "/api/therapy",
        { therapyType: "attunement" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("THERAPY_COOLDOWN");
      expect(body.details).toHaveProperty("nextAvailableAt");
    });

    it("should return 400 INSUFFICIENT_EDDIES when the wallet cannot cover the session", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      // Seed wallet is 500 grana — below the clinic minimum of 5.000.

      const res = await server.post(
        "/api/therapy",
        { therapyType: "clinic" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INSUFFICIENT_EDDIES");
      expect(body.message).toContain("Precisa de G$");
    });

    it("should return 403 FLATLINED for an apagado character", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await db("characters")
        .where("id", characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const res = await server.post(
        "/api/therapy",
        { therapyType: "clinic" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(403);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("FLATLINED");
    });

    it("should return 400 VALIDATION_ERROR for an unknown therapy type", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await server.post(
        "/api/therapy",
        { therapyType: "voodoo" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/therapy", { therapyType: "clinic" });
      expect(res.status).toBe(401);
    });
  });
});
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { resetDb } from "./helpers";
import { db } from "../db";
import { characters, transactionLog } from "../db/schema";
import type {
  AuthResponse,
  AwardSCResponse,
  LeaderboardResponse,
  StreetCredInfo,
} from "@neon-dusk/shared";

// ND-013 — street-cred API integration tests. Real Postgres/Redis on the
// isolated test stack, exercised with app.inject() (supertest is incompatible
// with Fastify 5 + rate-limit). Dedicated redis db (11) so the leaderboard
// cache and rate-limit counters never leak across files.
//
// The leaderboard snapshot is cached server-side (5 min TTL) under one key, so
// tests that assert on DB-seeded ranks flush that key first.

const REDIS_TEST_DB = "redis://localhost:56379/11";
const LEADERBOARD_CACHE_KEY = "leaderboard:top50";
const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `sc-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Runner-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("ND-013 — street-cred API", () => {
  let app: FastifyInstance;
  let redis: Redis;

  beforeAll(async () => {
    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  /** Drop the server-side leaderboard cache so the next read hits the DB. */
  async function flushLeaderboardCache(): Promise<void> {
    await redis.del(LEADERBOARD_CACHE_KEY);
  }

  /**
   * Isolate a leaderboard test: wipe characters (so the leaderboard only holds
   * the rows this test seeds) and drop the cached snapshot.
   */
  async function isolateLeaderboard(): Promise<void> {
    await db.execute(sql`TRUNCATE characters CASCADE`);
    await flushLeaderboardCache();
  }

  /** Register a user + character over HTTP; returns the token and character id. */
  async function registerApiUser(): Promise<{ accessToken: string; characterId: string }> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: uniqueEmail(), password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    const { accessToken } = res.json() as AuthResponse;

    const created = await app.inject({
      method: "POST",
      url: "/api/characters",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: uniqueName(),
        origin: "a_paraiso",
        role: "solo",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      },
    });
    expect(created.statusCode).toBe(201);
    const character = created.json() as { id: string };
    return { accessToken, characterId: character.id };
  }

  describe("GET /api/street-cred", () => {
    it("should return the live readout with score, title, max, next threshold", async () => {
      const { accessToken, characterId } = await registerApiUser();
      await db
        .update(characters)
        .set({ streetCred: 30, maxStreetCredAchieved: 30 })
        .where(eq(characters.id, characterId));

      const res = await app.inject({
        method: "GET",
        url: "/api/street-cred",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as StreetCredInfo;
      expect(body).toEqual({
        score: 30,
        title: "Pro",
        maxAchieved: 30,
        nextThreshold: { score: 50, title: "Edgerunner" },
        scToNext: 20,
      });
    });

    it("should return 401 without an access token", async () => {
      const res = await app.inject({ method: "GET", url: "/api/street-cred" });
      expect(res.statusCode).toBe(401);
      expect((res.json() as ErrorBody).error).toBe("UNAUTHORIZED");
    });

    it("should return score 0 with title Unknown for a character with no SC", async () => {
      const { accessToken } = await registerApiUser();

      const res = await app.inject({
        method: "GET",
        url: "/api/street-cred",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as StreetCredInfo;
      expect(body.score).toBe(0);
      expect(body.title).toBe("Unknown");
      expect(body.maxAchieved).toBe(0);
      expect(body.nextThreshold).toEqual({ score: 10, title: "Runner" });
      expect(body.scToNext).toBe(10);
    });

    it("should return 404 NO_CHARACTER when the user has no character", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: uniqueEmail(), password: PASSWORD },
      });
      const { accessToken } = res.json() as AuthResponse;

      const sc = await app.inject({
        method: "GET",
        url: "/api/street-cred",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(sc.statusCode).toBe(404);
      expect((sc.json() as ErrorBody).error).toBe("NO_CHARACTER");
    });
  });

  describe("GET /api/street-cred/leaderboard", () => {
    it("should return the ranked list (highest first) with titles", async () => {
      await isolateLeaderboard();
      const ordered = [80, 50, 30];
      for (const sc of ordered) {
        const { characterId } = await registerApiUser();
        await db
          .update(characters)
          .set({ streetCred: sc, maxStreetCredAchieved: sc })
          .where(eq(characters.id, characterId));
      }

      const res = await app.inject({ method: "GET", url: "/api/street-cred/leaderboard" });

      expect(res.statusCode).toBe(200);
      const body = res.json() as LeaderboardResponse;
      expect(body.leaderboard).toHaveLength(3);
      expect(body.leaderboard.map((e) => e.score)).toEqual([80, 50, 30]);
      expect(body.leaderboard.map((e) => e.position)).toEqual([1, 2, 3]);
      expect(body.leaderboard[0].title).toBe("Elite");
      expect(body.leaderboard[1].title).toBe("Edgerunner");
      expect(body.leaderboard[2].title).toBe("Pro");
      for (const entry of body.leaderboard) {
        expect(entry.characterName).toEqual(expect.any(String));
        expect(entry.crewName).toBeNull();
      }
    });

    it("should respect a custom limit", async () => {
      await isolateLeaderboard();
      const { characterId } = await registerApiUser();
      await db.update(characters).set({ streetCred: 40 }).where(eq(characters.id, characterId));

      const res = await app.inject({ method: "GET", url: "/api/street-cred/leaderboard?limit=1" });

      expect(res.statusCode).toBe(200);
      const body = res.json() as LeaderboardResponse;
      expect(body.leaderboard).toHaveLength(1);
      expect(body.leaderboard[0].score).toBe(40);
    });

    it("should return 400 VALIDATION_ERROR for limit=0", async () => {
      const res = await app.inject({ method: "GET", url: "/api/street-cred/leaderboard?limit=0" });
      expect(res.statusCode).toBe(400);
      expect((res.json() as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for limit=51", async () => {
      const res = await app.inject({ method: "GET", url: "/api/street-cred/leaderboard?limit=51" });
      expect(res.statusCode).toBe(400);
      expect((res.json() as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should be public — no auth required", async () => {
      const res = await app.inject({ method: "GET", url: "/api/street-cred/leaderboard" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/street-cred/award", () => {
    it("should award SC, return the updated score and audit the transaction", async () => {
      const { accessToken, characterId } = await registerApiUser();

      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { amount: 12, source: "admin-bonus" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as AwardSCResponse;
      expect(body).toEqual({
        score: 12,
        title: "Runner",
        gained: 12,
        maxAchieved: 12,
      });

      const [char] = await db
        .select({ streetCred: characters.streetCred })
        .from(characters)
        .where(eq(characters.id, characterId));
      expect(char!.streetCred).toBe(12);

      const [log] = await db
        .select()
        .from(transactionLog)
        .where(eq(transactionLog.characterId, characterId));
      expect(log).toMatchObject({
        type: "STREET_CRED_AWARD",
        amount: 12,
        balanceBefore: 0,
        balanceAfter: 12,
        source: "admin-bonus",
      });
    });

    it("should clamp at 100 — award only the room left", async () => {
      const { accessToken, characterId } = await registerApiUser();
      await db
        .update(characters)
        .set({ streetCred: 99, maxStreetCredAchieved: 99 })
        .where(eq(characters.id, characterId));

      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { amount: 30, source: "admin-bonus" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as AwardSCResponse;
      expect(body.score).toBe(100);
      expect(body.gained).toBe(1);
      expect(body.title).toBe("Legend");
      expect(body.maxAchieved).toBe(100);

      const [char] = await db
        .select({ streetCred: characters.streetCred })
        .from(characters)
        .where(eq(characters.id, characterId));
      expect(char!.streetCred).toBe(100);
    });

    it("should be a no-op award at the 100 cap", async () => {
      const { accessToken, characterId } = await registerApiUser();
      await db
        .update(characters)
        .set({ streetCred: 100, maxStreetCredAchieved: 100 })
        .where(eq(characters.id, characterId));

      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { amount: 100, source: "admin-bonus" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as AwardSCResponse;
      expect(body.score).toBe(100);
      expect(body.gained).toBe(0);
      expect(body.title).toBe("Legend");
    });

    it("should return 400 VALIDATION_ERROR for an invalid body (negative amount)", async () => {
      const { accessToken } = await registerApiUser();

      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { amount: -5, source: "admin" },
      });

      expect(res.statusCode).toBe(400);
      expect((res.json() as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR when source is missing", async () => {
      const { accessToken } = await registerApiUser();

      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { amount: 10 },
      });

      expect(res.statusCode).toBe(400);
      expect((res.json() as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/street-cred/award",
        payload: { amount: 10, source: "admin" },
      });
      expect(res.statusCode).toBe(401);
      expect((res.json() as ErrorBody).error).toBe("UNAUTHORIZED");
    });
  });

  describe("decay writeback", () => {
    it("should apply decay on GET and persist the decayed score", async () => {
      const { accessToken, characterId } = await registerApiUser();
      // 10 days idle → 3 days past the 7-day grace × -5/day = -15, floored at
      // the highest threshold reached (maxAchieved 60 → floor 50).
      await db
        .update(characters)
        .set({
          streetCred: 60,
          maxStreetCredAchieved: 60,
          lastActivityAt: new Date(Date.now() - 10 * 86_400_000),
        })
        .where(eq(characters.id, characterId));

      const res = await app.inject({
        method: "GET",
        url: "/api/street-cred",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as StreetCredInfo;
      expect(body.score).toBe(50); // 60 - 15 clamped to the floor of 50
      expect(body.title).toBe("Edgerunner");
      expect(body.maxAchieved).toBe(60);
      expect(body.scToNext).toBe(25); // next threshold 75

      const [char] = await db
        .select({
          streetCred: characters.streetCred,
          lastActivityAt: characters.lastActivityAt,
          updatedAt: characters.updatedAt,
        })
        .from(characters)
        .where(eq(characters.id, characterId));
      expect(char!.streetCred).toBe(50);
      // Writeback refreshes the decay clock so repeated reads stay stable.
      // Compared against the DB clock, not Date.now() — the container clock
      // can drift from the test runner.
      const [{ now }] = (await db.execute(sql`SELECT NOW() AS now`)) as { now: Date }[];
      expect(Math.abs(new Date(now).getTime() - char!.updatedAt.getTime())).toBeLessThan(60_000);
    });

    it("should not write back when decay is a no-op (fresh activity)", async () => {
      const { accessToken, characterId } = await registerApiUser();
      await db
        .update(characters)
        .set({ streetCred: 30, maxStreetCredAchieved: 30 })
        .where(eq(characters.id, characterId));

      const res = await app.inject({
        method: "GET",
        url: "/api/street-cred",
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect((res.json() as StreetCredInfo).score).toBe(30);
      const [char] = await db
        .select({ streetCred: characters.streetCred, updatedAt: characters.updatedAt })
        .from(characters)
        .where(eq(characters.id, characterId));
      expect(char!.streetCred).toBe(30);
    });
  });
});

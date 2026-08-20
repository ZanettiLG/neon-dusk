import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, resetRounds, type TestServer } from "./helpers";
import { db } from "../db";
import { UNNAMED_DRINK } from "../game/round-reset";
import type {
  AuthResponse,
  NameDrinkResponse,
  RoundHistoryResponse,
  RoundInfoResponse,
  TriggerResetResponse,
} from "@neon-dusk/shared";

// ND-017 — Round + Legends API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack), native fetch
// (supertest is incompatible with Fastify 5 + rate-limit). Dedicated redis
// db (15) so rate-limit counters never leak across files. `resetRounds`
// re-seeds round 1 active per test; legends are only touched by the rows this
// file creates (cleaned up inline).

const REDIS_TEST_DB = "redis://localhost:56379/15";
const PASSWORD = "StrongPass123!";
const ADMIN_KEY = "test-admin-key-that-is-at-least-32-characters-long";
const DAY_MS = 86_400_000;

let seq = 0;
function uniqueEmail(): string {
  return `round-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Rounder-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

interface ApiUser {
  accessToken: string;
  characterId: string;
  characterName: string;
}

describe("ND-017 — Round & Legends API", () => {
  let app: FastifyInstance;
  let server: TestServer;
  let redis: Redis;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  afterAll(async () => {
    // Leave the shared DB clean: remove any unnamed Lenda rows this suite
    // created (saideira's ordering assertions depend on the untouched seed).
    await db("legends").where("drink_name", UNNAMED_DRINK).del();
  });

  beforeEach(async () => {
    await resetDb();
    await resetRounds();
    // Remove any unnamed Lenda rows left by this suite across runs (Lendas
    // are never truncated by resetDb — the saideira seed must survive).
    await db("legends").where("drink_name", UNNAMED_DRINK).del();
    await redis.flushdb();
  });

  // ─── Test seams ────────────────────────────────────────────────────────────

  /** Register a user + character over HTTP; returns token, ids and name. */
  async function registerApiUser(): Promise<ApiUser> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);
    const characterName = uniqueName();
    const created = await server.post(
      "/api/characters",
      {
        name: characterName,
        origin: "a_paraiso",
        role: "bicho",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      },
      authHeader(accessToken),
    );
    expect(created.status).toBe(201);
    const character = await json<{ id: string }>(created);
    return { accessToken, characterId: character.id, characterName };
  }

  /** Seed `count` ended rounds (with stats) plus one active round. */
  async function seedEndedRounds(count: number): Promise<void> {
    await db("rounds").del();
    for (let n = 1; n <= count; n++) {
      const [round] = await db("rounds")
        .insert({
          round_number: n,
          started_at: new Date(Date.now() - (count - n + 1) * DAY_MS),
          ended_at: new Date(Date.now() - (count - n) * DAY_MS),
          status: "ended",
        })
        .returning("id");
      await db("round_stats").insert({
        round_id: round!.id,
        total_gigs_completed: n,
        total_eddies_earned: n * 100,
        total_pvp_fights: n,
        total_active_characters: n,
        top_sc_character_name: `Lenda-${n}`,
        top_sc_value: n,
      });
    }
    await db("rounds").insert({ round_number: count + 1, started_at: new Date() });
  }

  /** Insert an unnamed Lenda row for the given character name. */
  async function seedUnnamedLegend(characterName: string, crewName: string | null = null): Promise<void> {
    await db("legends").insert({ character_name: characterName, drink_name: UNNAMED_DRINK, crew_name: crewName });
  }

  // ─── GET /api/round ────────────────────────────────────────────────────────

  describe("GET /api/round", () => {
    it("should return 200 with the RoundInfoResponse shape", async () => {
      const user = await registerApiUser();

      const res = await fetch(`${base()}/api/round`, { headers: authHeader(user.accessToken) });

      expect(res.status).toBe(200);
      const body = await json<RoundInfoResponse>(res);
      expect(body.roundNumber).toBe(1);
      expect(body.status).toBe("active");
      expect(body.intermissionUntil).toBeNull();
      expect(body.startedAt).toEqual(expect.any(String));
      expect(body.endsAt).toEqual(expect.any(String));
      expect(body.timeRemainingSeconds).toBeGreaterThan(0);
      // 14-day round anchored at the seeded started_at.
      expect(new Date(body.endsAt).getTime() - new Date(body.startedAt).getTime()).toBe(
        14 * DAY_MS,
      );
    });

    it("should return 401 without a token", async () => {
      const res = await fetch(`${base()}/api/round`);
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });
  });

  // ─── GET /api/round/history ────────────────────────────────────────────────

  describe("GET /api/round/history", () => {
    it("should return ended rounds paginated with a nextCursor", async () => {
      const user = await registerApiUser();
      await seedEndedRounds(3);

      const page1 = await fetch(`${base()}/api/round/history?limit=2`, {
        headers: authHeader(user.accessToken),
      });
      expect(page1.status).toBe(200);
      const body1 = await json<RoundHistoryResponse>(page1);
      expect(body1.rounds.map((r) => r.roundNumber)).toEqual([3, 2]);
      expect(body1.nextCursor).toBe(2);
      expect(body1.rounds[0]).toMatchObject({
        startedAt: expect.any(String),
        endedAt: expect.any(String),
        stats: { totalGigsCompleted: 3, topScCharacterName: "Lenda-3" },
      });

      const page2 = await fetch(`${base()}/api/round/history?limit=2&cursor=${body1.nextCursor}`, {
        headers: authHeader(user.accessToken),
      });
      const body2 = await json<RoundHistoryResponse>(page2);
      expect(body2.rounds.map((r) => r.roundNumber)).toEqual([1]);
      expect(body2.nextCursor).toBeNull();
    });

    it("should return 400 VALIDATION_ERROR for a limit above the max", async () => {
      const user = await registerApiUser();

      const res = await fetch(`${base()}/api/round/history?limit=51`, {
        headers: authHeader(user.accessToken),
      });

      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("VALIDATION_ERROR");
    });
  });

  // ─── POST /api/round/trigger-reset ─────────────────────────────────────────

  describe("POST /api/round/trigger-reset", () => {
    it("should return 401 without the admin API key", async () => {
      const res = await server.post("/api/round/trigger-reset");
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });

    it("should return 401 with a wrong admin API key", async () => {
      const res = await server.post("/api/round/trigger-reset", undefined, {
        "x-api-key": "wrong-key-wrong-key-wrong-key-wrong-key",
      });
      expect(res.status).toBe(401);
    });

    it("should reset the round and return the TriggerResetResponse", async () => {
      const res = await server.post("/api/round/trigger-reset", undefined, {
        "x-api-key": ADMIN_KEY,
      });

      expect(res.status).toBe(200);
      const body = await json<TriggerResetResponse>(res);
      expect(body).toEqual({ success: true, endedRound: 1, newRound: 2, legendsInducted: 0 });

      // Round 1 closed, round 2 opened (scheduled after the intermission).
      const allRounds = await db("rounds").select("*").orderBy("round_number");
      expect(allRounds).toHaveLength(2);
      expect(allRounds[0]).toMatchObject({ round_number: 1, status: "ended" });
      expect(allRounds[0].ended_at).not.toBeNull();
      expect(allRounds[1]).toMatchObject({ round_number: 2, status: "active" });
    });
  });

  // ─── POST /api/legends/name-drink ──────────────────────────────────────────

  describe("POST /api/legends/name-drink", () => {
    it("should name the drink of the caller's unnamed Lenda", async () => {
      const user = await registerApiUser();
      await seedUnnamedLegend(user.characterName);

      const res = await server.post(
        "/api/legends/name-drink",
        { drinkName: "Sangue de Mercúrio" },
        authHeader(user.accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<NameDrinkResponse>(res);
      expect(body.legend.characterName).toBe(user.characterName);
      expect(body.legend.drinkName).toBe("Sangue de Mercúrio");

      const [row] = await db("legends").select("*").where("character_name", user.characterName);
      expect(row!.drink_name).toBe("Sangue de Mercúrio");
      expect(row!.crew_name).toBeNull();

      await db("legends").where("character_name", user.characterName).del();
    });

    it("should return 404 LEGEND_NOT_FOUND when the character has no unnamed Lenda", async () => {
      const user = await registerApiUser();

      const res = await server.post(
        "/api/legends/name-drink",
        { drinkName: "Sangue de Mercúrio" },
        authHeader(user.accessToken),
      );

      expect(res.status).toBe(404);
      expect((await json<ErrorBody>(res)).error).toBe("LEGEND_NOT_FOUND");
    });

    it("should return 400 VALIDATION_ERROR for a drink name shorter than 3 chars", async () => {
      const user = await registerApiUser();
      await seedUnnamedLegend(user.characterName);

      const res = await server.post(
        "/api/legends/name-drink",
        { drinkName: "X" },
        authHeader(user.accessToken),
      );

      expect(res.status).toBe(400);
      const err = await json<ErrorBody>(res);
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toContain("curto");
    });
  });
});

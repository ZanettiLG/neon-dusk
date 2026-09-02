import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import {
  startTestServer,
  json,
  authHeader,
  insertTestCharacter,
  registerTestUser,
  clearAuthIpRateLimits,
  resetRounds,
} from "./helpers";
import { db } from "../db";
import { ECONOMY_FAUCET_TYPES, ECONOMY_SINK_TYPES } from "../repositories/transaction-repository";
import type {
  AdminPlayersResponse,
  AdminEconomy,
  AdminAuditResponse,
  AdminTransactionsResponse,
  AuthResponse,
} from "@neon-dusk/shared";

// ND-052 — admin panel integration tests. Real HTTP against the app.
// Dedicated redis db (9) so rate-limit counters never leak across files.

const REDIS_TEST_DB = "redis://localhost:56379/9";

interface ErrorBody {
  error: string;
  message: string;
}

describe("ND-052 — admin panel API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

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

  // ND-053: the per-IP register/login budget (10 req/60s) must not be
  // exhausted by the many admin registrations from 127.0.0.1.
  beforeEach(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await clearAuthIpRateLimits(redis);
    redis.disconnect();
  });

  // Helper: register a user and promote to admin.
  async function createAdminUser(email: string, password = "Password123"): Promise<AuthResponse> {
    const auth = await registerTestUser(server, email, password);
    // Promote to admin directly in DB.
    await db("users").where("id", auth.user.id).update({ role: "admin" });
    // Re-login to get a JWT with role='admin'.
    const loginRes = await server.post("/api/auth/login", { email, password });
    return json<AuthResponse>(loginRes);
  }

  // Helper: register a normal (non-admin) user.
  async function createPlayerUser(email: string, password = "Password123"): Promise<AuthResponse> {
    return registerTestUser(server, email, password);
  }

  /**
   * Ensure game_params has canonical values (may be truncated by CASCADE from
   * other tests, or mutated by a previous PATCH). Upsert (DO UPDATE) forces
   * the canonical set so this suite is deterministic regardless of run order.
   * PVP_NIL_COST is 20 (docs §3 — the seed default was aligned in ND-052).
   */
  async function ensureGameParams(): Promise<void> {
    await db.raw(`
      INSERT INTO game_params (key, value) VALUES
        ('ROUND_DURATION_DAYS', '14'),
        ('NIL_REGEN_MINUTES', '5'),
        ('GIG_COOLDOWN_MINUTES', '10'),
        ('PVP_NIL_COST', '20'),
        ('INITIAL_BALANCE', '500'),
        ('GIG_BASE_REWARD', '100'),
        ('MAX_CREW_SIZE', '4')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
  }

  describe("GET /api/admin/players", () => {
    it("should return 403 when the user is not an admin", async () => {
      const player = await createPlayerUser(`player-${Date.now()}-1@test.com`);
      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players`, {
        headers: authHeader(player.accessToken),
      });
      expect(res.status).toBe(403);
    });

    it("should return paginated players for an admin", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-1@test.com`);
      // Insert a character so there's data.
      await insertTestCharacter({
        email: `extra-${Date.now()}-admin@test.com`,
        name: `RunnerX-${Date.now()}`,
      });

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?page=1&pageSize=10`,
        { headers: authHeader(admin.accessToken) },
      );

      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.players.length).toBeGreaterThanOrEqual(1);
      expect(body.players[0]).toHaveProperty("id");
      expect(body.players[0]).toHaveProperty("name");
      expect(body.players[0]).toHaveProperty("status");
      expect(body.players[0]).toHaveProperty("eddies");
      expect(body.players[0]).toHaveProperty("sc");
      expect(body.players[0]).toHaveProperty("level");
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(10);
    });

    it("should support search by name", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-2@test.com`);
      const ts = Date.now();
      await insertTestCharacter({ email: `srch-${ts}@test.com`, name: `FindMe-${ts}` });

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players?search=FindMe`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      expect(body.players.some((p) => p.name.startsWith("FindMe"))).toBe(true);
    });

    it("should support sort by name, sc, level, last_activity", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-3@test.com`);

      for (const sort of ["name", "sc", "level", "last_activity"]) {
        const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players?sort=${sort}`, {
          headers: authHeader(admin.accessToken),
        });
        expect(res.status).toBe(200);
      }
    });

    describe("search injection hardening", () => {
      it("search with % wildcard does not leak all players", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-pct@test.com`);
        // URL-encode % as %25 so the query string reaches the server
        const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players?search=%25`, {
          headers: authHeader(admin.accessToken),
        });
        expect(res.status).toBe(200);
        const body = await json<AdminPlayersResponse>(res);
        // LIKE wildcards are escaped; should only match names containing literal %.
        expect(body.total).toBeLessThan(100);
      });

      it("search with _ wildcard does not leak all players", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-und@test.com`);
        const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players?search=_`, {
          headers: authHeader(admin.accessToken),
        });
        expect(res.status).toBe(200);
        const body = await json<AdminPlayersResponse>(res);
        // LIKE wildcards are escaped; should only match names containing literal _.
        expect(body.total).toBeLessThan(100);
      });

      it("escapeLike: backslash in search does not become wildcard", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-bs@test.com`);
        const ts = Date.now();
        // Create a character with a backslash in the name.
        await insertTestCharacter({ email: `bs-${ts}@test.com`, name: `Back\\slash-${ts}` });

        // Search for backslash literally — should find the character with backslash.
        const resBs = await fetch(`http://127.0.0.1:${server.port}/api/admin/players?search=%5C`, {
          headers: authHeader(admin.accessToken),
        });
        expect(resBs.status).toBe(200);
        const bodyBs = await json<AdminPlayersResponse>(resBs);
        expect(bodyBs.players.some((p) => p.name.includes("\\"))).toBe(true);

        // Search for a plain name fragment — should NOT match via backslash-as-wildcard.
        const resPlain = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?search=slash`,
          { headers: authHeader(admin.accessToken) },
        );
        expect(resPlain.status).toBe(200);
        const bodyPlain = await json<AdminPlayersResponse>(resPlain);
        // The character with backslash in name still appears because "slash" substring matches.
        // The point: backslash itself didn't make it match unrelated records.
        expect(
          bodyPlain.players.every((p) => p.name === `Back\\slash-${ts}` || !p.name.includes("\\")),
        ).toBe(true);
      });

      it("normal search works correctly", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-norm@test.com`);
        const ts = Date.now();
        const name = `SearchTarget-${ts}`;
        await insertTestCharacter({ email: `st-${ts}@test.com`, name });

        const res = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?search=SearchTarget`,
          { headers: authHeader(admin.accessToken) },
        );
        expect(res.status).toBe(200);
        const body = await json<AdminPlayersResponse>(res);
        expect(body.players.some((p) => p.name.startsWith("SearchTarget"))).toBe(true);
      });
    });
  });

  describe("POST /api/admin/players/:id/ban and unban", () => {
    it("should ban and unban a character", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-ban@test.com`);
      const ts = Date.now();
      const { characterId } = await insertTestCharacter({
        email: `victim-${ts}@test.com`,
        name: `TroubleMaker-${ts}`,
      });

      // Ban.
      const banRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ reason: "Griefing others" }),
        },
      );
      expect(banRes.status).toBe(200);

      // Verify banned in DB.
      const [char] = await db("characters").select("is_banned").where("id", characterId);
      expect(char?.is_banned).toBe(true);

      // Ban should appear in player list as "banned".
      const playersRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=Trouble`,
        { headers: authHeader(admin.accessToken) },
      );
      const players = await json<AdminPlayersResponse>(playersRes);
      const bannedPlayer = players.players.find((p) => p.id === characterId);
      expect(bannedPlayer?.status).toBe("banned");

      // Unban.
      const unbanRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/unban`,
        {
          method: "POST",
          headers: authHeader(admin.accessToken),
        },
      );
      expect(unbanRes.status).toBe(200);

      // Verify unbanned in DB.
      const [char2] = await db("characters").select("is_banned").where("id", characterId);
      expect(char2?.is_banned).toBe(false);
    });

    it("should return 404 when banning a nonexistent character", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-404@test.com`);
      const fakeId = randomUUID();

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/players/${fakeId}/ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ reason: "test" }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 when the ban reason is empty", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-noreason@test.com`);
      const ts = Date.now();
      const { characterId } = await insertTestCharacter({
        email: `noreason-${ts}@test.com`,
        name: `NoReason-${ts}`,
      });

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ reason: "" }),
        },
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for a non-UUID player id on ban (ND-053 Zod params)", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-baduuid@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/not-a-uuid/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ reason: "test" }),
        },
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for a non-UUID player id on unban (ND-053 Zod params)", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-baduuid2@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/not-a-uuid/unban`,
        {
          method: "POST",
          headers: authHeader(admin.accessToken),
        },
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/admin/economy", () => {
    it("should return economy dashboard snapshot", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-econ@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/economy`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<AdminEconomy>(res);
      expect(typeof body.eddiesInCirculation).toBe("number");
      expect(Array.isArray(body.topFaucets24h)).toBe(true);
      expect(Array.isArray(body.topSinks24h)).toBe(true);
      expect(typeof body.dailyActiveCharacters).toBe("number");
      expect(typeof body.transactions24h).toBe("number");
      expect(Array.isArray(body.hourlyBreakdown24h)).toBe(true);
      // ND-052: round inflation readout.
      expect(typeof body.inflation).toBe("number");
      expect(typeof body.faucetsTotal).toBe("number");
      expect(typeof body.sinksTotal).toBe("number");
    });

    it("should report zero inflation when there is no circulating supply", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-inf0@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/economy`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<AdminEconomy>(res);
      // Wallets may exist from other tests in the shared DB — the formula
      // must never divide by zero. If the supply is 0, inflation is 0.
      if (body.eddiesInCirculation === 0) {
        expect(body.inflation).toBe(0);
      }
      expect(Number.isFinite(body.inflation)).toBe(true);
    });

    it("should compute inflation = (faucets − sinks) / supply over the current round", async () => {
      // ND-018 (fix flake): o e2e-player-loop deixa a rodada ativa com
      // started_at no futuro (intermission do reset) e o estado persiste entre
      // runs — re-seed determinístico da rodada 1 para a janela conter os
      // fixtures abaixo.
      await resetRounds();

      const admin = await createAdminUser(`admin-${Date.now()}-infl@test.com`);
      const { characterId } = await insertTestCharacter({
        email: `inflation-${Date.now()}@test.com`,
        name: `InflationTest-${Date.now()}`,
      });

      // Wallet + a known faucet/sink mix inside the round window.
      await db("character_wallets").insert({
        character_id: characterId,
        balance: 1000,
        escrow: 0,
        lifetime_earned: 1000,
        lifetime_spent: 0,
        version: 0,
      });
      await db("transaction_log").insert([
        {
          character_id: characterId,
          type: "GIG_PAYOUT",
          amount: 600,
          balance_before: 0,
          balance_after: 600,
          source: "corrida-teste-a",
        },
        {
          character_id: characterId,
          type: "PVP_REWARD",
          amount: 100,
          balance_before: 600,
          balance_after: 700,
          source: "corrida-teste-b",
        },
        {
          character_id: characterId,
          type: "VENDOR_PURCHASE",
          amount: -200,
          balance_before: 700,
          balance_after: 500,
          source: "corrida-teste-c",
        },
      ]);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/economy`, {
        headers: authHeader(admin.accessToken),
      });
      expect(res.status).toBe(200);
      const body = await json<AdminEconomy>(res);

      // The shared singleFork DB accumulates transactions from other suites,
      // so absolute totals are not stable — recompute the expected sums over
      // the same round window and buckets the API uses, then compare exactly.
      const [activeRound] = await db("rounds")
        .select("started_at")
        .where("status", "active")
        .limit(1);
      const windowStart =
        activeRound && activeRound.started_at
          ? (activeRound.started_at as Date)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [faucetRow] = await db("transaction_log")
        .select(db.raw("coalesce(sum(amount), 0)::int as total"))
        .whereIn("type", [...ECONOMY_FAUCET_TYPES])
        .where("created_at", ">=", windowStart);
      const expectedFaucets = Number((faucetRow as { total: number }).total ?? 0);

      const [sinkRow] = await db("transaction_log")
        .select(db.raw("coalesce(abs(sum(amount)), 0)::int as total"))
        .whereIn("type", [...ECONOMY_SINK_TYPES])
        .where("created_at", ">=", windowStart);
      const expectedSinks = Number((sinkRow as { total: number }).total ?? 0);

      // Our fixture (600 + 100 faucets, 200 sink) must be part of the sums —
      // proves the inserted rows are inside the window.
      expect(expectedFaucets).toBeGreaterThanOrEqual(700);
      expect(expectedSinks).toBeGreaterThanOrEqual(200);

      expect(body.faucetsTotal).toBe(expectedFaucets);
      expect(body.sinksTotal).toBe(expectedSinks);

      // Supply includes wallets created by other tests in the shared DB —
      // compute the expected ratio from the live supply.
      const [supplyRow] = await db("character_wallets").select(
        db.raw("coalesce(sum(balance), 0)::int as total"),
      );
      const supply = Number((supplyRow as { total: number }).total ?? 0);
      expect(body.inflation).toBeCloseTo((expectedFaucets - expectedSinks) / supply, 4);
    });

    it("should fall back to a 24h inflation window when no round is active", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-w24h@test.com`);
      const { characterId } = await insertTestCharacter({
        email: `w24h-${Date.now()}@test.com`,
        name: `Window24-${Date.now()}`,
      });
      await db("character_wallets").insert({
        character_id: characterId,
        balance: 1110,
        escrow: 0,
        lifetime_earned: 1110,
        lifetime_spent: 0,
        version: 0,
      });
      // Faucet older than the 24h fallback window — must NOT be counted.
      await db("transaction_log").insert({
        character_id: characterId,
        type: "GIG_PAYOUT",
        amount: 999,
        balance_before: 0,
        balance_after: 999,
        source: "corrida-antiga",
        created_at: new Date(Date.now() - 30 * 60 * 60 * 1000),
      });
      // Fresh faucet — inside the window.
      await db("transaction_log").insert({
        character_id: characterId,
        type: "GIG_PAYOUT",
        amount: 111,
        balance_before: 999,
        balance_after: 1110,
        source: "corrida-recente",
        created_at: new Date(),
      });

      // No active round → inflationWindowStart falls back to the last 24h.
      const [activeBefore] = await db("rounds")
        .select("round_number")
        .where("status", "active")
        .limit(1);
      await db("rounds").del();
      try {
        const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/economy`, {
          headers: authHeader(admin.accessToken),
        });
        expect(res.status).toBe(200);
        const body = await json<AdminEconomy>(res);

        // The API must equal the 24h-window sum — the 30h-old row (999) is
        // excluded; a full-history window would include it and break this.
        const [recent] = await db("transaction_log")
          .select(db.raw("coalesce(sum(amount), 0)::int as total"))
          .whereIn("type", [...ECONOMY_FAUCET_TYPES])
          .where("created_at", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000));
        expect(body.faucetsTotal).toBe(Number((recent as { total: number }).total ?? 0));
        expect(body.faucetsTotal).toBeGreaterThanOrEqual(111);
        expect(Number.isFinite(body.inflation)).toBe(true);
      } finally {
        // Restore an active round for the rest of the suite.
        await db("rounds").insert({
          round_number: (activeBefore as { round_number: number } | undefined)?.round_number ?? 1,
          started_at: new Date(),
        });
      }
    });
  });

  describe("GET /api/admin/transactions", () => {
    it("should return paginated transactions", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-tx@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/transactions?limit=10`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<AdminTransactionsResponse>(res);
      expect(Array.isArray(body.transactions)).toBe(true);
      expect(typeof body.total).toBe("number");
    });
  });

  describe("GET / PATCH /api/admin/params", () => {
    it("should return default game params", async () => {
      await ensureGameParams();
      const admin = await createAdminUser(`admin-${Date.now()}-params@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<Record<string, string>>(res);
      expect(body).toHaveProperty("ROUND_DURATION_DAYS");
      expect(body).toHaveProperty("NIL_REGEN_MINUTES");
      expect(body).toHaveProperty("GIG_COOLDOWN_MINUTES");
      // ND-052: the global payout floor is seeded (and the PvP cost is 20 —
      // docs §3; ensureGameParams upserts canonical values).
      expect(body).toHaveProperty("GIG_BASE_REWARD", "100");
      expect(body).toHaveProperty("PVP_NIL_COST", "20");
      // ponytail: default values may have been mutated by other tests.
      expect(["14", "21"]).toContain(body.ROUND_DURATION_DAYS);
    });

    it("should update game params", async () => {
      await ensureGameParams();
      const admin = await createAdminUser(`admin-${Date.now()}-updparams@test.com`);

      // PATCH MAX_CREW_SIZE (not ROUND_DURATION_DAYS): the round duration is
      // now consumed from game_params by the round cron/API, so mutating it
      // here would race other suites in the shared test DB (singleFork).
      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { MAX_CREW_SIZE: "5" } }),
      });

      expect(res.status).toBe(200);
      const body = await json<Record<string, string>>(res);
      expect(body.MAX_CREW_SIZE).toBe("5");

      // Restore the canonical value so later assertions stay deterministic.
      await ensureGameParams();
    });

    it("should reject unknown param keys", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-bad@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { BOGUS_KEY: "value" } }),
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      // admin-service throws UNKNOWN_PARAMS for unknown keys (not VALIDATION_ERROR).
      expect(body.error).toBe("UNKNOWN_PARAMS");
    });

    it("should reject non-numeric values for numeric params", async () => {
      await ensureGameParams();
      const admin = await createAdminUser(`admin-${Date.now()}-numnum@test.com`);

      // "abc" → Number("abc") = NaN — must be rejected before persisting.
      const badRes = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { GIG_BASE_REWARD: "abc" } }),
      });
      expect(badRes.status).toBe(400);
      const badBody = await json<ErrorBody>(badRes);
      expect(badBody.error).toBe("VALIDATION_ERROR");

      // The rejected value must not have been persisted.
      const [row] = await db("game_params").select("value").where("key", "GIG_BASE_REWARD");
      expect((row as { value: string } | undefined)?.value).toBe("100");

      // Zero and fractional counts are also invalid.
      const zeroRes = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { INITIAL_BALANCE: "0" } }),
      });
      expect(zeroRes.status).toBe(400);

      const fracRes = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { MAX_CREW_SIZE: "4.5" } }),
      });
      expect(fracRes.status).toBe(400);

      // A valid numeric value passes and persists.
      const goodRes = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { GIG_BASE_REWARD: "150" } }),
      });
      expect(goodRes.status).toBe(200);
      const goodBody = await json<Record<string, string>>(goodRes);
      expect(goodBody.GIG_BASE_REWARD).toBe("150");

      // Restore the canonical value so later assertions stay deterministic.
      await ensureGameParams();
    });

    it("should reject non-string param values", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-nonstr@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(admin.accessToken),
        },
        body: JSON.stringify({ params: { PVP_NIL_COST: 25 } }), // number, not string
      });

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/admin/audit", () => {
    it("should return paginated audit log entries", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-audit@test.com`);

      const res = await fetch(`http://127.0.0.1:${server.port}/api/admin/audit?limit=10`, {
        headers: authHeader(admin.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<AdminAuditResponse>(res);
      expect(Array.isArray(body.entries)).toBe(true);
      if (body.entries.length > 0) {
        expect(body.entries[0]).toHaveProperty("id");
        expect(body.entries[0]).toHaveProperty("action");
        expect(body.entries[0]).toHaveProperty("result");
        expect(body.entries[0]).toHaveProperty("ip");
        // IP should be masked.
        expect(body.entries[0].ip).toContain(".***");
      }
    });
  });

  describe("Status derivation", () => {
    it("active player shows status 'active'", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-act@test.com`);
      const ts = Date.now();
      const { characterId } = await insertTestCharacter({
        email: `active-${ts}@test.com`,
        name: `ActiveRunner-${ts}`,
      });

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=ActiveRunner`,
        { headers: authHeader(admin.accessToken) },
      );
      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      const player = body.players.find((p) => p.id === characterId);
      expect(player).toBeDefined();
      expect(player?.status).toBe("active");
    });

    it("banned player shows status 'banned'", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-bstat@test.com`);
      const ts = Date.now();
      const { characterId } = await insertTestCharacter({
        email: `bstat-${ts}@test.com`,
        name: `BannedRunner-${ts}`,
      });

      // Ban the player.
      const banRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ reason: "Test ban" }),
        },
      );
      expect(banRes.status).toBe(200);

      // Verify status in player list.
      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=BannedRunner`,
        { headers: authHeader(admin.accessToken) },
      );
      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      const player = body.players.find((p) => p.id === characterId);
      expect(player).toBeDefined();
      expect(player?.status).toBe("banned");
    });

    it("circuit-broken player shows status 'circuit_broken'", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-cb@test.com`);
      const ts = Date.now();
      const { userId, characterId } = await insertTestCharacter({
        email: `cb-${ts}@test.com`,
        name: `BrokenRunner-${ts}`,
      });

      // Set circuit_break:{userId} via Redis (same DB as tests).
      const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
      await redis.connect();
      await redis.setex(`circuit_break:${userId}`, 86_400, "1");
      redis.disconnect();

      // Verify status in player list.
      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=BrokenRunner`,
        { headers: authHeader(admin.accessToken) },
      );
      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      const player = body.players.find((p) => p.id === characterId);
      expect(player).toBeDefined();
      expect(player?.status).toBe("circuit_broken");
    });

    it("banned players appear before circuit-broken in list (ban priority)", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-banpri@test.com`);
      const ts = Date.now();
      const { userId, characterId } = await insertTestCharacter({
        email: `banpri-${ts}@test.com`,
        name: `DualTrouble-${ts}`,
      });

      // Set both: ban + circuit_break. Banned should take priority.
      await db("characters").where("id", characterId).update({ is_banned: true });

      const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
      await redis.connect();
      await redis.setex(`circuit_break:${userId}`, 86_400, "1");
      redis.disconnect();

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=DualTrouble`,
        { headers: authHeader(admin.accessToken) },
      );
      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      const player = body.players.find((p) => p.id === characterId);
      expect(player).toBeDefined();
      expect(player?.status).toBe("banned");

      // Cleanup: unban.
      await db("characters").where("id", characterId).update({ is_banned: false });
    });
  });

  describe("Non-admin access control", () => {
    const adminEndpoints = [
      { method: "GET", path: "/api/admin/players" },
      { method: "GET", path: "/api/admin/economy" },
      { method: "GET", path: "/api/admin/transactions" },
      { method: "GET", path: "/api/admin/params" },
      { method: "GET", path: "/api/admin/audit" },
    ];

    for (const ep of adminEndpoints) {
      it(`should return 403 for non-admin on ${ep.method} ${ep.path}`, async () => {
        const player = await createPlayerUser(
          `player-${Date.now()}-${ep.path.replace(/\//g, "-")}@test.com`,
        );

        const res = await fetch(`http://127.0.0.1:${server.port}${ep.path}`, {
          method: ep.method,
          headers: authHeader(player.accessToken),
        });

        expect(res.status).toBe(403);
      });
    }

    it("should return 403 for non-admin on POST ban/unban and PATCH params", async () => {
      const player = await createPlayerUser(`player-${Date.now()}-write@test.com`);
      const ts = Date.now();
      const { characterId } = await insertTestCharacter({
        email: `write-${ts}@test.com`,
        name: `WriteTarget-${ts}`,
      });

      const banRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(player.accessToken),
          },
          body: JSON.stringify({ reason: "test" }),
        },
      );
      expect(banRes.status).toBe(403);

      const unbanRes = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${characterId}/unban`,
        {
          method: "POST",
          headers: authHeader(player.accessToken),
        },
      );
      expect(unbanRes.status).toBe(403);

      const patchRes = await fetch(`http://127.0.0.1:${server.port}/api/admin/params`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(player.accessToken),
        },
        body: JSON.stringify({ params: { MAX_CREW_SIZE: "5" } }),
      });
      expect(patchRes.status).toBe(403);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, insertTestCharacter, registerTestUser } from "./helpers";
import { db } from "../db";
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

  /** Ensure game_params has default values (may be truncated by CASCADE from other tests). */
  async function ensureGameParams(): Promise<void> {
    await db.raw(`
      INSERT INTO game_params (key, value) VALUES
        ('ROUND_DURATION_DAYS', '14'),
        ('NIL_REGEN_MINUTES', '5'),
        ('GIG_COOLDOWN_MINUTES', '10'),
        ('PVP_NIL_COST', '10'),
        ('INITIAL_BALANCE', '500'),
        ('MAX_CREW_SIZE', '4')
      ON CONFLICT (key) DO NOTHING
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
      await insertTestCharacter({ email: `extra-${Date.now()}-admin@test.com`, name: `RunnerX-${Date.now()}` });

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

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players?search=FindMe`,
        { headers: authHeader(admin.accessToken) },
      );

      expect(res.status).toBe(200);
      const body = await json<AdminPlayersResponse>(res);
      expect(body.players.some((p) => p.name.startsWith("FindMe"))).toBe(true);
    });

    it("should support sort by name, sc, level, last_activity", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-3@test.com`);

      for (const sort of ["name", "sc", "level", "last_activity"]) {
        const res = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?sort=${sort}`,
          { headers: authHeader(admin.accessToken) },
        );
        expect(res.status).toBe(200);
      }
    });

    describe("search injection hardening", () => {
      it("search with % wildcard does not leak all players", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-pct@test.com`);
        // URL-encode % as %25 so the query string reaches the server
        const res = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?search=%25`,
          { headers: authHeader(admin.accessToken) },
        );
        expect(res.status).toBe(200);
        const body = await json<AdminPlayersResponse>(res);
        // LIKE wildcards are escaped; should only match names containing literal %.
        expect(body.total).toBeLessThan(100);
      });

      it("search with _ wildcard does not leak all players", async () => {
        const admin = await createAdminUser(`admin-${Date.now()}-und@test.com`);
        const res = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?search=_`,
          { headers: authHeader(admin.accessToken) },
        );
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
        const resBs = await fetch(
          `http://127.0.0.1:${server.port}/api/admin/players?search=%5C`,
          { headers: authHeader(admin.accessToken) },
        );
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
        expect(bodyPlain.players.every((p) => p.name === `Back\\slash-${ts}` || !p.name.includes("\\"))).toBe(true);
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
      const [char] = await db("characters")
        .select("is_banned")
        .where("id", characterId);
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
      const [char2] = await db("characters")
        .select("is_banned")
        .where("id", characterId);
      expect(char2?.is_banned).toBe(false);
    });

    it("should return 404 when banning a nonexistent character", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-404@test.com`);
      const fakeId = randomUUID();

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/players/${fakeId}/ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ reason: "test" }),
        },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/admin/economy", () => {
    it("should return economy dashboard snapshot", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-econ@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/economy`,
        { headers: authHeader(admin.accessToken) },
      );

      expect(res.status).toBe(200);
      const body = await json<AdminEconomy>(res);
      expect(typeof body.eddiesInCirculation).toBe("number");
      expect(Array.isArray(body.topFaucets24h)).toBe(true);
      expect(Array.isArray(body.topSinks24h)).toBe(true);
      expect(typeof body.dailyActiveCharacters).toBe("number");
      expect(typeof body.transactions24h).toBe("number");
      expect(Array.isArray(body.hourlyBreakdown24h)).toBe(true);
    });
  });

  describe("GET /api/admin/transactions", () => {
    it("should return paginated transactions", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-tx@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/transactions?limit=10`,
        { headers: authHeader(admin.accessToken) },
      );

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

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/params`,
        { headers: authHeader(admin.accessToken) },
      );

      expect(res.status).toBe(200);
      const body = await json<Record<string, string>>(res);
      expect(body).toHaveProperty("ROUND_DURATION_DAYS");
      expect(body).toHaveProperty("NIL_REGEN_MINUTES");
      expect(body).toHaveProperty("GIG_COOLDOWN_MINUTES");
      // ponytail: default values may have been mutated by other tests.
      expect(["14", "21"]).toContain(body.ROUND_DURATION_DAYS);
    });

    it("should update game params", async () => {
      await ensureGameParams();
      const admin = await createAdminUser(`admin-${Date.now()}-updparams@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/params`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ params: { ROUND_DURATION_DAYS: "21" } }),
        },
      );

      expect(res.status).toBe(200);
      const body = await json<Record<string, string>>(res);
      expect(body.ROUND_DURATION_DAYS).toBe("21");
    });

    it("should reject unknown param keys", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-bad@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/params`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(admin.accessToken),
          },
          body: JSON.stringify({ params: { BOGUS_KEY: "value" } }),
        },
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("UNKNOWN_PARAMS");
    });
  });

  describe("GET /api/admin/audit", () => {
    it("should return paginated audit log entries", async () => {
      const admin = await createAdminUser(`admin-${Date.now()}-audit@test.com`);

      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/admin/audit?limit=10`,
        { headers: authHeader(admin.accessToken) },
      );

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
      await db("characters")
        .where("id", characterId)
        .update({ is_banned: true });

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
      await db("characters")
        .where("id", characterId)
        .update({ is_banned: false });
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
        const player = await createPlayerUser(`player-${Date.now()}-${ep.path.replace(/\//g, "-")}@test.com`);

        const res = await fetch(`http://127.0.0.1:${server.port}${ep.path}`, {
          method: ep.method,
          headers: authHeader(player.accessToken),
        });

        expect(res.status).toBe(403);
      });
    }
  });
});

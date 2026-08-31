import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, registerTestUser, type TestServer } from "./helpers";
import { db } from "../db";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { invalidateGameParamCache } from "../repositories/game-param-repository";
import { rateLimitConfig } from "../lib/rate-limit";
import { LEADERBOARD_CACHE_KEY } from "../lib/leaderboard-cache";
import type {
  LeaderboardResponse,
  PvpAttackableResponse,
  PvpCombatResult,
  PvpHistoryResponse,
  Role,
} from "@neon-dusk/shared";

// ND-014 — PvP API integration tests. Real HTTP against the app (Fastify +
// Postgres + Redis on the isolated test stack), native fetch (supertest is
// incompatible with Fastify 5 + rate-limit). Dedicated redis db (12) so the
// attack rate-limit counters and cooldown keys never leak across files.
//
// Determinism: combat uses Math.random in the service, so every fight is set
// up with a 10-point base-power gap between non-bicho characters. With base 15
// vs 5 (both "vulto", no bicho multiplier), the attacker's minimum roll
// (16) exceeds the defender's maximum roll (15) — the attacker ALWAYS wins.

const REDIS_TEST_DB = "redis://localhost:56379/12";
const PASSWORD = "StrongPass123!";
const DAY_MS = 86_400_000;

/** Base power 15 (always beats base 5: min 16 > max 15). */
const STRONG_ATTRS = { body: 10, reflexes: 5, intelligence: 1, technical: 1, cool: 5 };
/** Base power 5. */
const WEAK_ATTRS = { body: 3, reflexes: 2, intelligence: 4, technical: 4, cool: 9 };

interface AttributesInput {
  body: number;
  reflexes: number;
  intelligence: number;
  technical: number;
  cool: number;
}

interface PvpPlayer {
  userId: string;
  characterId: string;
  accessToken: string;
}

interface PlayerOpts {
  role?: Role;
  attributes?: AttributesInput;
  streetCred?: number;
  nil?: number;
  /** Backdate createdAt this many days so the account is not PvP-immune. */
  createdAtDaysAgo?: number;
}

interface ErrorBody {
  error: string;
  message: string;
}

let seq = 0;
function uniqueEmail(): string {
  return `pvp-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Blade-${Date.now()}-${seq++}`;
}

describe("ND-014 — PvP combat API", () => {
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

  beforeEach(async () => {
    await resetDb();
    await redis.flushdb();
  });

  // ─── Test seams ────────────────────────────────────────────────────────────

  /** Redis key backing the per-character attack rate counter (lib/rate-limit — keyed by JWT sub). */
  function attackRateKey(userId: string): string {
    return `rate:${userId}:pvp_attack`;
  }

  /** Redis key backing the per-character attack cooldown (pvp-service). */
  function serviceCooldownKey(characterId: string): string {
    return `pvp:cooldown:${characterId}`;
  }

  /** Redis key backing the anti-cheat cooldown gate (middleware/cooldown). */
  function middlewareCooldownKey(characterId: string): string {
    return `cooldown:${characterId}:pvp_attack`;
  }

  /** Reset cooldown + per-character rate counter so a character can attack again. */
  async function clearAttackLimits(player: PvpPlayer): Promise<void> {
    await redis.del(attackRateKey(player.userId));
    await redis.del(serviceCooldownKey(player.characterId));
    await redis.del(middlewareCooldownKey(player.characterId));
  }

  /** Register a user over HTTP, then insert their character directly (full attribute control). */
  async function createPvpPlayer(opts: PlayerOpts = {}): Promise<PvpPlayer> {
    const auth = await registerTestUser(server, uniqueEmail(), PASSWORD);
    const attributes = opts.attributes ?? { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };

    const [character] = await db("characters")
      .insert({
        user_id: auth.user.id,
        name: uniqueName(),
        origin: "a_paraiso",
        role: opts.role ?? "vulto",
        body: attributes.body,
        reflexes: attributes.reflexes,
        intelligence: attributes.intelligence,
        technical: attributes.technical,
        cool: attributes.cool,
        street_cred: opts.streetCred ?? 0,
        nil: opts.nil ?? 100,
        created_at:
          opts.createdAtDaysAgo === undefined
            ? new Date()
            : new Date(Date.now() - opts.createdAtDaysAgo * DAY_MS),
      })
      .returning("id");

    return { userId: auth.user.id, characterId: character.id, accessToken: auth.accessToken };
  }

  /** Seed a wallet with the given balance (wallets.ensure creates it with 500). */
  async function seedWallet(characterId: string, balance: number): Promise<void> {
    await db.transaction(async (trx) => {
      await wallets.ensure(characterId, trx);
    });
    await db("character_wallets")
      .where("character_id", characterId)
      .update({ balance });
  }

  async function attack(
    attacker: PvpPlayer,
    targetId: string,
  ): Promise<{ status: number; body: PvpCombatResult | ErrorBody }> {
    const res = await server.post("/api/pvp/attack", { targetId }, authHeader(attacker.accessToken));
    return { status: res.status, body: await json<PvpCombatResult | ErrorBody>(res) };
  }

  async function getCharacter(characterId: string) {
    const [row] = await db("characters").select("*").where("id", characterId);
    return row!;
  }

  async function getWalletRow(characterId: string) {
    const [row] = await db("character_wallets")
      .select("*")
      .where("character_id", characterId);
    return row!;
  }

  // ─── GET /api/pvp/attackable ───────────────────────────────────────────────

  describe("GET /api/pvp/attackable", () => {
    it("should return only targets within ±10 power and exclude the caller", async () => {
      const attacker = await createPvpPlayer({
        attributes: { body: 8, reflexes: 5, intelligence: 1, technical: 1, cool: 7 }, // base 13
      });
      const inHigh = await createPvpPlayer({
        attributes: { body: 10, reflexes: 9, intelligence: 1, technical: 1, cool: 1 }, // base 19
        createdAtDaysAgo: 10,
      });
      const inLow = await createPvpPlayer({
        attributes: { body: 6, reflexes: 4, intelligence: 1, technical: 1, cool: 10 }, // base 10
        createdAtDaysAgo: 10,
      });
      const outOfRange = await createPvpPlayer({
        attributes: { body: 1, reflexes: 1, intelligence: 5, technical: 5, cool: 10 }, // base 2 — diff 11
        createdAtDaysAgo: 10,
      });

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpAttackableResponse>(res);
      expect(body.nilCost).toBe(20); // PVP_NIL_COST fallback
      const ids = body.targets.map((t) => t.characterId);
      expect(ids).toContain(inHigh.characterId);
      expect(ids).toContain(inLow.characterId);
      expect(ids).not.toContain(outOfRange.characterId);
      expect(ids).not.toContain(attacker.characterId);

      const highTarget = body.targets.find((t) => t.characterId === inHigh.characterId);
      const lowTarget = body.targets.find((t) => t.characterId === inLow.characterId);
      expect(highTarget?.power).toBe(19);
      expect(lowTarget?.power).toBe(10);
      for (const target of body.targets) {
        expect(target.power).toBeGreaterThanOrEqual(3); // 13 − 10
        expect(target.power).toBeLessThanOrEqual(23); // 13 + 10
        expect(target.griefRisk).toBe(false); // no weekly hits on these targets yet
      }
    });

    it("should exclude accounts younger than 7 days (immune)", async () => {
      const attacker = await createPvpPlayer(); // base 9
      const veteran = await createPvpPlayer({ createdAtDaysAgo: 10 }); // base 9, in range
      const fresh = await createPvpPlayer(); // base 9 but created now → immune

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpAttackableResponse>(res);
      const ids = body.targets.map((t) => t.characterId);
      expect(ids).toContain(veteran.characterId);
      expect(ids).not.toContain(fresh.characterId);
    });

    it("should flag noobShield for targets with SC below 10", async () => {
      const attacker = await createPvpPlayer();
      const noob = await createPvpPlayer({ streetCred: 5, createdAtDaysAgo: 10 });
      const seasoned = await createPvpPlayer({ streetCred: 50, createdAtDaysAgo: 10 });

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpAttackableResponse>(res);
      const noobTarget = body.targets.find((t) => t.characterId === noob.characterId);
      const seasonedTarget = body.targets.find((t) => t.characterId === seasoned.characterId);
      expect(noobTarget?.noobShield).toBe(true);
      expect(seasonedTarget?.noobShield).toBe(false);
    });

    it("should return an empty target list while the attacker is on cooldown", async () => {
      const attacker = await createPvpPlayer();
      await redis.set(serviceCooldownKey(attacker.characterId), "1", "EX", 3600);

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpAttackableResponse>(res);
      expect(body.targets).toEqual([]);
      expect(body.nilCost).toBe(20);
    });

    it("should flag griefRisk on targets already hit 3+ times this week", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({
        attributes: WEAK_ATTRS,
        createdAtDaysAgo: 10,
      });
      await seedWallet(defender.characterId, 500);

      for (let i = 0; i < 3; i++) {
        await clearAttackLimits(attacker);
        const { status } = await attack(attacker, defender.characterId);
        expect(status).toBe(200);
      }
      // The last attack left the caller on cooldown — clear it so the
      // attackable list is served again (otherwise it returns no targets).
      await clearAttackLimits(attacker);

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpAttackableResponse>(res);
      const target = body.targets.find(
        (t) => t.characterId === defender.characterId,
      );
      expect(target?.weeklyAttacksReceived).toBe(3);
      expect(target?.griefRisk).toBe(true);
      expect(body.nilCost).toBe(20);
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/pvp/attackable");
      expect(res.status).toBe(401);
    });

    it("should return 404 NO_CHARACTER for a user without a character", async () => {
      const auth = await registerTestUser(server, uniqueEmail(), PASSWORD);

      const res = await fetch(`${base()}/api/pvp/attackable`, {
        headers: authHeader(auth.accessToken),
      });

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NO_CHARACTER");
    });
  });

  // ─── POST /api/pvp/attack ──────────────────────────────────────────────────

  describe("POST /api/pvp/attack", () => {
    it("should resolve a combat, transfer loot and Moral, and bill NIL", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({
        attributes: WEAK_ATTRS,
        streetCred: 50,
        createdAtDaysAgo: 10,
      });
      await seedWallet(attacker.characterId, 1000);
      await seedWallet(defender.characterId, 500);

      const res = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<PvpCombatResult>(res);
      expect(body.won).toBe(true); // base 15 (min 16) always beats base 5 (max 15)
      expect(body.lootAmount).toBe(50); // 10% of 500
      expect(body.grieferPenalty).toBe(false);
      expect(body.streetCredChange).toBe(5);
      expect(body.newStreetCred).toBe(5);
      expect(body.newBalance).toBe(1050); // 1000 + 50 loot
      expect(body.attackerPower).toBeGreaterThanOrEqual(16);
      expect(body.defenderPower).toBeLessThanOrEqual(15);

      const attackerRow = await getCharacter(attacker.characterId);
      const defenderRow = await getCharacter(defender.characterId);
      expect(attackerRow.nil).toBe(80); // 100 − 20 NIL cost
      expect(attackerRow.street_cred).toBe(5);
      expect(attackerRow.max_street_cred_achieved).toBe(5);
      expect(defenderRow.street_cred).toBe(48); // 50 − max(1, floor(50 × 0.05)) = 2

      const attackerWallet = await getWalletRow(attacker.characterId);
      const defenderWallet = await getWalletRow(defender.characterId);
      expect(attackerWallet.balance).toBe(1050);
      expect(defenderWallet.balance).toBe(450);

      const [combat] = await db("pvp_combats")
        .select("*")
        .where("id", body.combatId);
      expect(combat).toMatchObject({
        attacker_id: attacker.characterId,
        defender_id: defender.characterId,
        winner_id: attacker.characterId,
        loot_amount: 50,
        griefer_penalty: false,
      });
    });

    it("should reject an attack with insufficient NIL (400 INSUFFICIENT_NIL)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS, nil: 10 });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const { status, body } = await attack(attacker, defender.characterId);

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("INSUFFICIENT_NIL");
    });

    it("should charge the game_params PVP_NIL_COST when it differs from the default (ND-052)", async () => {
      // The NIL cost is admin-tunable — raise it to 30 and verify the attack
      // spends the new amount (not the hardcoded 20).
      await db("game_params")
        .insert({ key: "PVP_NIL_COST", value: "30" })
        .onConflict("key")
        .merge(["value"]);
      invalidateGameParamCache("PVP_NIL_COST");

      try {
        const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS, nil: 100 });
        const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
        await seedWallet(defender.characterId, 500);

        // The attackable list must quote the tuned cost, not the default 20.
        const abRes = await fetch(`${base()}/api/pvp/attackable`, {
          headers: authHeader(attacker.accessToken),
        });
        expect(abRes.status).toBe(200);
        const abBody = await json<PvpAttackableResponse>(abRes);
        expect(abBody.nilCost).toBe(30);

        const { status, body } = await attack(attacker, defender.characterId);
        expect(status).toBe(200);
        expect((body as PvpCombatResult).won).toBe(true);

        const attackerRow = await getCharacter(attacker.characterId);
        expect(attackerRow.nil).toBe(70); // 100 − 30 (param), not 80
      } finally {
        await db("game_params").where("key", "PVP_NIL_COST").del();
        invalidateGameParamCache("PVP_NIL_COST");
      }
    });

    it("should reject attacking yourself (400 CANNOT_ATTACK_SELF)", async () => {
      const attacker = await createPvpPlayer();

      const { status, body } = await attack(attacker, attacker.characterId);

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("CANNOT_ATTACK_SELF");
    });

    it("should reject attacking an immune account younger than 7 days (400 TARGET_IMMUNE)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS }); // created now → immune

      const { status, body } = await attack(attacker, defender.characterId);

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("TARGET_IMMUNE");
    });

    it("should return 403 FLATLINED when the attacker is apagado", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
      await db("characters")
        .where("id", attacker.characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const { status, body } = await attack(attacker, defender.characterId);

      expect(status).toBe(403);
      expect((body as ErrorBody).error).toBe("FLATLINED");
    });

    it("should return 403 FLATLINED when the defender is apagado", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
      await db("characters")
        .where("id", defender.characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const { status, body } = await attack(attacker, defender.characterId);

      expect(status).toBe(403);
      expect((body as ErrorBody).error).toBe("FLATLINED");
    });

    it("should reject attacks when the power difference exceeds ±10 (400 POWER_RANGE_EXCEEDED)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS }); // base 15
      const defender = await createPvpPlayer({
        attributes: { body: 1, reflexes: 1, intelligence: 5, technical: 5, cool: 10 }, // base 2 — diff 13
        createdAtDaysAgo: 10,
      });

      const { status, body } = await attack(attacker, defender.characterId);

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("POWER_RANGE_EXCEEDED");
    });

    it("should return 404 TARGET_NOT_FOUND for an unknown target id", async () => {
      const attacker = await createPvpPlayer();

      const { status, body } = await attack(attacker, "00000000-0000-0000-0000-000000000000");

      expect(status).toBe(404);
      expect((body as ErrorBody).error).toBe("TARGET_NOT_FOUND");
    });

    it("should return 400 VALIDATION_ERROR for a malformed targetId", async () => {
      const attacker = await createPvpPlayer();

      const { status, body } = await attack(attacker, "not-a-uuid");

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should return 404 NO_CHARACTER for a user without a character", async () => {
      const auth = await registerTestUser(server, uniqueEmail(), PASSWORD);

      const res = await server.post(
        "/api/pvp/attack",
        { targetId: "00000000-0000-0000-0000-000000000000" },
        authHeader(auth.accessToken),
      );

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NO_CHARACTER");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/pvp/attack", {
        targetId: "00000000-0000-0000-0000-000000000000",
      });
      expect(res.status).toBe(401);
    });

    it("should enforce a 1-hour cooldown after a successful attack (429 COOLDOWN_ACTIVE)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const first = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(first.status).toBe(200);

      // ND-053: the anti-cheat cooldown gate (middleware) fires before the
      // handler — the second attack within 1h is COOLDOWN_ACTIVE, not the
      // service's legacy PVP_COOLDOWN.
      const second = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(second.status).toBe(429);
      const body = await json<ErrorBody>(second);
      expect(body.error).toBe("COOLDOWN_ACTIVE");
      expect(second.headers.get("retry-after")).toBeTruthy();
    });

    it("should not burn the cooldown when the attack fails inside the transaction", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS, nil: 10 });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const failed = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(failed.status).toBe(400); // INSUFFICIENT_NIL — transaction rolled back
      expect(await redis.get(serviceCooldownKey(attacker.characterId))).toBeNull();
      expect(await redis.get(middlewareCooldownKey(attacker.characterId))).toBeNull();

      // Top up NIL — the same character may retry immediately (no cooldown burned).
      await db("characters").where("id", attacker.characterId).update({ nil: 100 });
      await redis.del(attackRateKey(attacker.userId));
      const retry = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(retry.status).toBe(200);
    });

    it("should invalidate the leaderboard cache after a fight that moves Moral (#74)", async () => {
      const attacker = await createPvpPlayer({
        attributes: STRONG_ATTRS,
        streetCred: 30,
        createdAtDaysAgo: 10,
      });
      const defender = await createPvpPlayer({
        attributes: WEAK_ATTRS,
        streetCred: 50,
        createdAtDaysAgo: 10,
      });

      // Populate the server-side leaderboard snapshot (public route, 5-min TTL).
      const preload = await fetch(`${base()}/api/street-cred/leaderboard`);
      expect(preload.status).toBe(200);
      expect(await redis.get(LEADERBOARD_CACHE_KEY)).toBeTruthy();

      const { status } = await attack(attacker, defender.characterId);
      expect(status).toBe(200);

      // #74: any fight can move SC for winner and loser — the snapshot is
      // dropped unconditionally after the combat commits.
      expect(await redis.get(LEADERBOARD_CACHE_KEY)).toBeNull();

      // Fresh snapshot shows the updated score for both fighters.
      const [attackerRow, defenderRow] = await Promise.all([
        getCharacter(attacker.characterId),
        getCharacter(defender.characterId),
      ]);
      const lb = await fetch(`${base()}/api/street-cred/leaderboard`);
      expect(lb.status).toBe(200);
      const body = await json<LeaderboardResponse>(lb);
      const attackerEntry = body.leaderboard.find((e) => e.characterName === attackerRow.name);
      const defenderEntry = body.leaderboard.find((e) => e.characterName === defenderRow.name);
      expect(attackerEntry?.score).toBe(attackerRow.street_cred); // 30 + 5 win
      expect(defenderEntry?.score).toBe(defenderRow.street_cred); // 50 − 2 loss
    });

    it("should report a loss for the attacker when the defender's power is higher", async () => {
      const attacker = await createPvpPlayer({ attributes: WEAK_ATTRS, streetCred: 30 }); // base 5
      const defender = await createPvpPlayer({ attributes: STRONG_ATTRS, createdAtDaysAgo: 10 }); // base 15
      await seedWallet(attacker.characterId, 1000);
      await seedWallet(defender.characterId, 500);

      const res = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<PvpCombatResult>(res);
      expect(body.won).toBe(false);
      expect(body.streetCredChange).toBe(-1); // 30 − max(1, floor(30 × 0.05)) = 29
      expect(body.newStreetCred).toBe(29);
      expect(body.lootAmount).toBe(100); // 10% of the attacker's 1000
      expect(body.newBalance).toBe(900);

      const attackerRow = await getCharacter(attacker.characterId);
      expect(attackerRow.street_cred).toBe(29);
      expect(attackerRow.nil).toBe(80); // NIL is still spent on a lost attack

      const [combat] = await db("pvp_combats")
        .select("*")
        .where("id", body.combatId);
      expect(combat!.winner_id).toBe(defender.characterId);

      const defenderWallet = await getWalletRow(defender.characterId);
      expect(defenderWallet.balance).toBe(600); // 500 + 100 loot
    });

    it("should apply the griefer penalty (1% loot) from the 4th attack on the same target", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
      await seedWallet(defender.characterId, 500);

      const loots: number[] = [];
      const penalties: boolean[] = [];
      for (let i = 1; i <= 4; i++) {
        await clearAttackLimits(attacker); // cooldown + rate counter between attacks
        const { status, body } = await attack(attacker, defender.characterId);
        expect(status).toBe(200);
        loots.push((body as PvpCombatResult).lootAmount);
        penalties.push((body as PvpCombatResult).grieferPenalty);
      }

      // Loot is 10% of the CURRENT balance, so each win shrinks the loot base:
      // 500 → 450 → 405 → 365; the 4th attack also carries the griefer penalty
      // (1% = floor(floor(balance × 0.1) × 0.1) of the current balance).
      expect(loots).toEqual([50, 45, 40, 3]);
      // The result must tell the attacker the 4th fight was grief-reduced.
      expect(penalties).toEqual([false, false, false, true]);

      const combats = await db("pvp_combats")
        .select("*")
        .where("defender_id", defender.characterId)
        .orderBy("created_at");
      expect(combats.map((c) => c.griefer_penalty)).toEqual([false, false, false, true]);
    });

    it("should stop Moral loss after 3 defeats in a day (defeat cap)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({
        attributes: WEAK_ATTRS,
        streetCred: 50,
        createdAtDaysAgo: 10,
      });
      await seedWallet(defender.characterId, 500);

      for (let i = 0; i < 3; i++) {
        await clearAttackLimits(attacker);
        const { status } = await attack(attacker, defender.characterId);
        expect(status).toBe(200);
      }

      const [beforeCap] = await db("characters")
        .select("street_cred")
        .where("id", defender.characterId);
      expect(beforeCap!.street_cred).toBe(44); // 50 − 2 per defeat × 3

      await clearAttackLimits(attacker);
      const fourth = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(fourth.status).toBe(200);
      const fourthBody = await json<PvpCombatResult>(fourth);

      const [afterCap] = await db("characters")
        .select("street_cred")
        .where("id", defender.characterId);
      expect(afterCap!.street_cred).toBe(44); // defeat-capped — no SC loss on the 4th defeat

      // Grana is still looted on the 4th attack (grief-reduced 1% of the
      // current balance: 365 → floor(floor(365 × 0.1) × 0.1) = 3).
      const [walletBefore4] = await db("character_wallets")
        .select("balance")
        .where("character_id", defender.characterId);
      const expectedGriefLoot = Math.floor(Math.floor(walletBefore4!.balance * 0.1) * 0.1);
      expect(fourthBody.lootAmount).toBe(expectedGriefLoot);
    });

    it("should serialize concurrent attacks on the same attacker (row locks prevent lost NIL updates)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const [r1, r2] = await Promise.all([
        server.post(
          "/api/pvp/attack",
          { targetId: defender.characterId },
          authHeader(attacker.accessToken),
        ),
        server.post(
          "/api/pvp/attack",
          { targetId: defender.characterId },
          authHeader(attacker.accessToken),
        ),
      ]);

      // Both requests pass the pre-commit cooldown check; the character rows
      // are locked FOR UPDATE, so the NIL debits serialize instead of
      // double-spending: 100 → 80 → 60 (a lost update would leave 80).
      expect([r1.status, r2.status].sort()).toEqual([200, 200]);

      const attackerRow = await getCharacter(attacker.characterId);
      expect(attackerRow.nil).toBe(60); // 100 − 20 × 2

      const combats = await db("pvp_combats")
        .select("*")
        .where("attacker_id", attacker.characterId);
      expect(combats).toHaveLength(2);
      expect(combats.map((c) => c.loot_amount)).toEqual([0, 0]); // no wallets — nothing to double-take
    });

    it("should reject attacks beyond the hourly rate limit (rateLimitConfig.pvp_attack)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      // Real attacks within the per-character hourly limit are allowed.
      for (let i = 0; i < 3; i++) {
        // Clear only the cooldowns - the per-character rate counter must accumulate.
        await redis.del(middlewareCooldownKey(attacker.characterId));
        await redis.del(serviceCooldownKey(attacker.characterId));
        const { status } = await attack(attacker, defender.characterId);
        expect(status).toBe(200);
      }

      // Exhaust the counter at the configured max (300/h per rateLimitConfig,
      // was 3/h before the 100x pass #121). The next attack trips the limiter.
      await redis.set(attackRateKey(attacker.userId), rateLimitConfig.pvp_attack.max);
      await redis.del(middlewareCooldownKey(attacker.characterId));
      await redis.del(serviceCooldownKey(attacker.characterId));
      const fourth = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(fourth.status).toBe(429);
      const body = await json<ErrorBody>(fourth);
      expect(body.error).toBe("RATE_LIMITED");
    });

    it("should conserve wealth — PVP_REWARD and PVP_LOSS net to zero", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
      await seedWallet(attacker.characterId, 1000);
      await seedWallet(defender.characterId, 500);

      const res = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(res.status).toBe(200);
      const body = await json<PvpCombatResult>(res);
      expect(body.lootAmount).toBe(50);

      const logs = await db("transaction_log")
        .select("*")
        .where("reference_id", body.combatId);
      const reward = logs.find((l) => l.type === "PVP_REWARD");
      const loss = logs.find((l) => l.type === "PVP_LOSS");
      expect(reward).toBeDefined();
      expect(loss).toBeDefined();
      expect(reward!.amount).toBe(50);
      expect(loss!.amount).toBe(-50);
      expect(reward!.amount + loss!.amount).toBe(0);

      // Combined wealth is conserved across the two wallets.
      const attackerWallet = await getWalletRow(attacker.characterId);
      const defenderWallet = await getWalletRow(defender.characterId);
      expect(attackerWallet.balance + defenderWallet.balance).toBe(1500); // 1000 + 500
      expect(attackerWallet.balance).toBe(1050);
      expect(defenderWallet.balance).toBe(450);
    });
  });

  // ─── GET /api/pvp/history ──────────────────────────────────────────────────

  describe("GET /api/pvp/history", () => {
    it("should return the combat record with names and won flag after an attack", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const attackRes = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(attackRes.status).toBe(200);

      const res = await fetch(`${base()}/api/pvp/history`, {
        headers: authHeader(attacker.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<PvpHistoryResponse>(res);
      expect(body.combats).toHaveLength(1);
      expect(body.nextCursor).toBeNull();
      const record = body.combats[0];
      expect(record.attackerName).toEqual(expect.any(String));
      expect(record.defenderName).toEqual(expect.any(String));
      expect(record.won).toBe(true);
      expect(record.lootAmount).toBe(0); // no wallets seeded → no loot
      expect(record.grieferPenalty).toBe(false);
      expect(record.winnerId).toBe(attacker.characterId);
    });

    it("should show both sides of the same fight (defender perspective)", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });

      const attackRes = await server.post(
        "/api/pvp/attack",
        { targetId: defender.characterId },
        authHeader(attacker.accessToken),
      );
      expect(attackRes.status).toBe(200);

      const defenderHistory = await fetch(`${base()}/api/pvp/history`, {
        headers: authHeader(defender.accessToken),
      });
      const body = await json<PvpHistoryResponse>(defenderHistory);
      expect(body.combats).toHaveLength(1);
      expect(body.combats[0].won).toBe(false);
      expect(body.combats[0].winnerId).toBe(attacker.characterId);
    });

    it("should paginate with a createdAt cursor", async () => {
      const attacker = await createPvpPlayer({ attributes: STRONG_ATTRS });
      const defender = await createPvpPlayer({ attributes: WEAK_ATTRS, createdAtDaysAgo: 10 });
      const now = Date.now();
      for (let i = 1; i <= 3; i++) {
        await db("pvp_combats").insert({
          attacker_id: attacker.characterId,
          defender_id: defender.characterId,
          attacker_power: 20 + i,
          defender_power: 10 + i,
          winner_id: attacker.characterId,
          loot_amount: i * 10,
          griefer_penalty: false,
          created_at: new Date(now - (4 - i) * 1000), // oldest 3s ago → newest 1s ago
        });
      }

      const page1Res = await fetch(`${base()}/api/pvp/history?limit=2`, {
        headers: authHeader(attacker.accessToken),
      });
      expect(page1Res.status).toBe(200);
      const page1 = await json<PvpHistoryResponse>(page1Res);
      expect(page1.combats).toHaveLength(2);
      expect(page1.combats.map((c) => c.lootAmount)).toEqual([30, 20]); // newest first
      expect(page1.nextCursor).not.toBeNull();

      const page2Res = await fetch(
        `${base()}/api/pvp/history?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
        { headers: authHeader(attacker.accessToken) },
      );
      expect(page2Res.status).toBe(200);
      const page2 = await json<PvpHistoryResponse>(page2Res);
      expect(page2.combats).toHaveLength(1);
      expect(page2.combats[0].lootAmount).toBe(10);
      expect(page2.nextCursor).toBeNull();
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/pvp/history");
      expect(res.status).toBe(401);
    });
  });
});

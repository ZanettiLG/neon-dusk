import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { getCurrentRound, getRoundHistory, performRoundReset } from "../services/round-service";
import { checkAndReset } from "../cron/round-check";
import { AppError } from "../middleware/error-handler";
import { env } from "../env";
import { UNNAMED_DRINK } from "../game/round-reset";
import { insertTestCharacter, resetDb, resetRounds } from "./helpers";
import type {
  RoundHistoryResponse,
  RoundInfoResponse,
  RoundStatsSnapshot,
} from "@neon-dusk/shared";

// ND-017 — Round service integration tests. Real Postgres (isolated test
// stack); the service is called directly, no HTTP. `resetRounds` truncates
// rounds/round_stats and re-seeds round 1 active (resetDb does NOT touch
// rounds); legends are left alone (permanent hall of fame, saideira seed).

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

describe("ND-017 — Round service (integration)", () => {
  afterAll(async () => {
    // Leave the shared DB clean: remove any unnamed legend rows this suite
    // created (saideira's ordering assertions depend on the untouched seed).
    await db("legends").where("drink_name", UNNAMED_DRINK).del();
  });

  beforeEach(async () => {
    await resetDb();
    await resetRounds();
    // Only this suite creates unnamed legend rows (resetDb/TRUNCATE never touch
    // legends) — remove leftovers so re-runs stay deterministic.
    await db("legends").where("drink_name", UNNAMED_DRINK).del();
  });

  // ─── getCurrentRound ───────────────────────────────────────────────────────

  describe("getCurrentRound", () => {
    it("should return the active round with a live countdown", async () => {
      // Started 10 days ago → 4 days (345,600s) left of the 14-day round.
      const started = new Date(Date.now() - 10 * DAY_MS);
      await db("rounds")
        .where("round_number", 1)
        .update({ started_at: started });

      const info = await getCurrentRound();

      expect(info.roundNumber).toBe(1);
      expect(info.status).toBe("active");
      expect(info.intermissionUntil).toBeNull();
      expect(info.startedAt).toBe(started.toISOString());
      expect(info.endsAt).toBe(new Date(started.getTime() + 14 * DAY_MS).toISOString());
      expect(info.timeRemainingSeconds).toBeGreaterThan(345_000);
      expect(info.timeRemainingSeconds).toBeLessThanOrEqual(345_600);
    });

    it("should report intermission when the next round is scheduled in the future", async () => {
      const startsAt = new Date(Date.now() + 60 * MINUTE_MS);
      await db("rounds").del();
      await db("rounds").insert({ round_number: 2, started_at: startsAt });

      const info = await getCurrentRound();

      expect(info.roundNumber).toBe(2);
      expect(info.status).toBe("intermission");
      expect(info.timeRemainingSeconds).toBe(0);
      // The scheduled start (persisted in the DB) is the source of truth.
      expect(info.intermissionUntil).toBe(startsAt.toISOString());
      expect(info.startedAt).toBe(startsAt.toISOString());
      expect(info.endsAt).toBe(new Date(startsAt.getTime() + 14 * DAY_MS).toISOString());
    });

    it("should keep the persisted schedule when intermission config changes mid-round", async () => {
      // Reset with the default 60-min intermission → round 2 is scheduled at
      // reset time + 60min and that timestamp is persisted.
      const result = await performRoundReset();
      expect(result.newRound).toBe(2);

      const [round2] = await db("rounds").select("*").where("round_number", 2);
      const scheduledStart = round2!.started_at.getTime();
      expect(Math.abs(scheduledStart - Date.now() - 60 * MINUTE_MS)).toBeLessThan(MINUTE_MS);

      // Change the config AFTER the round was scheduled: the persisted start
      // must not move.
      const original = env.ROUND_INTERMISSION_MINUTES;
      try {
        env.ROUND_INTERMISSION_MINUTES = 999;
        const info = await getCurrentRound();
        expect(info.status).toBe("intermission");
        expect(info.intermissionUntil).toBe(new Date(scheduledStart).toISOString());
      } finally {
        env.ROUND_INTERMISSION_MINUTES = original;
      }
    });

    it("should fall back to an intermission-1 anchor when no rounds exist", async () => {
      await db("rounds").del();

      const info = await getCurrentRound();

      expect(info.roundNumber).toBe(1);
      expect(info.status).toBe("intermission");
      expect(info.timeRemainingSeconds).toBe(0);
      expect(info.intermissionUntil).toBeNull();
    });
  });

  // ─── checkAndReset (round-check cron) ──────────────────────────────────────

  describe("checkAndReset", () => {
    // Only app.log is used by checkAndReset; a stub keeps this a DB-level test.
    const app = {
      log: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
    } as unknown as FastifyInstance;

    it("should not reset while the active round is still running", async () => {
      // resetRounds seeds round 1 active with started_at = now → ends 14 days out.
      await checkAndReset(app);

      const allRounds = await db("rounds").select("*").orderBy("round_number");
      expect(allRounds).toHaveLength(1);
      expect(allRounds[0]).toMatchObject({ round_number: 1, status: "active" });
    });

    it("should trigger a reset once the active round has ended", async () => {
      // Started 20 days ago → past the 14-day duration.
      await db("rounds")
        .where("round_number", 1)
        .update({ started_at: new Date(Date.now() - 20 * DAY_MS) });

      await checkAndReset(app);

      const allRounds = await db("rounds").select("*").orderBy("round_number");
      expect(allRounds).toHaveLength(2);
      expect(allRounds[0]).toMatchObject({ round_number: 1, status: "ended" });
      expect(allRounds[1]).toMatchObject({ round_number: 2, status: "active" });
    });
  });

  // ─── getRoundHistory ───────────────────────────────────────────────────────

  describe("getRoundHistory", () => {
    it("should return ended rounds cursor-paginated by round_number DESC", async () => {
      // Ended rounds 1-3 (each with a stats row) + active round 4.
      await db("rounds").del();
      for (const n of [1, 2, 3]) {
        const [round] = await db("rounds")
          .insert({
            round_number: n,
            started_at: new Date(Date.now() - (4 - n) * DAY_MS),
            ended_at: new Date(Date.now() - (3 - n) * DAY_MS),
            status: "ended",
          })
          .returning("id");
        await db("round_stats").insert({
          round_id: round!.id,
          total_gigs_completed: n * 10,
          total_eddies_earned: n * 1000,
          total_pvp_fights: n,
          total_active_characters: n * 5,
          top_sc_character_name: `Runner-${n}`,
          top_sc_value: n,
        });
      }
      await db("rounds").insert({ round_number: 4, started_at: new Date() });

      const page1: RoundHistoryResponse = await getRoundHistory(undefined, 2);
      expect(page1.rounds.map((r) => r.roundNumber)).toEqual([3, 2]);
      expect(page1.nextCursor).toBe(2);
      // Entry shape: ISO dates + the full stats snapshot.
      expect(page1.rounds[0]).toMatchObject({
        roundNumber: 3,
        startedAt: expect.any(String),
        endedAt: expect.any(String),
        stats: {
          totalGigsCompleted: 30,
          totalEddiesEarned: 3000,
          totalPvpFights: 3,
          totalActiveCharacters: 15,
          topScCharacterName: "Runner-3",
          topScValue: 3,
          topCrewName: null,
        },
      });

      const page2: RoundHistoryResponse = await getRoundHistory(page1.nextCursor!, 2);
      expect(page2.rounds.map((r) => r.roundNumber)).toEqual([1]);
      expect(page2.nextCursor).toBeNull();
    });
  });

  // ─── performRoundReset ─────────────────────────────────────────────────────

  describe("performRoundReset", () => {
    it("should reject with 409 NO_ACTIVE_ROUND and leave no partial state", async () => {
      await db("rounds").del();

      const err = await performRoundReset().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("NO_ACTIVE_ROUND");

      // Atomicity guard: nothing was created by the failed attempt.
      const remaining = await db("rounds").select("*");
      expect(remaining).toEqual([]);
    });

    it("should reset all state, capture stats and induct SC-100 legends in one transaction", async () => {
      // Character A: legend candidate (SC 100) with crew, chrome, wallet,
      // heat and a PvP fight. Character B: SC 99 — must NOT be inducted.
      const a = await insertTestCharacter({ name: "Razorback-ND017" });
      const b = await insertTestCharacter({ name: "Ghostwire-ND017" });

      await db("characters")
        .where("id", a.characterId)
        .update({ street_cred: 100, max_street_cred_achieved: 100, nil: 30, humanity: 40 });
      await db("characters")
        .where("id", b.characterId)
        .update({ street_cred: 99, max_street_cred_achieved: 99 });

      // Crew (A leads, A belongs).
      const [crew] = await db("crews")
        .insert({ name: "Os Sem Rosto", tag: "OSR", leader_id: a.characterId })
        .returning("*");
      await db("crew_members")
        .insert({ crew_id: crew!.id, character_id: a.characterId });
      await db("characters")
        .where("id", a.characterId)
        .update({ crew_id: crew!.id });

      // Wallet with balance + lifetime earnings (the stats capture sums
      // lifetime_earned across all wallets).
      await db.transaction(async (trx) => {
        await wallets.ensure(a.characterId, trx);
      });
      await db("character_wallets")
        .where("character_id", a.characterId)
        .update({ balance: 5000, escrow: 500, lifetime_earned: 10000, lifetime_spent: 3000 });

      // Chrome (definition comes from the migration 0004 seed), heat, PvP.
      const [def] = await db("chrome_definitions").select("*").limit(1);
      await db("installed_chrome")
        .insert({ character_id: a.characterId, chrome_definition_id: def!.id });
      await db("heat")
        .insert({ character_id: a.characterId, district: "a_paraiso", amount: 15 });
      await db("pvp_combats").insert({
        attacker_id: a.characterId,
        defender_id: b.characterId,
        attacker_power: 50,
        defender_power: 40,
        winner_id: a.characterId,
        loot_amount: 100,
      });

      const result = await performRoundReset();

      expect(result).toMatchObject({ endedRound: 1, newRound: 2, legendsInducted: 1 });
      expect(result.stats).toEqual<RoundStatsSnapshot>({
        totalGigsCompleted: 0,
        totalEddiesEarned: 10000,
        totalPvpFights: 1,
        totalActiveCharacters: 2,
        topCrewName: "Os Sem Rosto",
        topScCharacterName: "Razorback-ND017",
        topScValue: 100,
      });

      // Legends: exactly A (SC 100) inducted with the unnamed drink; B (99) not.
      const legendRows = await db("legends")
        .select("*")
        .where("character_name", "Razorback-ND017");
      expect(legendRows).toHaveLength(1);
      expect(legendRows[0]).toMatchObject({
        character_name: "Razorback-ND017",
        drink_name: UNNAMED_DRINK,
        crew_name: "Os Sem Rosto",
      });
      const bLegend = await db("legends")
        .select("*")
        .where("character_name", "Ghostwire-ND017");
      expect(bLegend).toEqual([]);

      // Characters reset: base attrs, SC 0 (max persists), NIL/humanity 100.
      const [[aAfter], [bAfter]] = await Promise.all([
        db("characters").select("*").where("id", a.characterId).limit(1),
        db("characters").select("*").where("id", b.characterId).limit(1),
      ]);
      for (const ch of [aAfter, bAfter]) {
        expect(ch.street_cred).toBe(0);
        expect(ch.body).toBe(3);
        expect(ch.reflexes).toBe(3);
        expect(ch.intelligence).toBe(3);
        expect(ch.technical).toBe(3);
        expect(ch.cool).toBe(3);
        expect(ch.nil).toBe(100);
        expect(ch.humanity).toBe(100);
        expect(ch.crew_id).toBeNull();
      }
      expect(aAfter.max_street_cred_achieved).toBe(100);
      expect(bAfter.max_street_cred_achieved).toBe(99);

      // Wallet zeroed + version bumped.
      const [wallet] = await db("character_wallets")
        .select("*")
        .where("character_id", a.characterId);
      expect(wallet).toMatchObject({ balance: 0, escrow: 0, lifetime_earned: 0, lifetime_spent: 0 });
      expect(wallet!.version).toBe(1);

      // Per-round tables wiped; rounds closed + next one opened.
      expect(await db("crews").select("*")).toEqual([]);
      expect(await db("crew_members").select("*")).toEqual([]);
      expect(await db("installed_chrome").select("*")).toEqual([]);
      expect(await db("heat").select("*")).toEqual([]);
      expect(await db("pvp_combats").select("*")).toEqual([]);

      const allRounds = await db("rounds").select("*").orderBy("round_number");
      expect(allRounds).toHaveLength(2);
      expect(allRounds[0]).toMatchObject({ round_number: 1, status: "ended" });
      expect(allRounds[0].ended_at).not.toBeNull();
      expect(allRounds[1]).toMatchObject({ round_number: 2, status: "active" });

      // Post-reset countdown reports the scheduled (intermission) round.
      const info: RoundInfoResponse = await getCurrentRound();
      expect(info.status).toBe("intermission");
      expect(info.roundNumber).toBe(2);
    });

    it("should increment round numbers across consecutive resets", async () => {
      const first = await performRoundReset();
      const second = await performRoundReset();

      expect(first).toMatchObject({ endedRound: 1, newRound: 2 });
      expect(second).toMatchObject({ endedRound: 2, newRound: 3 });

      const allRounds = await db("rounds").select("*").orderBy("round_number");
      expect(allRounds.map((r) => [r.round_number, r.status])).toEqual([
        [1, "ended"],
        [2, "ended"],
        [3, "active"],
      ]);

      // Both ended rounds appear in history, newest first.
      const history = await getRoundHistory(undefined, 10);
      expect(history.rounds.map((r) => r.roundNumber)).toEqual([2, 1]);
    });

    it("should handle a round with no active characters (zero stats)", async () => {
      const result = await performRoundReset();

      expect(result).toMatchObject({ endedRound: 1, newRound: 2, legendsInducted: 0 });
      expect(result.stats).toEqual<RoundStatsSnapshot>({
        totalGigsCompleted: 0,
        totalEddiesEarned: 0,
        totalPvpFights: 0,
        totalActiveCharacters: 0,
        topCrewName: null,
        topScCharacterName: null,
        topScValue: null,
      });
      // No new legends: no character reached SC 100 (seeded hall-of-fame rows
      // from migration 0009 are untouched).
      const unnamed = await db("legends")
        .select("*")
        .where("drink_name", UNNAMED_DRINK);
      expect(unnamed).toEqual([]);

      // The captured zero-stats row is readable in history.
      const history = await getRoundHistory(undefined, 10);
      expect(history.rounds).toHaveLength(1);
      expect(history.rounds[0].stats.totalActiveCharacters).toBe(0);
    });
  });
});

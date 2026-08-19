// Neon Dusk — Round reset game logic (pure functions, no DB access)
// ============================================================================
// ND-017: 14-day rounds with a full server-side reset. This module generates
// the SQL sequence and transforms stat aggregates — it NEVER touches the
// database. The service layer (round-service.ts) executes the steps inside a
// single transaction.
//
// Reset contract (docs/definicoes-de-produto/04-sistemas-e-progressao.md):
// attributes → base 3, street_cred → 0 (max_street_cred_achieved persists,
// ADR-7), NIL → 100, humanity → 100, chrome wiped, crews dissolved, gigs/pvp/
// heat/transaction history wiped, wallets zeroed. SC 100 characters are
// inducted into the Legends table BEFORE Moral is zeroed.

import type { RoundStatsSnapshot } from "@neon-dusk/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

/** One step in the reset sequence, executed in order within a transaction. */
export interface ResetStep {
  /** Human-readable label for logging/progress tracking. */
  description: string;
  /** Single-statement SQL to execute via db.execute(). */
  sql: string;
}

/** A character eligible for the Legends hall of fame (SC 100). */
export interface LegendCandidate {
  characterName: string;
  crewName: string | null;
  /** Round the legend was inducted in — carried for the caller (no column). */
  roundNumber: number;
}

/** Raw aggregates the capture step returns, before the wipe. */
export interface RoundStatsInput {
  totalGigsCompleted: number;
  totalEddiesEarned: number;
  totalPvpFights: number;
  totalActiveCharacters: number;
  topCrew: { name: string; score: number } | null;
  topScCharacter: { name: string; score: number } | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Placeholder drink name — the player names it via POST /api/legends/name-drink. */
export const UNNAMED_DRINK = "__UNNAMED__" as const;

/** Label of the step that resets characters — legends must be preserved before it. */
export const RESET_CHARACTERS_STEP = "reset_characters";

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Build the ordered SQL sequence for a full round reset.
 *
 * The steps are self-contained (single statements) and order-sensitive:
 * stats are captured and persisted BEFORE any wipe, the round is closed, the
 * data is wiped, characters/wallets return to base, and the next round opens.
 * The caller MUST run the legend INSERT (buildLegendInserts) before crews are
 * wiped (wipe_crew_members/detach/wipe_crews) and before the `reset_characters`
 * step — both the crew affiliation and street_cred = 100 (the induction
 * signals) are gone after those steps.
 *
 * @param options.intermissionMinutes - Gap between rounds (default 60).
 *   The value is a validated positive integer from env, so interpolating it
 *   into the SQL is safe (never user input).
 */
export function buildResetQueries(
  options: { intermissionMinutes: number } = { intermissionMinutes: 60 },
): ResetStep[] {
  const intermission = options.intermissionMinutes;

  return [
    // 1. Capture round stats BEFORE any data is wiped (read-only snapshot).
    {
      description: "capture_round_stats",
      sql: `SELECT
        (SELECT COUNT(*)::int FROM "gig_history" WHERE "outcome" = 'success') AS "total_gigs_completed",
        (SELECT COALESCE(SUM("lifetime_earned"), 0)::bigint FROM "character_wallets") AS "total_eddies_earned",
        (SELECT COUNT(*)::int FROM "pvp_combats") AS "total_pvp_fights",
        (SELECT COUNT(*)::int FROM "characters") AS "total_active_characters",
        (SELECT c."name" FROM "crews" c JOIN "crew_members" cm ON cm."crew_id" = c."id" JOIN "characters" ch ON ch."id" = cm."character_id" GROUP BY c."id" ORDER BY SUM(ch."street_cred") DESC, c."name" ASC LIMIT 1) AS "top_crew_name",
        (SELECT COALESCE(SUM(ch."street_cred"), 0)::int FROM "crews" c JOIN "crew_members" cm ON cm."crew_id" = c."id" JOIN "characters" ch ON ch."id" = cm."character_id" GROUP BY c."id" ORDER BY SUM(ch."street_cred") DESC, c."name" ASC LIMIT 1) AS "top_crew_sc",
        (SELECT "name" FROM "characters" ORDER BY "street_cred" DESC, "name" ASC LIMIT 1) AS "top_sc_character_name",
        (SELECT "street_cred" FROM "characters" ORDER BY "street_cred" DESC, "name" ASC LIMIT 1) AS "top_sc_value"`,
    },
    // 2. Persist the snapshot for the round that is about to end (round still active here).
    {
      description: "insert_round_stats",
      sql: `INSERT INTO "round_stats" ("round_id", "total_gigs_completed", "total_eddies_earned", "total_pvp_fights", "total_active_characters", "top_crew_id", "top_crew_name", "top_sc_character_id", "top_sc_character_name", "top_sc_value")
SELECT
  (SELECT "id" FROM "rounds" WHERE "status" = 'active' LIMIT 1),
  (SELECT COUNT(*)::int FROM "gig_history" WHERE "outcome" = 'success'),
  (SELECT COALESCE(SUM("lifetime_earned"), 0)::bigint FROM "character_wallets"),
  (SELECT COUNT(*)::int FROM "pvp_combats"),
  (SELECT COUNT(*)::int FROM "characters"),
  (SELECT c."id" FROM "crews" c JOIN "crew_members" cm ON cm."crew_id" = c."id" JOIN "characters" ch ON ch."id" = cm."character_id" GROUP BY c."id" ORDER BY SUM(ch."street_cred") DESC, c."name" ASC LIMIT 1),
  (SELECT c."name" FROM "crews" c JOIN "crew_members" cm ON cm."crew_id" = c."id" JOIN "characters" ch ON ch."id" = cm."character_id" GROUP BY c."id" ORDER BY SUM(ch."street_cred") DESC, c."name" ASC LIMIT 1),
  (SELECT "id" FROM "characters" ORDER BY "street_cred" DESC, "name" ASC LIMIT 1),
  (SELECT "name" FROM "characters" ORDER BY "street_cred" DESC, "name" ASC LIMIT 1),
  (SELECT "street_cred" FROM "characters" ORDER BY "street_cred" DESC, "name" ASC LIMIT 1)`,
    },
    // 3. Close the current round.
    {
      description: "end_current_round",
      sql: `UPDATE "rounds" SET "status" = 'ended', "ended_at" = now() WHERE "status" = 'active'`,
    },
    // 4-13. Wipe per-round state (order: gigs → chrome → pvp → heat → audit → crews).
    { description: "wipe_active_gigs", sql: `DELETE FROM "active_gigs"` },
    { description: "wipe_gig_history", sql: `DELETE FROM "gig_history"` },
    { description: "wipe_installed_chrome", sql: `DELETE FROM "installed_chrome"` },
    { description: "wipe_pvp_combats", sql: `DELETE FROM "pvp_combats"` },
    { description: "wipe_heat", sql: `DELETE FROM "heat"` },
    { description: "wipe_transaction_log", sql: `DELETE FROM "transaction_log"` },
    { description: "wipe_crew_invites", sql: `DELETE FROM "crew_invites"` },
    { description: "wipe_crew_members", sql: `DELETE FROM "crew_members"` },
    {
      description: "detach_crew_membership",
      sql: `UPDATE "characters" SET "crew_id" = NULL, "updated_at" = now()`,
    },
    { description: "wipe_crews", sql: `DELETE FROM "crews"` },
    // 14. Economy reset — wallets zeroed, optimistic-lock version bumped.
    {
      description: "zero_wallets",
      sql: `UPDATE "character_wallets" SET "balance" = 0, "escrow" = 0, "lifetime_earned" = 0, "lifetime_spent" = 0, "version" = "version" + 1, "updated_at" = now()`,
    },
    // 15. Character reset — SC 0 (max_street_cred_achieved persists), base
    //     attributes, NIL 100, humanity 100, activity clock reset.
    {
      description: RESET_CHARACTERS_STEP,
      sql: `UPDATE "characters" SET "street_cred" = 0, "body" = 3, "reflexes" = 3, "intelligence" = 3, "technical" = 3, "cool" = 3, "nil" = 100, "nil_updated_at" = now(), "humanity" = 100, "last_activity_at" = now(), "updated_at" = now()`,
    },
    // 16. Open the next round after the intermission gap. COALESCE guards the
    //     degenerate empty-table case.
    {
      description: "start_next_round",
      sql: `INSERT INTO "rounds" ("round_number", "started_at", "status") SELECT COALESCE(MAX("round_number"), 0) + 1, now() + (${intermission} * interval '1 minute'), 'active' FROM "rounds"`,
    },
  ];
}

/**
 * Build the INSERT for the Legends hall of fame. Each candidate gets a row
 * with the placeholder drink name; the player names it later via
 * POST /api/legends/name-drink.
 *
 * The multi-row INSERT is built with a raw string — the only escape needed is
 * single-quote doubling for PostgreSQL string literals (character/crew names
 * are the only interpolated values). Returns null when there are no candidates.
 */
export function buildLegendInserts(candidates: LegendCandidate[]): ResetStep | null {
  if (candidates.length === 0) return null;

  const values = candidates
    .map((c) => {
      const name = c.characterName.replace(/'/g, "''");
      const crew = c.crewName ? `'${c.crewName.replace(/'/g, "''")}'` : "NULL";
      return `('${name}', '${UNNAMED_DRINK}', now(), ${crew})`;
    })
    .join(", ");

  return {
    description: "preserve_legends",
    sql: `INSERT INTO "legends" ("character_name", "drink_name", "achieved_at", "crew_name") VALUES ${values}`,
  };
}

/**
 * Pure transformation: raw stat aggregates → typed snapshot.
 * All DB access happens in the caller (round service).
 */
export function calculateRoundStats(raw: RoundStatsInput): RoundStatsSnapshot {
  return {
    totalGigsCompleted: raw.totalGigsCompleted,
    totalEddiesEarned: raw.totalEddiesEarned,
    totalPvpFights: raw.totalPvpFights,
    totalActiveCharacters: raw.totalActiveCharacters,
    topCrewName: raw.topCrew?.name ?? null,
    topScCharacterName: raw.topScCharacter?.name ?? null,
    topScValue: raw.topScCharacter?.score ?? null,
  };
}

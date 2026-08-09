// Neon Dusk — Round service (ND-017)
// ============================================================================
// The ONLY module that touches the database for round lifecycle. Game logic
// lives in game/round-reset.ts (pure functions); this module sequences the
// reset inside a single transaction and answers round-info/history queries.

import type {
  RoundHistoryEntry,
  RoundHistoryResponse,
  RoundInfoResponse,
  RoundStatsSnapshot,
} from "@neon-dusk/shared";
import { db, type Queryable } from "../db";
import { env } from "../env";
import { AppError } from "../middleware/error-handler";
import {
  buildLegendInserts,
  buildResetQueries,
  calculateRoundStats,
  type LegendCandidate,
} from "../game/round-reset";

/** ms in one day (ROUND_DURATION_DAYS is expressed in days). */
const DAY_MS = 86_400_000;

/** Result of a reset — stats snapshot included for caller observability. */
export interface RoundResetResult {
  endedRound: number;
  newRound: number;
  legendsInducted: number;
  stats: RoundStatsSnapshot;
}

/** Row shape of the capture step (step 1 of buildResetQueries). */
type SnapshotRow = {
  total_gigs_completed: number;
  total_eddies_earned: number;
  total_pvp_fights: number;
  total_active_characters: number;
  top_crew_name: string | null;
  top_crew_sc: number | null;
  top_sc_character_name: string | null;
  top_sc_value: number | null;
};

/** Row shape of the legend candidates query. */
type LegendRow = {
  character_name: string;
  crew_name: string | null;
};

/**
 * Execute a full round reset in a single transaction:
 * 1. Capture + persist round stats (before any wipe)
 * 2. Induct SC 100 characters into Legends (before street cred is zeroed)
 * 3. Run the reset wipe sequence
 * 4. Close the current round and open the next after the intermission
 *
 * Throws AppError(409) when there is no active round to reset.
 */
export async function performRoundReset(): Promise<RoundResetResult> {
  return db.transaction(async (trx) => {
    const [activeRound] = await trx("rounds")
      .select()
      .where("status", "active")
      .limit(1);
    if (!activeRound) {
      throw new AppError(409, "NO_ACTIVE_ROUND", "Não há rodada ativa para resetar");
    }

    const steps = buildResetQueries({ intermissionMinutes: env.ROUND_INTERMISSION_MINUTES });
    let stats: RoundStatsSnapshot = {
      totalGigsCompleted: 0,
      totalEddiesEarned: 0,
      totalPvpFights: 0,
      totalActiveCharacters: 0,
      topCrewName: null,
      topScCharacterName: null,
      topScValue: null,
    };
    let legendsInducted = 0;

    for (const step of steps) {
      // Legends must be preserved BEFORE crews are destroyed and street cred
      // is zeroed — the induction signals (street_cred = 100 and the crew
      // affiliation) are both gone after wipe_crew_members/detach/wipe_crews
      // and the reset_characters step. Hook right before the crew wipe.
      if (step.description === "wipe_crew_members") {
        legendsInducted = await inductLegends(trx, activeRound.round_number);
      }

      // Execute the step's SQL directly via Knex raw.
      const result = await trx.raw(step.sql);

      // Capture the snapshot row (step 1) for caller observability.
      if (step.description === "capture_round_stats" && result.rows?.[0]) {
        const row = result.rows[0] as SnapshotRow;
        stats = calculateRoundStats({
          totalGigsCompleted: Number(row.total_gigs_completed ?? 0),
          totalEddiesEarned: Number(row.total_eddies_earned ?? 0),
          totalPvpFights: Number(row.total_pvp_fights ?? 0),
          totalActiveCharacters: Number(row.total_active_characters ?? 0),
          topCrew: row.top_crew_name
            ? { name: row.top_crew_name, score: Number(row.top_crew_sc ?? 0) }
            : null,
          topScCharacter: row.top_sc_character_name
            ? { name: row.top_sc_character_name, score: Number(row.top_sc_value ?? 0) }
            : null,
        });
      }
    }

    return {
      endedRound: activeRound.round_number,
      newRound: activeRound.round_number + 1,
      legendsInducted,
      stats,
    };
  });
}

/**
 * Insert Legends rows for every character at street_cred 100, before the
 * reset wipes reputation. Returns the number of inducted legends.
 */
async function inductLegends(tx: Queryable, roundNumber: number): Promise<number> {
  const result = await tx.raw(`
    SELECT ch."name" AS "character_name", c."name" AS "crew_name"
    FROM "characters" ch
    LEFT JOIN "crews" c ON c."id" = ch."crew_id"
    WHERE ch."street_cred" = 100
  `);

  const rows = result.rows as LegendRow[];
  const candidates: LegendCandidate[] = rows.map((r) => ({
    characterName: r.character_name,
    crewName: r.crew_name ?? null,
    roundNumber,
  }));

  const legendStep = buildLegendInserts(candidates);
  if (legendStep) await tx.raw(legendStep.sql);
  return candidates.length;
}

/**
 * Info on the current round with a live countdown. While a round is active
 * the countdown runs down to startedAt + ROUND_DURATION_DAYS; during the
 * intermission (next round scheduled but not started) the response reports
 * `status: "intermission"` with `intermissionUntil` set.
 */
export async function getCurrentRound(): Promise<RoundInfoResponse> {
  const durationMs = env.ROUND_DURATION_DAYS * DAY_MS;
  const now = Date.now();

  const [active] = await db("rounds").select().where("status", "active").limit(1);

  if (active) {
    const started = new Date(active.started_at).getTime();
    const endsAt = started + durationMs;

    if (started > now) {
      // The next round exists but has not started — we are in the intermission.
      return {
        roundNumber: active.round_number,
        status: "intermission",
        startedAt: new Date(active.started_at).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        timeRemainingSeconds: 0,
        intermissionUntil: new Date(active.started_at).toISOString(),
      };
    }

    return {
      roundNumber: active.round_number,
      status: "active",
      startedAt: new Date(active.started_at).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      timeRemainingSeconds: Math.max(0, Math.floor((endsAt - now) / 1000)),
      intermissionUntil: null,
    };
  }

  // Degenerate state (no active round — pre-seed or manual DB edit). Fall
  // back to intermission with unknown start, anchored on the latest round.
  const [latest] = await db("rounds").select().orderBy("round_number", "desc").limit(1);
  const anchor = latest?.ended_at ?? latest?.started_at ?? new Date(now);
  return {
    roundNumber: (latest?.round_number ?? 0) + 1,
    status: "intermission",
    startedAt: new Date(anchor).toISOString(),
    endsAt: new Date(new Date(anchor).getTime() + durationMs).toISOString(),
    timeRemainingSeconds: 0,
    intermissionUntil: null,
  };
}

/**
 * Cursor-paginated history of ended rounds (round_number DESC).
 * The cursor is the round_number to page BEFORE; nextCursor is the last
 * returned round_number when more pages exist, else null.
 */
export async function getRoundHistory(
  cursor: number | undefined,
  limit: number,
): Promise<RoundHistoryResponse> {
  let query = db("rounds")
    .select({
      roundNumber: "rounds.round_number",
      startedAt: "rounds.started_at",
      endedAt: "rounds.ended_at",
      totalGigsCompleted: "round_stats.total_gigs_completed",
      totalEddiesEarned: "round_stats.total_eddies_earned",
      totalPvpFights: "round_stats.total_pvp_fights",
      totalActiveCharacters: "round_stats.total_active_characters",
      topCrewName: "round_stats.top_crew_name",
      topScCharacterName: "round_stats.top_sc_character_name",
      topScValue: "round_stats.top_sc_value",
    })
    .join("round_stats", "round_stats.round_id", "rounds.id")
    .whereNotNull("rounds.ended_at");

  if (cursor !== undefined) {
    query = query.where("rounds.round_number", "<", cursor);
  }

  const rows = await query
    .orderBy("rounds.round_number", "desc")
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const entries: RoundHistoryEntry[] = page.map((row) => ({
    roundNumber: row.roundNumber,
    startedAt: new Date(row.startedAt).toISOString(),
    // Non-null: the query filters on rounds.ended_at IS NOT NULL.
    endedAt: new Date(row.endedAt!).toISOString(),
    stats: {
      totalGigsCompleted: row.totalGigsCompleted,
      totalEddiesEarned: row.totalEddiesEarned,
      totalPvpFights: row.totalPvpFights,
      totalActiveCharacters: row.totalActiveCharacters,
      topCrewName: row.topCrewName,
      topScCharacterName: row.topScCharacterName,
      topScValue: row.topScValue,
    },
  }));

  return {
    rounds: entries,
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].roundNumber : null,
  };
}

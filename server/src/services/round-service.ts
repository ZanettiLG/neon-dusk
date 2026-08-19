// Neon Dusk — Round service (ND-017)
// ============================================================================
// The ONLY module that orchestrates round lifecycle. Game logic lives in
// game/round-reset.ts (pure functions); this module sequences the reset
// inside a single transaction and answers round-info/history queries. All
// table access goes through the repositories (#158).

import type {
  RoundHistoryEntry,
  RoundHistoryResponse,
  RoundInfoResponse,
  RoundStatsSnapshot,
} from "@neon-dusk/shared";
import { env } from "../env";
import { AppError } from "../middleware/error-handler";
import {
  buildLegendInserts,
  buildResetQueries,
  calculateRoundStats,
  type LegendCandidate,
} from "../game/round-reset";
import { withTransaction } from "../db";
import type { Queryable } from "../repositories";
import { characterRepository as characters } from "../repositories/character-repository";
import { legendRepository as legends } from "../repositories/legend-repository";
import { roundRepository as rounds } from "../repositories/round-repository";

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

/**
 * Execute a full round reset in a single transaction:
 * 1. Capture + persist round stats (before any wipe)
 * 2. Induct SC 100 characters into Legends (before Moral is zeroed)
 * 3. Run the reset wipe sequence
 * 4. Close the current round and open the next after the intermission
 *
 * Throws AppError(409) when there is no active round to reset.
 */
export async function performRoundReset(): Promise<RoundResetResult> {
  return withTransaction(async (trx) => {
    const activeRound = await rounds.findActive(trx);
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
      // Legends must be preserved BEFORE crews are destroyed and Moral
      // is zeroed — the induction signals (street_cred = 100 and the crew
      // affiliation) are both gone after wipe_crew_members/detach/wipe_crews
      // and the reset_characters step. Hook right before the crew wipe.
      if (step.description === "wipe_crew_members") {
        legendsInducted = await inductLegends(trx, activeRound.round_number);
      }

      // Execute the step's SQL directly via the repository.
      const result = await rounds.executeStep(trx, step.sql);

      // Capture the snapshot row (step 1) for caller observability.
      if (step.description === "capture_round_stats" && result.rows?.[0]) {
        const row = result.rows[0] as unknown as SnapshotRow;
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
  const rows = await characters.listLegendCandidates(tx);

  const candidates: LegendCandidate[] = rows.map((r) => ({
    characterName: r.character_name,
    crewName: r.crew_name ?? null,
    roundNumber,
  }));

  const legendStep = buildLegendInserts(candidates);
  if (legendStep) await legends.executeInserts(tx, legendStep.sql);
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

  const active = await rounds.findActive();

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
  const latest = await rounds.findLatest();
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
  const rows = await rounds.listEnded(cursor, limit);

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

import { db, type Queryable } from "../db";

// Neon Dusk — Round repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `rounds`. */
export interface RoundRow {
  id: string;
  round_number: number;
  started_at: Date;
  ended_at: Date | null;
  status: string;
  created_at: Date;
}

/** Ended-round history row (rounds ⋈ round_stats). */
export interface RoundHistoryRow {
  roundNumber: number;
  startedAt: Date;
  endedAt: Date | null;
  totalGigsCompleted: number;
  totalEddiesEarned: number;
  totalPvpFights: number;
  totalActiveCharacters: number;
  topCrewName: string | null;
  topScCharacterName: string | null;
  topScValue: number | null;
}

export interface RoundRepository {
  /** The active round, or null. */
  findActive(q?: Queryable): Promise<RoundRow | null>;
  /** The most recent round by number, or null. */
  findLatest(q?: Queryable): Promise<RoundRow | null>;
  /** The most recently ended round (Saideira "last reset" display). */
  findLastEnded(q?: Queryable): Promise<{ endedAt: Date } | null>;
  /** Cursor-paginated ended rounds (round_number DESC), +1 row for pagination. */
  listEnded(cursor: number | undefined, limit: number, q?: Queryable): Promise<RoundHistoryRow[]>;
  /**
   * Execute one generated reset SQL step (game/round-reset.ts produces the
   * statements). Returns the raw result so the caller can capture the stats
   * snapshot row from the capture step.
   */
  executeStep(q: Queryable, sql: string): Promise<{ rows?: Array<Record<string, unknown>> }>;
}

export function createRoundRepository(q: Queryable = db): RoundRepository {
  return {
    async findActive(tx = q) {
      const rows = await tx("rounds").select().where("status", "active").limit(1);
      return rows.length ? (rows[0] as RoundRow) : null;
    },

    async findLatest(tx = q) {
      const rows = await tx("rounds").select().orderBy("round_number", "desc").limit(1);
      return rows.length ? (rows[0] as RoundRow) : null;
    },

    async findLastEnded(tx = q) {
      const rows = await tx("rounds")
        .select("ended_at as endedAt")
        .whereNotNull("ended_at")
        .orderBy("round_number", "desc")
        .limit(1);
      return rows.length ? (rows[0] as { endedAt: Date }) : null;
    },

    async listEnded(cursor, limit, tx = q) {
      let query = tx("rounds")
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

      return (await query
        .orderBy("rounds.round_number", "desc")
        .limit(limit + 1)) as unknown as RoundHistoryRow[];
    },

    async executeStep(tx, sql) {
      const result = await tx.raw(sql);
      return { rows: result.rows as Array<Record<string, unknown>> | undefined };
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const roundRepository = createRoundRepository();

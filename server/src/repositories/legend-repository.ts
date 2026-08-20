import { db, type Queryable } from "../db";
import { UNNAMED_DRINK } from "../game/round-reset";

// Neon Dusk — Legends repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `legends`. */
export interface LegendRow {
  id: string;
  character_name: string;
  drink_name: string;
  achieved_at: Date;
  crew_name: string | null;
  created_at: Date;
}

/** Insert input for a Legends row. */
export interface LegendInsert {
  character_name: string;
  drink_name: string;
  achieved_at?: Date | string;
  crew_name?: string | null;
}

export interface LegendRepository {
  /** The hall of fame, newest achievement first. */
  listTop(q?: Queryable): Promise<LegendRow[]>;
  /** Insert one Legends row. */
  insert(entry: LegendInsert, q?: Queryable): Promise<LegendRow>;
  /**
   * Name the drink of a Lenda inducted this round (matches the
   * `__UNNAMED__` placeholder for the caller's character name).
   */
  updateDrinkName(characterName: string, drinkName: string, q?: Queryable): Promise<LegendRow | undefined>;
  /** Execute a generated bulk-insert SQL (round reset induction). */
  executeInserts(q: Queryable, sql: string): Promise<void>;
}

export function createLegendRepository(q: Queryable = db): LegendRepository {
  return {
    async listTop(tx = q) {
      // ponytail: the hall of fame is tiny (5 seeds + per-round inductees) —
      // materialize it fully; add LIMIT pagination if it ever grows.
      return (await tx("legends").select().orderBy("achieved_at", "desc")) as LegendRow[];
    },

    async insert(entry, tx = q) {
      const [row] = await tx("legends").insert(entry).returning("*");
      return row as LegendRow;
    },

    async updateDrinkName(characterName, drinkName, tx = q) {
      const rows = await tx("legends")
        .update({ drink_name: drinkName })
        .where("character_name", characterName)
        .where("drink_name", UNNAMED_DRINK)
        .returning("*");
      return rows.length ? (rows[0] as LegendRow) : undefined;
    },

    async executeInserts(tx, sql) {
      await tx.raw(sql);
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const legendRepository = createLegendRepository();

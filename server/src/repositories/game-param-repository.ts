import { db, type Queryable } from "../db";

// Neon Dusk — Game param repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `game_params`. */
export interface GameParamRow {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: Date;
}

export interface GameParamRepository {
  /** All params as a flat record. */
  get(q?: Queryable): Promise<Record<string, string>>;
  /** All param rows. */
  list(q?: Queryable): Promise<GameParamRow[]>;
  /** Update one param (key must already exist — checked by the caller). */
  set(key: string, value: string, adminUserId: string, q?: Queryable): Promise<void>;
}

export function createGameParamRepository(q: Queryable = db): GameParamRepository {
  return {
    async get(tx = q) {
      const rows = await tx("game_params").select();
      return Object.fromEntries(
        rows.map((r) => [(r as GameParamRow).key, (r as GameParamRow).value]),
      );
    },

    async list(tx = q) {
      return (await tx("game_params").select()) as GameParamRow[];
    },

    async set(key, value, adminUserId, tx = q) {
      await tx("game_params")
        .update({ value, updated_by: adminUserId, updated_at: new Date() })
        .where("key", key);
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const gameParamRepository = createGameParamRepository();

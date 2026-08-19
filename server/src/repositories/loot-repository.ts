import { db, type Queryable } from "../db";

// Neon Dusk — Loot repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `loot_tables`. */
export interface LootTableRow {
  id: string;
  gig_tier: string;
  item_type: string;
  item_id: string;
  weight: number;
  min_quantity: number;
  max_quantity: number;
}

export interface LootRepository {
  /** All loot rows for a trampo tier (or every tier when omitted). */
  listByTier(tier: string | undefined, q?: Queryable): Promise<LootTableRow[]>;
}

export function createLootRepository(q: Queryable = db): LootRepository {
  return {
    async listByTier(tier, tx = q) {
      let query = tx("loot_tables").select();
      if (tier !== undefined) {
        query = query.where("gig_tier", tier);
      }
      return (await query) as LootTableRow[];
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const lootRepository = createLootRepository();

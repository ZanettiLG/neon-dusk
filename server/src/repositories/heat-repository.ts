import { db, type Queryable } from "../db";

// Neon Dusk — Heat repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `heat` (district heat subset). */
export interface HeatRow {
  id: string;
  character_id: string;
  district: string;
  amount: number;
  updated_at: Date;
}

export interface HeatRepository {
  /** The character's heat row for a district (with lazy-decay inputs). */
  getForDistrict(
    characterId: string,
    district: string,
    q?: Queryable,
  ): Promise<{ amount: number; updated_at: Date } | null>;
  /** Every heat row of the character (metro map aggregation, issue #18). */
  listForCharacter(characterId: string, q?: Queryable): Promise<HeatRow[]>;
  /** Upsert heat (one row per character + district). */
  upsert(characterId: string, district: string, amount: number, q?: Queryable): Promise<void>;
}

export function createHeatRepository(q: Queryable = db): HeatRepository {
  return {
    async getForDistrict(characterId, district, tx = q) {
      const rows = await tx("heat")
        .select("amount", "updated_at")
        .where("character_id", characterId)
        .where("district", district)
        .limit(1);
      return rows.length ? (rows[0] as { amount: number; updated_at: Date }) : null;
    },

    async listForCharacter(characterId, tx = q) {
      return (await tx("heat")
        .select()
        .where("character_id", characterId)) as unknown as HeatRow[];
    },

    async upsert(characterId, district, amount, tx = q) {
      await tx("heat")
        .insert({
          character_id: characterId,
          district,
          amount,
          updated_at: new Date(),
        })
        .onConflict(["character_id", "district"])
        .merge({ amount, updated_at: new Date() });
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const heatRepository = createHeatRepository();

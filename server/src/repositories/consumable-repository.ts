import { db, type Queryable } from "../db";

// Neon Dusk — Consumables repository (#158 DB repository layer)
// ============================================================================
// `consumables` catalog + `character_consumables` inventory +
// `consumable_uses` log. The inventory write used by the vendor purchase
// path is an upsert (ON CONFLICT quantity + 1); the use path decrements
// guarded by `quantity > 0` (never negative — CHECK constraint backstop).

/** Raw row shape for `consumables`. */
export interface ConsumableRow {
  id: string;
  slug: string;
  name: string;
  tier: number;
  restore_amount: number;
  cooldown_hours: number;
  is_active: boolean;
  created_at: Date;
}

/** Raw row shape for `character_consumables`. */
export interface OwnedConsumableRow {
  id: string;
  character_id: string;
  consumable_id: string;
  quantity: number;
  created_at: Date;
}

/** Raw row shape for `consumable_uses`. */
export interface ConsumableUseRow {
  id: string;
  character_id: string;
  consumable_id: string;
  restored_amount: number;
  multiplier: string;
  used_at: Date;
  created_at: Date;
}

export interface ConsumableRepository {
  /** Active catalog ordered by tier then name. */
  listCatalog(q?: Queryable): Promise<ConsumableRow[]>;
  /** Catalog row by id (any is_active state — 404 lookup). */
  findById(id: string, q?: Queryable): Promise<ConsumableRow | null>;
  /** Active catalog row by slug (vendor-purchase grant lookup). */
  findActiveBySlug(slug: string, q?: Queryable): Promise<ConsumableRow | null>;
  /** Inventory rows of one character (joined with the catalog). */
  listOwned(characterId: string, q?: Queryable): Promise<Array<OwnedConsumableRow & ConsumableRow>>;
  /** Inventory row of one item (null when the character owns none). */
  getOwned(characterId: string, consumableId: string, q?: Queryable): Promise<OwnedConsumableRow | null>;
  /** Buy grant: insert or bump `quantity` by `amount` (ON CONFLICT +1). */
  addQuantity(characterId: string, consumableId: string, amount: number, q?: Queryable): Promise<void>;
  /**
   * Use: decrement `quantity` by 1 guarded by `quantity > 0`. When the row
   * reaches 0 it is deleted (quantity never negative; a later buy re-inserts).
   * Returns false when the character owns nothing (NOT_OWNED).
   */
  decrementQuantity(characterId: string, consumableId: string, q?: Queryable): Promise<boolean>;
  /** Most recent use of one item (per-item cooldown lookup). */
  findLastUse(characterId: string, consumableId: string, q?: Queryable): Promise<Pick<ConsumableUseRow, "used_at"> | null>;
  /** Uses of ANY item since `since` (rolling 24h global counter). */
  countUsesInWindow(characterId: string, since: Date, q?: Queryable): Promise<number>;
  /** Append one usage log row. */
  insertUse(
    input: { character_id: string; consumable_id: string; restored_amount: number; multiplier: number },
    q?: Queryable,
  ): Promise<ConsumableUseRow>;
}

export function createConsumableRepository(q: Queryable = db): ConsumableRepository {
  return {
    async listCatalog(tx = q) {
      return (await tx("consumables")
        .select()
        .where("is_active", true)
        .orderBy("tier")
        .orderBy("name")) as ConsumableRow[];
    },

    async findById(id, tx = q) {
      const rows = await tx("consumables").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as ConsumableRow) : null;
    },

    async findActiveBySlug(slug, tx = q) {
      const rows = await tx("consumables")
        .select()
        .where("slug", slug)
        .where("is_active", true)
        .limit(1);
      return rows.length ? (rows[0] as ConsumableRow) : null;
    },

    async listOwned(characterId, tx = q) {
      return (await tx("character_consumables")
        .select(
          "character_consumables.*",
          "consumables.slug",
          "consumables.name",
          "consumables.tier",
          "consumables.restore_amount",
          "consumables.cooldown_hours",
          "consumables.is_active",
          "consumables.created_at as consumable_created_at",
        )
        .join("consumables", "character_consumables.consumable_id", "consumables.id")
        .where("character_consumables.character_id", characterId)) as unknown as Array<
        OwnedConsumableRow & ConsumableRow
      >;
    },

    async getOwned(characterId, consumableId, tx = q) {
      const rows = await tx("character_consumables")
        .select()
        .where("character_id", characterId)
        .where("consumable_id", consumableId)
        .limit(1);
      return rows.length ? (rows[0] as OwnedConsumableRow) : null;
    },

    async addQuantity(characterId, consumableId, amount, tx = q) {
      await tx("character_consumables")
        .insert({ character_id: characterId, consumable_id: consumableId, quantity: amount })
        .onConflict(["character_id", "consumable_id"])
        .merge({ quantity: tx.raw("character_consumables.quantity + ?", [amount]) });
    },

    async decrementQuantity(characterId, consumableId, tx = q) {
      const [updated] = await tx("character_consumables")
        .update({ quantity: tx.raw("quantity - 1") })
        .where("character_id", characterId)
        .where("consumable_id", consumableId)
        .where("quantity", ">", 0)
        .returning("quantity");
      if (!updated) return false;

      // Row at 0: delete so inventory stays lean (a later buy re-inserts).
      if (Number(updated.quantity) <= 0) {
        await tx("character_consumables")
          .delete()
          .where("character_id", characterId)
          .where("consumable_id", consumableId)
          .where("quantity", "<=", 0);
      }
      return true;
    },

    async findLastUse(characterId, consumableId, tx = q) {
      const rows = await tx("consumable_uses")
        .select("used_at")
        .where("character_id", characterId)
        .where("consumable_id", consumableId)
        .orderBy("used_at", "desc")
        .limit(1);
      return rows.length ? (rows[0] as Pick<ConsumableUseRow, "used_at">) : null;
    },

    async countUsesInWindow(characterId, since, tx = q) {
      const rows = await tx("consumable_uses")
        .count("* as count")
        .where("character_id", characterId)
        .where("used_at", ">=", since);
      return Number((rows[0] as { count?: string | number } | undefined)?.count ?? 0);
    },

    async insertUse(input, tx = q) {
      const rows = await tx("consumable_uses")
        .insert({
          character_id: input.character_id,
          consumable_id: input.consumable_id,
          restored_amount: input.restored_amount,
          multiplier: input.multiplier.toFixed(2),
        })
        .returning("*");
      return rows[0] as ConsumableUseRow;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const consumableRepository = createConsumableRepository();
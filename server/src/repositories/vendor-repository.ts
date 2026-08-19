import { db, type Queryable } from "../db";
import { AppError } from "../middleware/error-handler";

// Neon Dusk — Vendor repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `vendors`. */
export interface VendorRow {
  id: string;
  name: string;
  type: string;
  district: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

/** Raw row shape for `vendor_inventory`. */
export interface VendorInventoryRow {
  id: string;
  vendor_id: string;
  item_type: string;
  item_id: string;
  price: number;
  stock: number;
}

/** Inventory row joined with cromo definitions (vendor detail view). */
export interface VendorInventoryJoinedRow {
  id: string;
  vendorId: string;
  itemType: string;
  itemId: string;
  price: number;
  stock: number;
  chromeDefinitionId: string | null;
  /** Display name from chrome_definitions when `itemType === "CHROME"`. */
  chromeDefinitionName: string | null;
  humanityCost: number | null;
}

export interface VendorRepository {
  /** Active vendors (id, name, type, district), ordered by name. */
  list(q?: Queryable): Promise<Array<{ id: string; name: string; type: string; district: string }>>;
  /** Full vendor row by id. */
  getById(id: string, q?: Queryable): Promise<VendorRow | null>;
  /** Vendor's inventory joined with cromo definitions (humanity cost). */
  listInventory(vendorId: string, q?: Queryable): Promise<VendorInventoryJoinedRow[]>;
  /** One stock row (vendor + item type + item id). */
  findStockItem(
    vendorId: string,
    itemType: string,
    itemId: string,
    q?: Queryable,
  ): Promise<VendorInventoryRow | null>;
  /**
   * Decrement a limited stock row atomically (relative, guarded against
   * oversell). Throws AppError(400, "OUT_OF_STOCK") when a concurrent buyer
   * drained the remaining stock. Unlimited items are skipped by callers.
   */
  decrementStock(itemId: string, quantity: number, q?: Queryable): Promise<void>;
}

export function createVendorRepository(q: Queryable = db): VendorRepository {
  return {
    async list(tx = q) {
      return tx("vendors")
        .select("id", "name", "type", "district")
        .where("is_active", true)
        .orderBy("name") as Promise<
        Array<{ id: string; name: string; type: string; district: string }>
      >;
    },

    async getById(id, tx = q) {
      const rows = await tx("vendors").select().where("id", id).limit(1);
      return rows.length ? (rows[0] as VendorRow) : null;
    },

    async listInventory(vendorId, tx = q) {
      return (await tx("vendor_inventory")
        .select(
          "vendor_inventory.id",
          "vendor_inventory.vendor_id as vendorId",
          "vendor_inventory.item_type as itemType",
          "vendor_inventory.item_id as itemId",
          "vendor_inventory.price",
          "vendor_inventory.stock",
          "chrome_definitions.id as chromeDefinitionId",
          "chrome_definitions.name as chromeDefinitionName",
          "chrome_definitions.humanity_cost as humanityCost",
        )
        .leftJoin(
          "chrome_definitions",
          function () {
            // ponytail: Knex join condition builder — equivalent to
            // item_type = 'CHROME' AND item_id = chrome_definitions.slug
            this.on("vendor_inventory.item_id", "=", "chrome_definitions.slug")
              .andOn("vendor_inventory.item_type", "=", q.raw("'CHROME'"));
          },
        )
        .where("vendor_inventory.vendor_id", vendorId)) as unknown as VendorInventoryJoinedRow[];
    },

    async findStockItem(vendorId, itemType, itemId, tx = q) {
      const rows = await tx("vendor_inventory")
        .select()
        .where("vendor_id", vendorId)
        .where("item_type", itemType)
        .where("item_id", itemId)
        .limit(1);
      return rows.length ? (rows[0] as VendorInventoryRow) : null;
    },

    async decrementStock(itemId, quantity, tx = q) {
      const [decremented] = await tx("vendor_inventory")
        .update({ stock: tx.raw("stock - ?", [quantity]) })
        .where("id", itemId)
        .where("stock", ">=", quantity)
        .returning("stock");

      if (!decremented) {
        throw new AppError(400, "OUT_OF_STOCK", "Esgotado");
      }
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const vendorRepository = createVendorRepository();

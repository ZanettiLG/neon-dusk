import type { Knex } from "knex";
import { seedVendors } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 02: Vendors + inventory
 * ============================================================================
 * NPC vendors from src/content/vendor-inventories.ts. Idempotent: vendors
 * upsert by fixed UUID (ignore on conflict), inventory upserts by
 * (vendor_id, item_type, item_id).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<{ vendors: number; inventory: number }> {
  return seedVendors(knex);
}

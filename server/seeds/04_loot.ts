import type { Knex } from "knex";
import { seedLoot } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 04: Loot tables
 * ============================================================================
 * Weighted loot tables from src/content/loot-tables.ts. Idempotent: fixed
 * UUIDs, conflict-ignore on re-run.
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<number> {
  return seedLoot(knex);
}

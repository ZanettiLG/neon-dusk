import type { Knex } from "knex";
import { seedConsumables } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 08: Consumables (itens anti-insanidade)
 * ============================================================================
 * Sanity-restoring catalog from src/content/consumables.ts. Idempotent upsert
 * by slug (content drift is corrected on re-run).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<number> {
  return seedConsumables(knex);
}
import type { Knex } from "knex";
import { seedGameParams } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 07: Game params
 * ============================================================================
 * Default tunable game parameters, upserted by key (idempotent).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<void> {
  return seedGameParams(knex);
}

import type { Knex } from "knex";
import { seedRound } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 06: Round 1
 * ============================================================================
 * The first round, active from the moment the world boots. Inserts only when
 * round_number 1 is absent (idempotent — re-runs must not duplicate).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<void> {
  return seedRound(knex);
}

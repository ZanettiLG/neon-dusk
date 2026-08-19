import type { Knex } from "knex";
import { seedLegends } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 05: Legends
 * ============================================================================
 * The 5 founding Legends of the Saideira (permanent hall of fame, once-only
 * lore). Inserts only when the table is empty so player-inducted legends are
 * never duplicated.
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<void> {
  return seedLegends(knex);
}

import type { Knex } from "knex";
import { seedGigs } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 03: Trampos
 * ============================================================================
 * Trampo templates from src/content/gig-templates.ts, upserting by name.
 * cooldown_minutes is derived from tier (T1=10, T2=15, T3=20, T4=25, else 30 —
 * balance pass #114).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<number> {
  return seedGigs(knex);
}

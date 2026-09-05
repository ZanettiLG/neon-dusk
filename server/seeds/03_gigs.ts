import type { Knex } from "knex";
import { seedGigs } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 03: Trampos
 * ============================================================================
 * Trampo templates from src/content/gig-templates.ts, upserting by name.
 * cooldown_seconds is derived from tier (T1=5, T2=60, T3=900, T4=7200, T5=86400 —
 * per-tier progression #187).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 */

export async function seed(knex: Knex): Promise<number> {
  return seedGigs(knex);
}

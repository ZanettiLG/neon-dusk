import type { Knex } from "knex";
import { seedChrome } from "../src/seed/content-seeds";

/**
 * Neon Dusk — Seed 01: Cromo definitions
 * ============================================================================
 * Implant catalog from src/content/chrome-definitions.ts. Idempotent upsert
 * by slug (content drift is corrected on re-run).
 *
 * Run: `npx knex seed:run --knexfile knexfile.ts`
 *
 * NOTE: this directory is CommonJS-scoped (seeds/package.json) so the knex
 * CLI loads these files through its sucrase require hook — extensionless
 * relative imports resolve there, unlike Node's ESM loader.
 */

export async function seed(knex: Knex): Promise<number> {
  return seedChrome(knex);
}

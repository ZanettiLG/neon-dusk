import type { Knex } from "knex";
import { fileURLToPath } from "node:url";

// Neon Dusk — Knex configuration builder
// ============================================================================
// Single source of truth for the Knex client configuration, shared by the
// runtime client (db/index.ts) and the Knex CLI (knexfile.ts). Migration and
// seed directories resolve to ABSOLUTE paths relative to this file, so the
// config is deterministic regardless of the process working directory.
//
// NOTE: this module must NOT import env.ts — the Knex CLI must be able to
// load it in environments where the full env schema (e.g. ADMIN_API_KEY)
// is unavailable (CI test job).

/** Absolute path to server/migrations (this file lives in server/src/db). */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

/** Absolute path to server/seeds (this file lives in server/src/db). */
const SEEDS_DIR = fileURLToPath(new URL("../../seeds", import.meta.url));

/**
 * Build the Knex config for PostgreSQL.
 *
 * @param connection — a pg connection string (DATABASE_URL)
 */
export function buildKnexConfig(connection: string): Knex.Config {
  return {
    client: "pg",
    connection,
    pool: { min: 0, max: 20 },
    acquireConnectionTimeout: 10000,
    migrations: {
      directory: MIGRATIONS_DIR,
      extension: "ts",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: SEEDS_DIR,
      extension: "ts",
    },
  };
}

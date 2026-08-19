import knex from "knex";
import type { Knex } from "knex";
// Must run before any connection is established: registers the BIGINT →
// number parser on the shared pg-types instance (see pg-types.ts).
import "./pg-types";
import { env } from "../env";
import { buildKnexConfig } from "./config";

// Neon Dusk — Database client
// ============================================================================
// Knex.js with PostgreSQL. Config comes from db/config.ts (the same builder
// used by the Knex CLI via knexfile.ts), so migrate/seed and runtime share
// one connection definition. Production code must go through repositories —
// only repositories/* and tests import this module.

export const db = knex(buildKnexConfig(env.DATABASE_URL));

/** Queryable type alias — used for function signatures that accept `db` or a Knex transaction. */
export type Queryable = typeof db | Knex.Transaction;

/**
 * Verify the database connection is alive.
 * Throws on timeout/refusal so the server can hard-fail on startup.
 */
export async function checkConnection(): Promise<void> {
  await db.raw("SELECT 1");
}

/**
 * Graceful shutdown — drain the pool and close all connections.
 * Call during server shutdown (SIGTERM/SIGINT).
 */
export async function closeConnection(): Promise<void> {
  await db.destroy();
}

/**
 * Run `fn` inside one PostgreSQL transaction. The transaction rolls back
 * automatically when `fn` throws.
 */
export async function withTransaction<T>(
  fn: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

/**
 * Bootstrap the database: apply pending migrations, then run the content
 * seeds (both idempotent). Called from server.ts before `app.listen`.
 */
// ponytail: seed.run() on every boot + migrate.latest() without an advisory
// lock — fine for single-instance MVP; if multi-instance deploys appear,
// wrap migrate in a pg advisory lock (pg_advisory_lock) so concurrent boots
// can't race migrations.
// ponytail: legacy FK columns without dedicated indexes — several pre-#158
// tables define FKs but no index on the FK column (e.g. heat.character_id,
// audit_log.character_id, pvp_combats.attacker_id, gig_history.gig_id).
// Postgres does not auto-index FKs, so cascade deletes and reverse lookups
// may seq-scan. A follow-up migration should add idx_<table>_<fk> indexes if
// pg_stat_statements shows those queries as slow.
export async function initDb(): Promise<void> {
  await db.migrate.latest();
  await db.seed.run();
}

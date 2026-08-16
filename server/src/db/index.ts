import knex from "knex";
import type { Knex } from "knex";
// Must run before any connection is established: registers the BIGINT →
// number parser on the shared pg-types instance (see pg-types.ts).
import "./pg-types";
import { env } from "../env";

/**
 * Neon Dusk database client — Knex.js with PostgreSQL.
 *
 * Config mirrors `knexfile.ts` so the Knex CLI (migrate/seed) and runtime
 * use the same connection settings.
 */
export const db = knex({
  client: "pg",
  connection: env.DATABASE_URL,
  pool: { min: 0, max: 20 },
  acquireConnectionTimeout: 10000,
});

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

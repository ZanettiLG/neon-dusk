import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0034: admin panel economy (ND-052)
 * ============================================================================
 * Composite index (created_at, type) on transaction_log — backs the round
 * inflation queries (faucets/sinks summed per type over the round window)
 * and the transaction viewer's type filter.
 *
 * GIG_BASE_REWARD is NOT seeded here: the canonical seed lives in
 * seed/content-seeds.ts (DEFAULT_PARAMS, idempotent upsert) — see review
 * cycle 3 (ND-052) which removed the duplicate.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "idx_transaction_log_created_type" ON "transaction_log" ("created_at", "type")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_transaction_log_created_type"`);
}

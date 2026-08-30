import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0034: admin panel economy (ND-052)
 * ============================================================================
 * Two pieces of the admin economy dashboard:
 * 1. Composite index (created_at, type) on transaction_log — backs the round
 *    inflation queries (faucets/sinks summed per type over the round window)
 *    and the transaction viewer's type filter.
 * 2. Seeds the GIG_BASE_REWARD game param (global floor for trampo payout
 *    bases, fallback 100 in code). Idempotent: ON CONFLICT DO NOTHING.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "idx_transaction_log_created_type" ON "transaction_log" ("created_at", "type")`,
  );

  await knex.raw(`
    INSERT INTO game_params (key, value, updated_at)
    VALUES ('GIG_BASE_REWARD', '100', NOW())
    ON CONFLICT (key) DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_transaction_log_created_type"`);
  await knex.raw(`DELETE FROM game_params WHERE key = 'GIG_BASE_REWARD'`);
}

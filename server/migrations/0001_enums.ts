import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0001: Enums
 * ============================================================================
 * All 14 PostgreSQL enum types used across the schema. Split out of the
 * consolidated 0001_initial_schema migration (#158 DB repository layer).
 *
 * Run: `npx knex migrate:latest --knexfile knexfile.ts`
 * Rollback: `npx knex migrate:rollback --knexfile knexfile.ts`
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE "role" AS ENUM('solo', 'netrunner', 'tech', 'fixer', 'nomad')`);
  await knex.raw(
    `CREATE TYPE "origin" AS ENUM('a_paraiso', 'o_fervo', 'o_fluxo', 'a_quebrada', 'babilonia', 'as_mortas', 'o_ponto')`,
  );
  await knex.raw(`CREATE TYPE "user_role" AS ENUM('player', 'admin')`);
  await knex.raw(
    `CREATE TYPE "transaction_type" AS ENUM('GIG_PAYOUT', 'VENDOR_PURCHASE', 'PVP_REWARD', 'PVP_LOSS', 'STIM_PURCHASE', 'CREW_BONUS', 'ADMIN_ADJUSTMENT', 'CHROME_PURCHASE', 'CHROME_UNINSTALL', 'STREET_CRED_AWARD', 'CREW_CREATION')`,
  );
  await knex.raw(
    `CREATE TYPE "vendor_type" AS ENUM('RIPPERDOC', 'STIM_DEALER', 'FIXER', 'BLACK_MARKET')`,
  );
  await knex.raw(
    `CREATE TYPE "game_event_type" AS ENUM('CHARACTER_CREATED', 'GIG_STARTED', 'GIG_COMPLETED', 'GIG_FAILED', 'PVP_ATTACK', 'PVP_DEFEAT', 'EDDIES_EARNED', 'EDDIES_SPENT', 'NIL_SPENT', 'NIL_RESTORED', 'VENDOR_PURCHASE', 'ABILITY_ACTIVATED', 'ABILITY_CONSUMED')`,
  );
  await knex.raw(`CREATE TYPE "gig_type" AS ENUM('extraction', 'delivery', 'sabotage')`);
  await knex.raw(`CREATE TYPE "gig_tier" AS ENUM('t1', 't2', 't3', 't4', 't5')`);
  await knex.raw(
    `CREATE TYPE "gig_phase" AS ENUM('meet', 'legwork', 'execute', 'escape', 'wrap_up')`,
  );
  await knex.raw(`CREATE TYPE "gig_outcome" AS ENUM('success', 'failure')`);
  await knex.raw(
    `CREATE TYPE "history_outcome" AS ENUM('success', 'failure', 'abandoned')`,
  );
  await knex.raw(
    `CREATE TYPE "chrome_slot" AS ENUM('frontal_cortex', 'ocular', 'arms', 'skeleton', 'nervous_system', 'integumentary')`,
  );
  await knex.raw(`CREATE TYPE "round_status" AS ENUM('active', 'ended')`);
  await knex.raw(
    `CREATE TYPE "audit_result" AS ENUM('allowed', 'blocked', 'rate_limited', 'validation_error', 'circuit_break', 'cooldown_active', 'server_error')`,
  );
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse creation order (tables referencing them are dropped
  // first during a full rollback; IF EXISTS keeps partial rollbacks safe).
  const enums = [
    "audit_result",
    "round_status",
    "chrome_slot",
    "history_outcome",
    "gig_outcome",
    "gig_phase",
    "gig_tier",
    "gig_type",
    "game_event_type",
    "vendor_type",
    "transaction_type",
    "user_role",
    "origin",
    "role",
  ];

  for (const enumName of enums) {
    await knex.raw(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
  }
}

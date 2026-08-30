import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0028: chrome_slot enum → 9 slots
 * ============================================================================
 * Adds the three missing body slots from 04-sistemas-e-progressao.md §3:
 * `operating_system` (OS — 1 implant), `circulatory` (3), `legs` (1).
 * `skeleton` already existed in both the PG enum and shared CHROME_SLOTS.
 *
 * NOTE: PostgreSQL enums cannot remove values. The `down` migration is
 * intentionally a no-op placeholder — a full rollback of this migration is
 * irreversible once any row uses the new values (documented ADR).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TYPE "chrome_slot" ADD VALUE IF NOT EXISTS 'operating_system'`,
  );
  await knex.raw(`ALTER TYPE "chrome_slot" ADD VALUE IF NOT EXISTS 'circulatory'`);
  await knex.raw(`ALTER TYPE "chrome_slot" ADD VALUE IF NOT EXISTS 'legs'`);
}

export async function down(knex: Knex): Promise<void> {
  // Irreversible: PostgreSQL has no ALTER TYPE ... DROP VALUE. A rollback to
  // the 6-slot enum requires a full enum rebuild (create new type, cast
  // columns, drop old) and fails whenever any row uses the new values.
  // No-op keeps `migrate:rollback` from silently corrupting data.
}
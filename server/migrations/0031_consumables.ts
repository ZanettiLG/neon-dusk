import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0031: consumables catalog
 * ============================================================================
 * Issue #28 (Cromo incompleto) — itens anti-insanidade (design delta).
 * Catalog of sanity-restoring consumables (ADR 28-C: preço vive em
 * vendor_inventory, efeito vive aqui). `characters.flatlined_at` is NOT
 * re-added — migration 0029 already owns the flatline columns.
 *
 * Also extends `game_event_type` with the new telemetry events:
 *  - HUMANITY_RESTORED (consumable use — design delta spec)
 *  - OS_ACTIVATED      (OS activation — original design)
 *  - THERAPY_COMPLETED (therapy session — original design)
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("consumables", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.integer("tier").notNullable();
    table.integer("restore_amount").notNullable();
    table.integer("cooldown_hours").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "consumables" ADD CONSTRAINT "consumables_tier_range" CHECK ("tier" between 1 and 3)`,
  );
  await knex.raw(
    `ALTER TABLE "consumables" ADD CONSTRAINT "consumables_restore_positive" CHECK ("restore_amount" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "consumables" ADD CONSTRAINT "consumables_cooldown_non_negative" CHECK ("cooldown_hours" >= 0)`,
  );

  await knex.raw(
    `ALTER TYPE "game_event_type" ADD VALUE IF NOT EXISTS 'HUMANITY_RESTORED'`,
  );
  await knex.raw(`ALTER TYPE "game_event_type" ADD VALUE IF NOT EXISTS 'OS_ACTIVATED'`);
  await knex.raw(
    `ALTER TYPE "game_event_type" ADD VALUE IF NOT EXISTS 'THERAPY_COMPLETED'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "consumables" CASCADE`);
  // game_event_type: ADD VALUE is irreversible (see 0028 note) — no-op.
}
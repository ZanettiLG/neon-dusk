import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0029: character OS + humanity columns
 * ============================================================================
 * Issue #28 (Cromo incompleto). ADR: the OS is a chrome_definition installed
 * in the `operating_system` slot; its activation state lives in dedicated
 * columns on `characters` (no separate table — pattern of role abilities).
 *
 * Columns added:
 *  - os_ability_id            — chrome_definitions.id of the installed OS
 *  - os_ability_active_until  — when the current OS activation expires
 *  - os_ability_uses_today    — daily-charge counter (Fúria 3x/dia, Surto 5x/dia)
 *  - os_ability_used_date     — UTC midnight of the last use day (daily reset)
 *  - is_flatlined             — 0 humanity → permanent loss (enforcement flag 1)
 *  - flatlined_at             — when the flatline happened
 *  - humanity_updated_at      — last humanity write (drives scrubber lazy regen)
 *
 * The OS slug is resolved at runtime through chrome_definitions; the FK keeps
 * the column consistent when a definition is deactivated.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("characters", (table) => {
    table
      .uuid("os_ability_id")
      .references("id")
      .inTable("chrome_definitions")
      .onDelete("set null");
    table.specificType("os_ability_active_until", "timestamptz");
    table.integer("os_ability_uses_today").notNullable().defaultTo(0);
    table.specificType("os_ability_used_date", "timestamptz");
    table.boolean("is_flatlined").notNullable().defaultTo(false);
    table.specificType("flatlined_at", "timestamptz");
    table.specificType("humanity_updated_at", "timestamptz").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_os_uses_non_negative" CHECK ("os_ability_uses_today" >= 0)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_characters_os_ability_id" ON "characters" ("os_ability_id") WHERE "os_ability_id" IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX "idx_characters_flatlined" ON "characters" ("is_flatlined") WHERE "is_flatlined" = true`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_characters_flatlined"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_characters_os_ability_id"`);
  await knex.schema.alterTable("characters", (table) => {
    table.dropColumn("os_ability_id");
    table.dropColumn("os_ability_active_until");
    table.dropColumn("os_ability_uses_today");
    table.dropColumn("os_ability_used_date");
    table.dropColumn("is_flatlined");
    table.dropColumn("flatlined_at");
    table.dropColumn("humanity_updated_at");
  });
}
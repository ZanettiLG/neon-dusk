import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0033: consumable_uses (log)
 * ============================================================================
 * Issue #28 — append-only usage log. Drives BOTH the rolling 24h diminishing
 * returns counter (all items share it — ADR 28-B) and the per-item cooldown
 * (T2 12h, T3 24h, T1 none — ADR 28-D: no denormalized cooldown column).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("consumable_uses", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("consumable_id")
      .notNullable()
      .references("id")
      .inTable("consumables")
      .onDelete("restrict");
    table.integer("restored_amount").notNullable();
    table.specificType("multiplier", "decimal(3,2)").notNullable();
    table.specificType("used_at", "timestamptz").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  // Rolling 24h window + per-item cooldown lookups.
  await knex.raw(
    `CREATE INDEX "idx_consumable_uses_character_used" ON "consumable_uses" ("character_id", "used_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_consumable_uses_character_consumable_used" ON "consumable_uses" ("character_id", "consumable_id", "used_at" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_consumable_uses_character_consumable_used"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_consumable_uses_character_used"`);
  await knex.raw(`DROP TABLE IF EXISTS "consumable_uses" CASCADE`);
}
import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0032: character_consumables (inventário)
 * ============================================================================
 * Issue #28 — per-character consumable inventory. Buying increments
 * `quantity` (ON CONFLICT DO UPDATE +1), using decrements (never negative,
 * CHECK constraint is the last line of defense). Inventory is per-round:
 * the reset wipes this table.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("character_consumables", (table) => {
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
    table.integer("quantity").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "character_consumables" ADD CONSTRAINT "character_consumables_quantity_non_negative" CHECK ("quantity" >= 0)`,
  );
  await knex.raw(
    `CREATE UNIQUE INDEX "character_consumables_character_consumable_unique" ON "character_consumables" ("character_id", "consumable_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_character_consumables_character_id" ON "character_consumables" ("character_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_character_consumables_character_id"`);
  await knex.raw(`DROP INDEX IF EXISTS "character_consumables_character_consumable_unique"`);
  await knex.raw(`DROP TABLE IF EXISTS "character_consumables" CASCADE`);
}
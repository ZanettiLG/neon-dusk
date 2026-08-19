import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0009: loot_tables
 * ============================================================================
 * Weighted loot tables for gig rewards. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("loot_tables", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("gig_tier").notNullable();
    table.text("item_type").notNullable();
    table.text("item_id").notNullable();
    table.specificType("weight", "real").notNullable();
    table.integer("min_quantity").notNullable().defaultTo(1);
    table.integer("max_quantity").notNullable().defaultTo(1);
  });

  await knex.raw(
    `ALTER TABLE "loot_tables" ADD CONSTRAINT "loot_tables_weight_positive" CHECK ("weight" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "loot_tables" ADD CONSTRAINT "loot_tables_quantity_range" CHECK ("min_quantity" >= 1 AND "max_quantity" >= "min_quantity")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "loot_tables" CASCADE`);
}

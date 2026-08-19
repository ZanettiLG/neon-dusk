import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0018: legends
 * ============================================================================
 * Permanent hall of fame (Saideira drink menu). Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("legends", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("character_name").notNullable();
    table.text("drink_name").notNullable();
    table
      .specificType("achieved_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.text("crew_name");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "legends" CASCADE`);
}

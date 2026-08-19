import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0025: game_params
 * ============================================================================
 * Tunable game parameters (key/value). Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("game_params", (table) => {
    table.text("key").primary();
    table.text("value").notNullable();
    table.uuid("updated_by").references("id").inTable("users").onDelete("set null");
    table
      .specificType("updated_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "game_params" CASCADE`);
}

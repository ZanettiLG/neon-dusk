import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0002: health
 * ============================================================================
 * Health probe table. Split out of the consolidated 0001_initial_schema
 * migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("health", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.timestamp("checked_at").defaultTo(knex.fn.now()).notNullable();
    table.boolean("healthy").defaultTo(true).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "health" CASCADE`);
}

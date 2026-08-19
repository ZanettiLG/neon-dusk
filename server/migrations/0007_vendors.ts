import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0007: vendors
 * ============================================================================
 * NPC vendors. Split out of the consolidated 0001_initial_schema migration
 * (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("vendors", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable();
    table.specificType("type", "public.vendor_type").notNullable();
    table.text("district").notNullable();
    table.text("description");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "vendors" CASCADE`);
}

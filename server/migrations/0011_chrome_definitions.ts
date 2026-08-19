import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0011: chrome_definitions
 * ============================================================================
 * Implant catalog. Split out of the consolidated 0001_initial_schema
 * migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("chrome_definitions", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("slug").notNullable().unique();
    table.text("name").notNullable();
    table.specificType("slot", "public.chrome_slot").notNullable();
    table.integer("tier").notNullable();
    table
      .jsonb("bonuses")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table.integer("humanity_cost").notNullable();
    table.bigint("base_price").notNullable();
    table.text("description");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_tier_range" CHECK ("tier" between 1 and 5)`,
  );
  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_humanity_cost_positive" CHECK ("humanity_cost" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "chrome_definitions" ADD CONSTRAINT "chrome_definitions_base_price_positive" CHECK ("base_price" > 0)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "chrome_definitions" CASCADE`);
}

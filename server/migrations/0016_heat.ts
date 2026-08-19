import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0016: heat
 * ============================================================================
 * Per-character district heat. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("heat", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.text("district").notNullable();
    table.integer("amount").notNullable().defaultTo(0);
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "heat" ADD CONSTRAINT "heat_amount_non_negative" CHECK ("amount" >= 0)`,
  );

  await knex.raw(
    `CREATE UNIQUE INDEX "heat_character_district" ON "heat" ("character_id", "district")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_heat_character" ON "heat" ("character_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_heat_character"`);
  await knex.raw(`DROP INDEX IF EXISTS "heat_character_district"`);
  await knex.raw(`DROP TABLE IF EXISTS "heat" CASCADE`);
}

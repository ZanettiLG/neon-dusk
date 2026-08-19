import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0012: installed_chrome
 * ============================================================================
 * Per-character implants. Split out of the consolidated 0001_initial_schema
 * migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("installed_chrome", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("chrome_definition_id")
      .notNullable()
      .references("id")
      .inTable("chrome_definitions")
      .onDelete("restrict");
    table.timestamp("installed_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `CREATE UNIQUE INDEX "installed_chrome_character_definition_unique" ON "installed_chrome" ("character_id", "chrome_definition_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_installed_chrome_character_id" ON "installed_chrome" ("character_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_installed_chrome_character_id"`);
  await knex.raw(`DROP INDEX IF EXISTS "installed_chrome_character_definition_unique"`);
  await knex.raw(`DROP TABLE IF EXISTS "installed_chrome" CASCADE`);
}

import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0019: crews
 * ============================================================================
 * Crews table + the circular FK back on characters.crew_id (requires crews to
 * exist first). Split out of the consolidated 0001_initial_schema migration
 * (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("crews", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable().unique();
    table.text("tag").notNullable().unique();
    table
      .uuid("leader_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  await knex.raw(
    `ALTER TABLE "crews" ADD CONSTRAINT "crews_name_length" CHECK (char_length("name") BETWEEN 3 AND 20)`,
  );
  await knex.raw(
    `ALTER TABLE "crews" ADD CONSTRAINT "crews_tag_format" CHECK ("tag" ~ '^[A-Z0-9]{3}$')`,
  );

  // --- characters.crew_id (circular FK — requires crews to exist) --------------
  await knex.schema.alterTable("characters", (table) => {
    table
      .uuid("crew_id")
      .references("id")
      .inTable("crews")
      .onDelete("set null");
  });

  await knex.raw(
    `CREATE INDEX "idx_characters_crew_id" ON "characters" ("crew_id") WHERE "crew_id" IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_characters_crew_id"`);
  await knex.raw(
    `ALTER TABLE IF EXISTS "characters" DROP COLUMN IF EXISTS "crew_id"`,
  );
  await knex.raw(`DROP TABLE IF EXISTS "crews" CASCADE`);
}

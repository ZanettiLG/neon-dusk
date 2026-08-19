import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0021: crew_invites
 * ============================================================================
 * Pending crew invitations (24h expiry). Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("crew_invites", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("crew_id")
      .notNullable()
      .references("id")
      .inTable("crews")
      .onDelete("cascade");
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("invited_by")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.specificType("expires_at", "timestamptz").notNullable();
  });

  await knex.raw(
    `CREATE UNIQUE INDEX "crew_invites_crew_character_unique" ON "crew_invites" ("crew_id", "character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_crew_invites_character_id" ON "crew_invites" ("character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_crew_invites_crew_id" ON "crew_invites" ("crew_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_crew_invites_crew_id"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_crew_invites_character_id"`);
  await knex.raw(`DROP INDEX IF EXISTS "crew_invites_crew_character_unique"`);
  await knex.raw(`DROP TABLE IF EXISTS "crew_invites" CASCADE`);
}

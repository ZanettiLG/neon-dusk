import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0014: active_gigs
 * ============================================================================
 * In-flight gig state (one per character). Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("active_gigs", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("gig_id")
      .notNullable()
      .references("id")
      .inTable("gigs")
      .onDelete("restrict");
    table.specificType("phase", "public.gig_phase").notNullable().defaultTo("meet");
    table.text("status").notNullable().defaultTo("active");
    table.timestamp("accepted_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("legwork_started_at");
    table.boolean("legwork_completed").notNullable().defaultTo(false);
    table.specificType("execute_outcome", "public.gig_outcome");
    table.specificType("escape_outcome", "public.gig_outcome");
    table.integer("actual_payout");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `CREATE INDEX "idx_active_gigs_character" ON "active_gigs" ("character_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_active_gigs_character"`);
  await knex.raw(`DROP TABLE IF EXISTS "active_gigs" CASCADE`);
}

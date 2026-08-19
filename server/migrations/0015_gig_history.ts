import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0015: gig_history
 * ============================================================================
 * Completed/abandoned gig records. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("gig_history", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("gig_id")
      .notNullable()
      .references("id")
      .inTable("gigs")
      .onDelete("restrict");
    table.specificType("outcome", "public.history_outcome").notNullable();
    table.specificType("phases_completed", "text[]").notNullable();
    table.integer("payout").notNullable().defaultTo(0);
    table.integer("street_cred_gained").notNullable().defaultTo(0);
    table.integer("heat_accumulated").notNullable().defaultTo(0);
    table.text("district").notNullable();
    table.timestamp("completed_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `CREATE INDEX "idx_gig_history_character" ON "gig_history" ("character_id", "completed_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_gig_history_completed_at" ON "gig_history" ("completed_at")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_gig_history_completed_at"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_gig_history_character"`);
  await knex.raw(`DROP TABLE IF EXISTS "gig_history" CASCADE`);
}

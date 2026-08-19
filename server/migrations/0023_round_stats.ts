import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0023: round_stats
 * ============================================================================
 * Per-round end-of-round statistics snapshot. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("round_stats", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("round_id")
      .notNullable()
      .references("id")
      .inTable("rounds")
      .onDelete("cascade");
    table.integer("total_gigs_completed").notNullable().defaultTo(0);
    table.bigint("total_eddies_earned").notNullable().defaultTo(0);
    table.integer("total_pvp_fights").notNullable().defaultTo(0);
    table.integer("total_active_characters").notNullable().defaultTo(0);
    table.uuid("top_crew_id");
    table.text("top_crew_name");
    table.uuid("top_sc_character_id");
    table.text("top_sc_character_name");
    table.integer("top_sc_value");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  await knex.raw(
    `CREATE INDEX "idx_round_stats_round_id" ON "round_stats" ("round_id")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_round_stats_round_id"`);
  await knex.raw(`DROP TABLE IF EXISTS "round_stats" CASCADE`);
}

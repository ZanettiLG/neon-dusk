import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0022: rounds
 * ============================================================================
 * Round lifecycle. Split out of the consolidated 0001_initial_schema
 * migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("rounds", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.integer("round_number").notNullable().unique();
    table
      .specificType("started_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
    table.specificType("ended_at", "timestamptz");
    table
      .specificType("status", "public.round_status")
      .notNullable()
      .defaultTo("active");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  await knex.raw(`CREATE INDEX "idx_rounds_status" ON "rounds" ("status")`);
  await knex.raw(
    `CREATE UNIQUE INDEX "idx_rounds_active" ON "rounds" ("status") WHERE "status" = 'active'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_rounds_active"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_rounds_status"`);
  await knex.raw(`DROP TABLE IF EXISTS "rounds" CASCADE`);
}

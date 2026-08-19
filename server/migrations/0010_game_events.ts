import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0010: game_events
 * ============================================================================
 * Append-only telemetry event store. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("game_events", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.specificType("event_type", "public.game_event_type").notNullable();
    table.uuid("actor_id"); // FK-less — never blocks deletion
    table
      .jsonb("payload")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `CREATE INDEX "idx_game_events_type_created_at" ON "game_events" ("event_type", "created_at" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_game_events_type_created_at"`);
  await knex.raw(`DROP TABLE IF EXISTS "game_events" CASCADE`);
}

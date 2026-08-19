import type { Knex } from "knex";

/**
 * Neon Dusk — game_events actor index (ND-139)
 * ============================================================================
 * Composite index backing GET /api/characters/me/events: filter by actor_id
 * ordered by created_at DESC for cursor pagination. The initial schema indexed
 * (event_type, created_at) for the admin digest; player feeds need this actor
 * ordering instead.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX "idx_game_events_actor_created_at" ON "game_events" ("actor_id", "created_at" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_game_events_actor_created_at"`);
}

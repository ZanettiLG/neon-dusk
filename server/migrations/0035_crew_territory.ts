import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0035: crew territory
 * ============================================================================
 * One crew per district claim (issue #18 — mapa do metrô). `crews` gains a
 * nullable `territory_district` (public.origin); the partial unique index
 * guarantees at most one crew per district while letting any number of crews
 * stay unclaimed. Claimed at crew creation from the leader's origin; freed
 * when the crew dissolves.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("crews", (table) => {
    table.specificType("territory_district", "public.origin");
  });

  await knex.raw(
    `CREATE UNIQUE INDEX "idx_crews_territory_district" ON "crews" ("territory_district") WHERE "territory_district" IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_crews_territory_district"`);
  await knex.schema.alterTable("crews", (table) => {
    table.dropColumn("territory_district");
  });
}

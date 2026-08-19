import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0017: pvp_combats
 * ============================================================================
 * Append-only PvP fight records. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("pvp_combats", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("attacker_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table
      .uuid("defender_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.integer("attacker_power").notNullable();
    table.integer("defender_power").notNullable();
    table.uuid("winner_id").notNullable();
    table.integer("loot_amount").notNullable().defaultTo(0);
    table.boolean("griefer_penalty").notNullable().defaultTo(false);
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  await knex.raw(
    `ALTER TABLE "pvp_combats" ADD CONSTRAINT "pvp_combats_loot_amount_non_negative" CHECK ("loot_amount" >= 0)`,
  );

  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_attacker" ON "pvp_combats" ("attacker_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_defender" ON "pvp_combats" ("defender_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_pvp_combats_attacker_defender" ON "pvp_combats" ("attacker_id", "defender_id", "created_at" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_pvp_combats_attacker_defender"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_pvp_combats_defender"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_pvp_combats_attacker"`);
  await knex.raw(`DROP TABLE IF EXISTS "pvp_combats" CASCADE`);
}

import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0013: gigs
 * ============================================================================
 * Gig templates (the Fixer Cupim board). Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("gigs", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("name").notNullable().unique();
    table.text("description").notNullable();
    table.specificType("tier", "public.gig_tier").notNullable();
    table.specificType("type", "public.gig_type").notNullable();
    table.text("district").notNullable();
    table.integer("difficulty").notNullable();
    table.integer("escape_difficulty").notNullable().defaultTo(40);
    table.jsonb("required_stats").notNullable();
    table.integer("required_street_cred").notNullable().defaultTo(0);
    table.integer("base_reward").notNullable();
    table.integer("nil_cost").notNullable();
    table.integer("heat_generated").notNullable().defaultTo(5);
    table.integer("legwork_minutes").notNullable();
    table.integer("cooldown_minutes").notNullable().defaultTo(10);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_difficulty_range" CHECK ("difficulty" BETWEEN 1 AND 100)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_escape_difficulty_range" CHECK ("escape_difficulty" BETWEEN 1 AND 100)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_base_reward_positive" CHECK ("base_reward" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_nil_cost_positive" CHECK ("nil_cost" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_heat_positive" CHECK ("heat_generated" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_legwork_minutes_range" CHECK ("legwork_minutes" BETWEEN 5 AND 30)`,
  );
  await knex.raw(
    `ALTER TABLE "gigs" ADD CONSTRAINT "gigs_sc_non_negative" CHECK ("required_street_cred" >= 0)`,
  );

  await knex.raw(`CREATE INDEX "idx_gigs_tier" ON "gigs" ("tier")`);
  await knex.raw(`CREATE INDEX "idx_gigs_type" ON "gigs" ("type")`);
  await knex.raw(`CREATE INDEX "idx_gigs_district" ON "gigs" ("district")`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_gigs_district"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_gigs_type"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_gigs_tier"`);
  await knex.raw(`DROP TABLE IF EXISTS "gigs" CASCADE`);
}

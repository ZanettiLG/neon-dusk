import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0004: characters
 * ============================================================================
 * Player characters (crew_id is added later in 0019_crews — circular FK).
 * Split out of the consolidated 0001_initial_schema migration
 * (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("characters", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("user_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("users")
      .onDelete("cascade");
    table.text("name").notNullable();
    table.specificType("origin", "public.origin").notNullable();
    table.specificType("role", "public.role").notNullable();
    table.integer("body").notNullable().defaultTo(3);
    table.integer("reflexes").notNullable().defaultTo(3);
    table.integer("intelligence").notNullable().defaultTo(3);
    table.integer("technical").notNullable().defaultTo(3);
    table.integer("cool").notNullable().defaultTo(3);
    table.integer("street_cred").notNullable().defaultTo(0);
    table.integer("max_street_cred_achieved").notNullable().defaultTo(0);
    table
      .specificType("last_activity_at", "timestamptz")
      .notNullable()
      .defaultTo(knex.fn.now());
    table.integer("nil").notNullable().defaultTo(100);
    table.integer("max_nil").notNullable().defaultTo(100);
    table.timestamp("nil_updated_at").notNullable().defaultTo(knex.fn.now());
    table.integer("humanity").notNullable().defaultTo(100);
    table.boolean("is_banned").notNullable().defaultTo(false);
    table.specificType("ability_active_until", "timestamptz");
    table.specificType("ability_cooldown_until", "timestamptz");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  // ── CHECK constraints ────────────────────────────────────────────────────
  for (const attr of ["body", "reflexes", "intelligence", "technical", "cool"]) {
    await knex.raw(
      `ALTER TABLE "characters" ADD CONSTRAINT "characters_${attr}_range" CHECK ("${attr}" between 1 and 20)`,
    );
  }
  // NOTE: characters_attrs_total (=22) is deliberately NOT included (ADR-1:
  // post-reset attributes return to base 3 each = sum 15).

  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_nil_range" CHECK ("nil" >= 0 and "nil" <= "max_nil")`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_max_nil_positive" CHECK ("max_nil" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_humanity_range" CHECK ("humanity" >= 0 and "humanity" <= 100)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_street_cred_range" CHECK ("street_cred" >= 0 AND "street_cred" <= 100)`,
  );
  await knex.raw(
    `ALTER TABLE "characters" ADD CONSTRAINT "characters_max_street_cred_range" CHECK ("max_street_cred_achieved" >= 0 AND "max_street_cred_achieved" <= 100)`,
  );

  // ── Indexes ──────────────────────────────────────────────────────────────
  await knex.raw(
    `CREATE UNIQUE INDEX "characters_name_lower_idx" ON "characters" (lower("name"))`,
  );
  await knex.raw(
    `CREATE INDEX "idx_characters_street_cred_desc" ON "characters" ("street_cred" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_characters_is_banned" ON "characters" ("is_banned") WHERE "is_banned" = true`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_characters_is_banned"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_characters_street_cred_desc"`);
  await knex.raw(`DROP INDEX IF EXISTS "characters_name_lower_idx"`);
  await knex.raw(`DROP TABLE IF EXISTS "characters" CASCADE`);
}

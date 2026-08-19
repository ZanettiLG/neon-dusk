import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0005: character_wallets
 * ============================================================================
 * Eddie wallets with optimistic-locking version column. Split out of the
 * consolidated 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("character_wallets", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.bigint("balance").notNullable().defaultTo(0);
    table.bigint("escrow").notNullable().defaultTo(0);
    table.bigint("lifetime_earned").notNullable().defaultTo(0);
    table.bigint("lifetime_spent").notNullable().defaultTo(0);
    table.integer("version").notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_balance_non_negative" CHECK ("balance" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_escrow_non_negative" CHECK ("escrow" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_escrow_lte_balance" CHECK ("escrow" <= "balance")`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_lifetime_earned_non_negative" CHECK ("lifetime_earned" >= 0)`,
  );
  await knex.raw(
    `ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_lifetime_spent_non_negative" CHECK ("lifetime_spent" >= 0)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS "character_wallets" CASCADE`);
}

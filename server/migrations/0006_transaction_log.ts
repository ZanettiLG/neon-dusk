import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0006: transaction_log
 * ============================================================================
 * Append-only economy audit trail. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("transaction_log", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.specificType("type", "public.transaction_type").notNullable();
    table.bigint("amount").notNullable();
    table.bigint("balance_before").notNullable();
    table.bigint("balance_after").notNullable();
    table.text("source").notNullable();
    table.text("reference_type");
    table.uuid("reference_id");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_balance_check" CHECK ("balance_after" - "balance_before" = "amount")`,
  );

  await knex.raw(
    `CREATE INDEX "idx_transaction_log_character_id" ON "transaction_log" ("character_id", "created_at" DESC)`,
  );
  await knex.raw(
    `CREATE INDEX "idx_transaction_log_type" ON "transaction_log" ("type")`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_transaction_log_type"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_transaction_log_character_id"`);
  await knex.raw(`DROP TABLE IF EXISTS "transaction_log" CASCADE`);
}

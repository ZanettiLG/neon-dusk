import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0024: audit_log
 * ============================================================================
 * Fire-and-forget action audit trail. Split out of the consolidated
 * 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("audit_log", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .references("id")
      .inTable("characters")
      .onDelete("set null");
    table.text("action").notNullable();
    table.text("ip").notNullable();
    table.text("user_agent").notNullable();
    table
      .jsonb("payload")
      .notNullable()
      .defaultTo(knex.raw("'{}'::jsonb"));
    table
      .specificType("result", "public.audit_result")
      .notNullable()
      .defaultTo("allowed");
    table
      .specificType("created_at", "timestamptz")
      .defaultTo(knex.fn.now())
      .notNullable();
  });

  await knex.raw(
    `CREATE INDEX "idx_audit_log_character" ON "audit_log" ("character_id")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_action" ON "audit_log" ("action")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_result" ON "audit_log" ("result")`,
  );
  await knex.raw(
    `CREATE INDEX "idx_audit_log_created" ON "audit_log" ("created_at" DESC)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_audit_log_created"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_audit_log_result"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_audit_log_action"`);
  await knex.raw(`DROP INDEX IF EXISTS "idx_audit_log_character"`);
  await knex.raw(`DROP TABLE IF EXISTS "audit_log" CASCADE`);
}

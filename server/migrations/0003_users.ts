import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0003: users
 * ============================================================================
 * Accounts table + case-insensitive unique email index. Split out of the
 * consolidated 0001_initial_schema migration (#158 DB repository layer).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table.text("email").notNullable();
    table.text("password_hash").notNullable();
    table.specificType("role", "public.user_role").notNullable().defaultTo("player");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" (lower("email"))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "users_email_lower_idx"`);
  await knex.raw(`DROP TABLE IF EXISTS "users" CASCADE`);
}

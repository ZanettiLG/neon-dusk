import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0030: therapy_sessions
 * ============================================================================
 * Issue #28 (Cromo incompleto) — terapia (04-sistemas-e-progressao.md §4).
 * One row per therapy session: clínica (G$ 5k–20k, restaura 10–20) or
 * sintonia (G$ 2.5k–10k, restaura 5–10), shared 24h cooldown derived from
 * the last `completed_at` (no denormalized cooldown column — same pattern as
 * consumable_uses). Also adds the `THERAPY_PAYMENT` transaction type so the
 * sink shows up in economy dashboards instead of polluting VENDOR_PURCHASE.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE "therapy_type" AS ENUM('clinic', 'attunement')`);

  await knex.schema.createTable("therapy_sessions", (table) => {
    table.uuid("id").defaultTo(knex.raw("gen_random_uuid()")).primary();
    table
      .uuid("character_id")
      .notNullable()
      .references("id")
      .inTable("characters")
      .onDelete("cascade");
    table.specificType("therapy_type", "public.therapy_type").notNullable();
    table.bigint("cost").notNullable();
    table.integer("restored").notNullable();
    table.integer("humanity_before").notNullable();
    table.integer("humanity_after").notNullable();
    table.specificType("completed_at", "timestamptz").notNullable().defaultTo(knex.fn.now());
    table.specificType("created_at", "timestamptz").defaultTo(knex.fn.now()).notNullable();
  });

  await knex.raw(
    `ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_cost_positive" CHECK ("cost" > 0)`,
  );
  await knex.raw(
    `ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_restored_positive" CHECK ("restored" > 0)`,
  );
  // Cooldown lookup: last session per character (24h shared cooldown).
  await knex.raw(
    `CREATE INDEX "idx_therapy_sessions_character_completed" ON "therapy_sessions" ("character_id", "completed_at" DESC)`,
  );

  await knex.raw(
    `ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'THERAPY_PAYMENT'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS "idx_therapy_sessions_character_completed"`);
  await knex.raw(`DROP TABLE IF EXISTS "therapy_sessions" CASCADE`);
  // Schema-qualified to match the CREATE TYPE/table.specificType("public.") pattern.
  await knex.raw(`DROP TYPE IF EXISTS public.therapy_type`);
  // transaction_type: ADD VALUE is irreversible (see 0028 note) — no-op.
}
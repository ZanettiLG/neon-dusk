import type { Knex } from "knex";

/**
 * Neon Dusk — Migration 0037: gigs cooldown seconds (#187)
 * ============================================================================
 * Trampo cooldowns move from minutes to seconds and get a per-tier
 * progression (the only mechanic with real waits):
 *   T1 = 5s, T2 = 60s (1min), T3 = 900s (15min), T4 = 7200s (2h),
 *   T5 = 86400s (24h, lenda).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("gigs", (table) => {
    table.renameColumn("cooldown_minutes", "cooldown_seconds");
  });
  await knex.raw(`ALTER TABLE "gigs" ALTER COLUMN "cooldown_seconds" SET DEFAULT 86400`);
  await knex.raw(
    `UPDATE "gigs" SET "cooldown_seconds" = CASE "tier"
       WHEN 't1' THEN 5
       WHEN 't2' THEN 60
       WHEN 't3' THEN 900
       WHEN 't4' THEN 7200
       ELSE 86400
     END`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE "gigs" SET "cooldown_seconds" = CASE "tier"
       WHEN 't1' THEN 10
       WHEN 't2' THEN 15
       WHEN 't3' THEN 20
       WHEN 't4' THEN 25
       ELSE 30
     END`,
  );
  // Restore the pre-#187 DEFAULT (10 minutes) before renaming back — up() set
  // 86400 (seconds); a rollback without this would leave DEFAULT 86400 on
  // cooldown_minutes (= 60 days in minutes).
  await knex.raw(`ALTER TABLE "gigs" ALTER COLUMN "cooldown_seconds" SET DEFAULT 10`);
  await knex.schema.alterTable("gigs", (table) => {
    table.renameColumn("cooldown_seconds", "cooldown_minutes");
  });
}
